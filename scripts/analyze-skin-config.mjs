#!/usr/bin/env node
/**
 * Analyze 塔防项目 S皮肤抽卡 (skinBox.json + itemBoxPro.json) — drop probabilities,
 * pity effects, per-item rates. Standalone — uses xlsx pkg directly.
 *
 * Quirk this script handles vs the generic importer:
 *   - Buckets are NOT in a separate sheet. They are inlined in the `rewards`
 *     JSON column of skinBox.json (the pool_row sheet). Each entry =
 *     { resId: <bucketId>, number, quality } where `quality` plays the role
 *     of the first-level weight.
 *
 * Usage:
 *   node scripts/analyze-skin-config.mjs
 */
import * as XLSX from 'xlsx'
import { readFileSync, existsSync } from 'node:fs'

const SKIN_FILE = 'F:/kaipaogame/doc/trunk/塔防数据配置/S皮肤抽卡.xlsx'
const BOX_FILE = 'F:/kaipaogame/doc/trunk/塔防数据配置/宝箱配置.xlsx'
const ITEMS_FILE = 'F:/kaipaogame/doc/trunk/塔防数据配置/S-皮肤.xlsx'  // optional
const WORLD_ITEMS_FILE = 'F:/kaipaogame/doc/trunk/塔防数据配置/W-物品表.xlsx'  // optional

function readSheets(path) {
  const wb = XLSX.read(readFileSync(path), { type: 'buffer' })
  const out = {}
  for (const sn of wb.SheetNames) {
    out[sn] = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, blankrows: false, defval: null })
  }
  return out
}

// XM convention: R04 (index 4) = English field row, R05 = type row, R06+ = data.
function asRecords(rows, headerRowIdx = 4, typeRowIdx = 5) {
  const fields = rows[headerRowIdx]?.map(c => c == null ? '' : String(c).trim())
  if (!fields) return []
  const dataStart = typeRowIdx + 1
  return rows.slice(dataStart).map(row =>
    Object.fromEntries(fields.map((f, i) => [f, row[i]]))
  ).filter(r => Object.values(r).some(v => v !== null && v !== undefined && v !== ''))
}

