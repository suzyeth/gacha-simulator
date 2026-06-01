#!/usr/bin/env node
/**
 * Debug script: run xlsx-adapter against real XM files and print
 * what the detector / classifier sees. Use this when import fails
 * to figure out which sheet is mis-classified.
 *
 * Usage:
 *   node scripts/debug-xm-import.mjs
 */
import * as XLSX from 'xlsx'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// We have to inline a copy of the adapter logic since this is a plain
// .mjs script not in the TS build. Keep in sync with src/importers/xlsx-adapter.ts.

const FIELD_SYNONYMS = {
  resId: 'resId', id: 'id', name: 'name', weight: 'weight',
  boxResId: 'boxResId', probability: 'probability',
  type: 'type', quality: 'quality', desc: 'desc',
  minNumber: 'minNumber', maxNumber: 'maxNumber', showPer: 'showPer',
  smallBaodi: 'smallBaodi', bigBaodi: 'bigBaodi',
  ticketDrawResId: 'ticketDrawResId', ticketDrawCostNum: 'ticketDrawCostNum',
  normalDrawResId: 'normalDrawResId',
  normalOneDrawCostNum: 'normalOneDrawCostNum',
  normalTenDrawCostNum: 'normalTenDrawCostNum',
  freeTimes: 'freeTimes', firstDrawResId: 'firstDrawResId',
  processBox: 'processBox', limit: 'limit', rewards: 'rewards',
  costResId: 'costResId', costPerOne: 'costPerOne', costPerTen: 'costPerTen',
  dailyTimes: 'dailyTimes', dailyLimit: 'dailyLimit',
  tier: 'tier', step: 'step', roleId: 'roleId',
  '物品ID': 'resId', '物品id': 'resId', '物品Id': 'resId', resID: 'resId',
  '物品名称': 'name', '名称': 'name', '宝箱名称': 'name',
  '宝箱编号': 'boxResId', '宝箱ID': 'boxResId', '宝箱id': 'boxResId',
  权重: 'weight', '物品权重': 'weight', '权重 quality': 'weight',
  概率: 'probability', '概率（公式）': 'probability', '概率(公式)': 'probability',
  类型: 'type', 品质: 'quality', 描述: 'desc', 备注: 'notes',
  阶位: 'tier', '阶位/物品ID': 'tier', 阶级: 'step', '角色id': 'roleId',
}
const CANONICAL = new Set(Object.values(FIELD_SYNONYMS))
const ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/
const TYPE_WORDS = new Set(['int','long','string','json','float','double','bool','boolean','number','short','byte'])

function normalizeField(raw) {
  if (raw == null) return ''
  const t = String(raw).trim()
  if (!t) return ''
  return FIELD_SYNONYMS[t] ?? t
}

function detectHeader(rows) {
  const SCAN = Math.min(12, rows.length)
  let best = { idx: -1, score: 0, fields: [] }
  for (let i = 0; i < SCAN; i++) {
    const row = rows[i]
    if (!Array.isArray(row)) continue
    const cells = row.map(c => (c == null ? '' : String(c).trim()))
    const nonEmpty = cells.filter(Boolean).length
    if (nonEmpty < 2) continue
    const typeWordCount = cells.filter(c => TYPE_WORDS.has(c.toLowerCase())).length
    if (typeWordCount >= Math.max(2, nonEmpty * 0.5)) continue
    const normalized = cells.map(normalizeField)
    const canonical = normalized.filter(n => CANONICAL.has(n)).length
    const eng = cells.filter(c => ID_PATTERN.test(c) && !TYPE_WORDS.has(c.toLowerCase())).length
    const score = canonical + eng * 3
    if (score > best.score) best = { idx: i, score, fields: normalized }
  }
  if (best.score < 3) return { headerRowIdx: -1, fields: [], score: 0 }
  return { headerRowIdx: best.idx, fields: best.fields, score: best.score }
}

function classifySheet(fields) {
  const has = n => fields.includes(n)
  if (has('smallBaodi') || has('bigBaodi') || has('ticketDrawResId') || has('firstDrawResId')) return 'pool_row'
  if (has('boxResId') && (has('resId') || has('probability') || has('weight'))) return 'bucket_contents'
  if (has('resId') && has('weight') && !has('boxResId')) return 'buckets'
  if (has('resId') && has('name') && !has('weight') && !has('boxResId')) return 'items'
  if (has('costResId') || has('costPerOne')) return 'draw_modes'
  return 'unclassified'
}

const XM_DIR = 'C:/Users/recep/Desktop/XM抽卡'
const files = readdirSync(XM_DIR).filter(f => f.endsWith('.xlsx'))

console.log(`Found ${files.length} xlsx files in ${XM_DIR}\n`)

for (const fname of files) {
  const buf = readFileSync(join(XM_DIR, fname))
  const wb = XLSX.read(buf, { type: 'buffer' })
  console.log(`\n${'='.repeat(80)}`)
  console.log(`FILE: ${fname}`)
  console.log('='.repeat(80))
  for (const sn of wb.SheetNames) {
    const sheet = wb.Sheets[sn]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: null })
    const { headerRowIdx, fields, score } = detectHeader(rows)
    const role = headerRowIdx >= 0 ? classifySheet(fields) : 'unclassified'
    console.log(`\n  📄 Sheet "${sn}" (${rows.length} rows)`)
    console.log(`     headerRowIdx: ${headerRowIdx}, score: ${score}`)
    if (headerRowIdx >= 0) {
      console.log(`     fields: [${fields.filter(Boolean).map(f => CANONICAL.has(f) ? '✓'+f : f).join(', ')}]`)
    }
    console.log(`     → ROLE: ${role}`)
    // Show first 3 raw rows for context
    rows.slice(0, 4).forEach((r, i) => {
      const s = JSON.stringify(r).slice(0, 160)
      console.log(`     R${i}: ${s}`)
    })
  }
}