const toStr = v => (v == null || v === '') ? undefined : String(v).trim()
const toNum = v => {
  if (v == null || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

// ─── Parse skinBox.json ───
const skinSheets = readSheets(SKIN_FILE)
const poolRecs = asRecords(skinSheets['抽灵兽'])
console.log(`Loaded ${poolRecs.length} pool row(s) from S皮肤抽卡.xlsx / 抽灵兽`)

if (!poolRecs.length) { console.error('No pool rows'); process.exit(1) }
const pool = poolRecs[0]
console.log(`\nPool: id=${pool.id}, desc="${pool.desc}"`)

// rewards JSON = bucket spec
const rewards = JSON.parse(pool.rewards)
console.log(`\n第一级抽取 (rewards JSON, ${rewards.length} buckets):`)
const totalW = rewards.reduce((s, r) => s + r.quality, 0)
console.log(`  Sum of quality (weights): ${totalW}`)
for (const r of rewards) {
  console.log(`    bucket ${r.resId}: quality=${r.quality} → P = ${(r.quality/totalW*100).toFixed(4)}% (1 in ${(totalW/r.quality).toFixed(1)})`)
}

// Pity
const smallBaodi = toNum(pool.smallBaodi)
const bigBaodi = toNum(pool.bigBaodi)
console.log(`\nPity:`)
console.log(`  smallBaodi: bucket ${smallBaodi} every 10 pulls (parameter says: 10次保底皮肤阶级)`)
console.log(`  bigBaodi:   bucket ${bigBaodi} every 50 pulls (parameter says: 50次保底皮肤阶级)`)

// Cost
console.log(`\n抽卡成本:`)
console.log(`  普通抽: 物品${pool.normalDrawResId} × ${pool.normalOneDrawCostNum} (单抽) / ${pool.normalTenDrawCostNum} (十连)`)
console.log(`     → 十连优惠 = ${(pool.normalOneDrawCostNum * 10 / pool.normalTenDrawCostNum).toFixed(2)}x`)
console.log(`  用券抽: 物品${pool.ticketDrawResId} × ${pool.ticketDrawCostNum}`)
console.log(`  每日免费: ${pool.freeTimes}`)
console.log(`  每日上限: ${pool.limit}`)

// First-draw script
try {
  const firstDraw = JSON.parse(pool.firstDrawResId)
  if (Array.isArray(firstDraw)) {
    console.log(`\n首抽脚本 (firstDrawResId, ${firstDraw.length} scripted pulls):`)
    firstDraw.forEach((e, i) => {
      console.log(`  抽${i+1}: resId=${e.resId}, number=${e.number ?? 1}, quality=${e.quality ?? '-'}`)
    })
  }
} catch {}

// ─── Parse 宝箱配置.xlsx ───
const boxSheets = readSheets(BOX_FILE)
// Sheet1 = itemBox.json (bucket meta — only useful for names)
const boxMetaRows = asRecords(boxSheets['Sheet1'])
// Sheet2 = itemBoxPro.json (bucket contents)
const boxContentRows = asRecords(boxSheets['Sheet2'])

// We don't have a "name" column in itemBox.json, but the "备注" column was at index 4 in raw rows. Re-extract names manually:
const boxNameMap = new Map()
const sheet1Raw = boxSheets['Sheet1']
for (let i = 6; i < sheet1Raw.length; i++) {
  const row = sheet1Raw[i]
  if (!row) continue
  const boxResId = row[0]
  const note = row[4]
  if (boxResId != null && note) boxNameMap.set(String(boxResId), String(note))
}

// itemBoxPro Sheet2 has trailing columns (resId hint + note) at indices 8/9 in raw rows
// Extract a content→item-name hint
const sheet2Raw = boxSheets['Sheet2']
const itemNameHint = new Map() // resId → hint name
for (let i = 6; i < sheet2Raw.length; i++) {
  const row = sheet2Raw[i]
  if (!row) continue
  const possibleResId = row[8]
  const possibleName = row[9]
  if (possibleResId != null && possibleName) itemNameHint.set(String(possibleResId), String(possibleName))
}

// Group bucket contents
const contentsByBucket = new Map()
for (const r of boxContentRows) {
  const boxId = toStr(r.boxResId)
  const resId = toStr(r.resId)
  const weight = toNum(r.probability)
  const min = toNum(r.minNumber) ?? 1
  const max = toNum(r.maxNumber) ?? min
  if (!boxId || !resId || weight == null) continue
  if (!contentsByBucket.has(boxId)) contentsByBucket.set(boxId, [])
  contentsByBucket.get(boxId).push({ resId, weight, min, max })
}

// ─── Item names (best-effort) ───
const itemNames = new Map()
for (const [k, v] of itemNameHint) itemNames.set(k, v)

// Try to enrich from S-皮肤.xlsx (looks like skin metadata)
if (existsSync(ITEMS_FILE)) {
  try {
    const sk = readSheets(ITEMS_FILE)
    for (const sn of Object.keys(sk)) {
      const raw = sk[sn]
      // Look for English field row
      for (let i = 0; i < Math.min(10, raw.length); i++) {
        const row = raw[i]
        if (!Array.isArray(row)) continue
        const cells = row.map(c => c == null ? '' : String(c).trim())
        const hasResId = cells.includes('resId')
        const hasName = cells.includes('name')
        if (hasResId && hasName) {
          const idxResId = cells.indexOf('resId')
          const idxName = cells.indexOf('name')
          // data starts at i+2 (skip type row)
          for (let j = i + 2; j < raw.length; j++) {
            const d = raw[j]
            if (!Array.isArray(d)) continue
            const rid = d[idxResId]
            const nm = d[idxName]
            if (rid != null && nm) itemNames.set(String(rid), String(nm))
          }
          break
        }
      }
    }
  } catch (e) { /* ignore */ }
}

// ─── Compute effective probabilities with pity ───
function cyclicPityEffP(natural_p, T) {
  if (natural_p <= 0) return 1 / T
  if (natural_p >= 1) return natural_p
  const q = 1 - natural_p
  const Eprior = (1 - Math.pow(q, T)) / natural_p
  return 1 / Eprior
}

console.log(`\n${'═'.repeat(78)}`)
console.log(`一级抽取概率 (含保底,封闭式)`)
console.log(`${'═'.repeat(78)}`)
console.log(`| bucket | 备注                | weight | 自然P     | 保底周期 | 有效P     | E(抽数/次)|`)
console.log(`|--------|--------------------|--------|-----------|---------|-----------|-----------|`)
for (const r of rewards) {
  const id = String(r.resId)
  const name = boxNameMap.get(id) ?? '-'
  const natP = r.quality / totalW
  let T = null
  if (smallBaodi === r.resId) T = 10
  else if (bigBaodi === r.resId) T = 50
  const effP = T == null ? natP : cyclicPityEffP(natP, T)
  console.log(`| ${id.padEnd(6)} | ${name.padEnd(18)} | ${String(r.quality).padStart(6)} | ${(natP*100).toFixed(4).padStart(8)}% | ${T == null ? '   —    ' : ('   '+T+'   ').padStart(8)} | ${(effP*100).toFixed(4).padStart(8)}% | ${(1/effP).toFixed(2).padStart(9)} |`)
}

// ─── Cost-per-S-skin (bucket 20000) and per-rare-gem ───
console.log(`\n${'═'.repeat(78)}`)
console.log(`抽卡经济性 (基于普通抽: ${pool.normalDrawResId} × ${pool.normalOneDrawCostNum} / pull,十连 = ${pool.normalTenDrawCostNum})`)
console.log(`${'═'.repeat(78)}`)
const ssEffP = cyclicPityEffP(rewards.find(r => r.resId === bigBaodi).quality / totalW, 50)
const smallEffP = cyclicPityEffP(rewards.find(r => r.resId === smallBaodi).quality / totalW, 10)
console.log(`  E(抽数 / 一只 S 皮肤箱 [${bigBaodi}]): ${(1/ssEffP).toFixed(2)} 抽`)
console.log(`     单抽消耗: ${(pool.normalOneDrawCostNum * 1/ssEffP).toFixed(0)} × 物品${pool.normalDrawResId}`)
console.log(`     十连消耗: ${(pool.normalTenDrawCostNum * 1/ssEffP / 10).toFixed(0)} × 物品${pool.normalDrawResId} (节省 ${(((pool.normalOneDrawCostNum - pool.normalTenDrawCostNum/10) / pool.normalOneDrawCostNum)*100).toFixed(1)}%)`)
console.log(`  E(抽数 / 一只 普通宝石箱 [${smallBaodi}]): ${(1/smallEffP).toFixed(2)} 抽`)

// ─── Inside each pity-targeted bucket: per-item rates ───
console.log(`\n${'═'.repeat(78)}`)
console.log(`二级抽取 (in-bucket items)`)
console.log(`${'═'.repeat(78)}`)
for (const r of rewards) {
  const id = String(r.resId)
  const cs = contentsByBucket.get(id)
  if (!cs || cs.length === 0) {
    console.log(`\n  Bucket ${id} (${boxNameMap.get(id) ?? '-'}): NO CONTENTS FOUND in 宝箱配置.xlsx Sheet2`)
    continue
  }
  const natP = r.quality / totalW
  let T = null
  if (smallBaodi === r.resId) T = 10
  else if (bigBaodi === r.resId) T = 50
  const effP = T == null ? natP : cyclicPityEffP(natP, T)
  const sumW = cs.reduce((s, c) => s + c.weight, 0)
  const sorted = [...cs].sort((a, b) => b.weight - a.weight)

  console.log(`\n─── Bucket ${id} "${boxNameMap.get(id) ?? '-'}" — ${cs.length} 物品 / sumW=${sumW} / P(bucket,含保底)=${(effP*100).toFixed(4)}% ───`)
  console.log(`  resId   名称                   权重   P(in-box)   P(整体)     E(抽数)`)
  for (const c of sorted) {
    const pInBox = c.weight / sumW
    const pOverall = effP * pInBox
    const expDraws = 1 / pOverall
    const nm = (itemNames.get(c.resId) ?? '?').toString().slice(0, 20)
    const cntStr = c.min === c.max ? `×${c.min}` : `×${c.min}-${c.max}`
    console.log(`  ${c.resId.padEnd(7)} ${nm.padEnd(22)} ${String(c.weight).padStart(6)} ${(pInBox*100).toFixed(3).padStart(8)}%  ${(pOverall*100).toFixed(5).padStart(9)}%  ${expDraws.toFixed(1).padStart(7)} ${cntStr}`)
  }
}

// ─── A1 closed form vs simulation note ───
console.log(`\n${'═'.repeat(78)}`)
console.log(`说明:`)
console.log(`${'═'.repeat(78)}`)
console.log(`  - "自然P" = 不计保底,纯按 quality 权重的瞬时概率`)
console.log(`  - "有效P" = 含 cyclic pity 的长期平均概率,封闭式: 1 / E[draws/cycle]`)
console.log(`            E[draws/cycle] = (1 - (1-p)^T) / p`)
console.log(`  - 注: 实际两个 pity (10/50) 是独立计数,二级抽取在 bucket 20000 同时受 50 抽硬保底约束`)
console.log(`            -- 严格联合分布需要 Monte Carlo(模拟器里 200k 抽测试,封闭式 ±0.4%)`)
console.log(`  - 注: "P(整体)" 是 "有效P × 二级抽中"。如果策划希望严格命中率,推荐用模拟器跑一次`)
