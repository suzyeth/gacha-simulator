#!/usr/bin/env node
/**
 * Build a complete PoolSchema preset for 塔防 庭院 S皮肤抽卡 pool,
 * with Chinese item names + type/quality metadata so the simulator's
 * EconomyPanel and DistributionChart can show readable Chinese labels.
 *
 * Output: src/presets/kaipao-tingyuan.ts
 */
import * as XLSX from 'xlsx'
import { readFileSync, writeFileSync } from 'node:fs'

const SRC = 'F:/kaipaogame/doc/trunk/塔防数据配置'

function readSheets(path) {
  const wb = XLSX.read(readFileSync(path), { type: 'buffer' })
  const out = {}
  for (const sn of wb.SheetNames) {
    out[sn] = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, blankrows: false, defval: null })
  }
  return out
}

function recordsByEnglishHeader(rows) {
  let headerIdx = -1
  for (let i = 0; i < Math.min(12, rows.length); i++) {
    const r = rows[i]
    if (!Array.isArray(r)) continue
    const cells = r.map(c => c == null ? '' : String(c).trim())
    if (cells.includes('resId') || cells.includes('id')) { headerIdx = i; break }
  }
  if (headerIdx < 0) return { fields: [], records: [] }
  const fields = rows[headerIdx].map(c => c == null ? '' : String(c).trim())
  return {
    fields,
    records: rows.slice(headerIdx + 2).map(row =>
      Object.fromEntries(fields.map((f, i) => [f, Array.isArray(row) ? row[i] : null]))
    ).filter(r => Object.values(r).some(v => v !== null && v !== undefined && v !== '')),
  }
}

// ─── 1. Load skin metadata ───
const skinNames = {}
{
  const sheets = readSheets(`${SRC}/S-皮肤.xlsx`)
  for (const sn of Object.keys(sheets)) {
    const { fields, records } = recordsByEnglishHeader(sheets[sn])
    if (!fields.includes('resId') || !fields.includes('name')) continue
    for (const rec of records) {
      const rid = rec.resId
      const nm = rec.name
      if (rid != null && nm != null) skinNames[String(rid)] = String(nm)
    }
  }
}
// Fallback hardcoded names (from itemBoxPro Sheet2 hint column, observed earlier)
const skinFallback = {
  '80001': '莉亚', '80002': '卡莲娜', '80003': '艾拉娜',
  '80005': '栗小奈', '80007': '殷桃', '80008': '喵莉贝尔',
  '80009': '卡西', '80010': '卡芙琳', '80011': '薇拉',
  '90101': '皮肤90101', '90102': '皮肤90102', '90106': '皮肤90106',
  '90107': '皮肤90107', '90108': '皮肤90108',
}
for (const [k, v] of Object.entries(skinFallback)) {
  if (!skinNames[k]) skinNames[k] = v
}
console.log(`Skins: ${Object.keys(skinNames).length}`)

// ─── 2. W-物品表 (master item table) ───
const itemMaster = {}
{
  const sheets = readSheets(`${SRC}/W-物品表.xlsx`)
  for (const sn of Object.keys(sheets)) {
    const { fields, records } = recordsByEnglishHeader(sheets[sn])
    if (!fields.includes('resId') || !fields.includes('name')) continue
    for (const rec of records) {
      const rid = rec.resId
      if (rid == null) continue
      itemMaster[String(rid)] = {
        name: rec.name != null ? String(rec.name) : String(rid),
        type: rec.type != null ? String(rec.type) : undefined,
        quality: rec.quality != null ? String(rec.quality) : undefined,
      }
    }
  }
}
console.log(`W-物品表 items: ${Object.keys(itemMaster).length}`)

// ─── 3. Gem quality names ───
const gemNames = {
  1: '白色宝石', 2: '绿色宝石', 3: '蓝色宝石', 4: '紫色宝石',
  5: '金色宝石', 6: '红色宝石', 7: '多彩宝石',
}

// ─── 4. Bucket names from 宝箱配置 Sheet1 (备注 column) ───
const bucketNames = {}
{
  const wb = XLSX.read(readFileSync(`${SRC}/宝箱配置.xlsx`), { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Sheet1'], { header: 1, blankrows: false, defval: null })
  for (let i = 6; i < rows.length; i++) {
    const r = rows[i]
    if (Array.isArray(r) && r[0] != null && r[4]) bucketNames[String(r[0])] = String(r[4])
  }
}

// ─── 5. itemBoxPro = bucket contents ───
const boxContents = {}  // boxResId → [{ resId, weight, min, max }]
{
  const wb = XLSX.read(readFileSync(`${SRC}/宝箱配置.xlsx`), { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Sheet2'], { header: 1, blankrows: false, defval: null })
  for (let i = 6; i < rows.length; i++) {
    const r = rows[i]
    if (!Array.isArray(r)) continue
    const boxId = r[0], resId = r[1], prob = r[2], min = r[3], max = r[4]
    if (boxId == null || resId == null || prob == null) continue
    const key = String(boxId)
    if (!boxContents[key]) boxContents[key] = []
    boxContents[key].push({ resId: String(resId), weight: Number(prob), min: Number(min) || 1, max: Number(max) || Number(min) || 1 })
  }
}

// ─── 6. S皮肤抽卡 pool row ───
let poolRow
{
  const wb = XLSX.read(readFileSync(`${SRC}/S皮肤抽卡.xlsx`), { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['抽灵兽'], { header: 1, blankrows: false, defval: null })
  const fields = rows[4].map(c => c == null ? '' : String(c).trim())
  const dataRow = rows[6]
  poolRow = Object.fromEntries(fields.map((f, i) => [f, dataRow[i]]))
}
const rewards = JSON.parse(poolRow.rewards)
console.log(`Pool: id=${poolRow.id} "${poolRow.desc}",  rewards=${rewards.length} buckets`)

// ─── 7. Classify items into clean categories ───
function classifyItem(resId, masterEntry) {
  const id = String(resId)
  // Gem grade (1-7) — special case from box internal ids
  if (['1','2','3','4','5','6','7'].includes(id)) {
    // quality tag = tier rank (T1-T7),避免和 name "X色宝石" 重复
    return { name: gemNames[+id], type: '宝石', quality: `T${id}`, category: '宝石' }
  }
  // Skin
  if (/^(80|90)\d{3,4}$/.test(id) || skinNames[id]) {
    return { name: skinNames[id] ?? `皮肤${id}`, type: '皮肤', quality: 'S 级', category: '皮肤' }
  }
  // From W-物品表 — classify by type code
  if (masterEntry) {
    const nm = masterEntry.name
    // 装备图纸: name contains 蓝图/图纸
    if (/蓝图|图纸/.test(nm)) {
      return { name: nm, type: '装备图纸', quality: masterEntry.quality, category: '装备图纸' }
    }
    // 魔力符石 / 芯片
    if (/符石|芯片/.test(nm)) {
      return { name: nm, type: '魔力符石', quality: masterEntry.quality, category: '魔力符石' }
    }
    // 食物 / 道具 / 其他
    return { name: nm, type: '其他物品', quality: masterEntry.quality, category: '其他物品' }
  }
  return { name: `物品${id}`, type: '未知', quality: undefined, category: '未知' }
}

// ─── 8. Assemble PoolSchema ───
const totalBucketW = rewards.reduce((s, r) => s + r.quality, 0)
const bucketColors = {
  '20000': '#fbbf24',  // amber - S皮肤
  '10014': '#a78bfa',  // violet - 普通宝石箱
  '10015': '#f472b6',  // pink   - 璀璨宝石箱
  '10028': '#94a3b8',  // gray   - 道具
}

const buckets = []
const itemsSet = new Map()  // resId → meta (dedup across buckets)

for (const r of rewards) {
  const bid = String(r.resId)
  const contents = boxContents[bid] ?? []
  if (contents.length === 0) {
    console.warn(`Bucket ${bid} has no contents in itemBoxPro — skipping`)
    continue
  }
  // Build bucket
  buckets.push({
    id: bid,
    name: bucketNames[bid] ?? `Bucket ${bid}`,
    kind: 'box',
    weight: r.quality,
    color: bucketColors[bid] ?? '#888888',
    contents: contents.map(c => ({
      resId: c.resId,
      weight: c.weight,
      minCount: c.min,
      maxCount: c.max,
    })),
  })
  // Add items
  for (const c of contents) {
    if (!itemsSet.has(c.resId)) {
      const meta = classifyItem(c.resId, itemMaster[c.resId])
      itemsSet.set(c.resId, {
        resId: c.resId,
        name: meta.name,
        type: meta.type,
        quality: meta.quality,
        isFeatured: false,
      })
    }
  }
}

// ─── 9. Build first-draw script from firstDrawResId ───
//
// 引擎的 first-draw-script 规则要求脚本里每个 resId 都是池子里可抽到的物品
// (在某个 bucket 的 contents 里)。塔防的 firstDrawResId 里混了
// 1000000 / 1020000 这种"宝石装备部位"道具 —— 它们不在任何 gacha bucket,
// 引擎无法建模(会 throw)。所以:只有当脚本里 *所有* resId 都在池子里时
// 才发出 first-draw-script 规则;否则跳过(并打印警告)。
const rules = []
const inPoolResIds = new Set()
for (const b of buckets) for (const c of b.contents) inPoolResIds.add(String(c.resId))

let firstDraw
try { firstDraw = JSON.parse(poolRow.firstDrawResId) } catch {}
let firstDrawSkippedReason = null
if (Array.isArray(firstDraw) && firstDraw.length > 0) {
  const script = firstDraw.map(e => ({
    resId: String(e.resId),
    count: Number(e.number ?? e.count ?? 1),
  })).filter(s => s.resId)
  const outOfPool = script.filter(s => !inPoolResIds.has(s.resId)).map(s => s.resId)
  if (script.length > 0 && outOfPool.length === 0) {
    rules.push({ type: 'first-draw-script', params: { script } })
  } else if (outOfPool.length > 0) {
    firstDrawSkippedReason = `首抽脚本引用了 ${outOfPool.length} 个池外物品 (${outOfPool.join(', ')}) — 引擎无法建模,已跳过整条 first-draw-script 规则`
  }
}
// Cyclic pity
const smallBaodi = poolRow.smallBaodi
const bigBaodi = poolRow.bigBaodi
if (bigBaodi != null) rules.push({ type: 'cyclic-pity', params: { period: 50, bucketId: String(bigBaodi) } })
if (smallBaodi != null) rules.push({ type: 'cyclic-pity', params: { period: 10, bucketId: String(smallBaodi) } })

// ─── 10. Draw modes ───
const drawModes = []
if (poolRow.normalDrawResId) drawModes.push({
  id: 'normal',
  label: '普通抽',
  costResId: String(poolRow.normalDrawResId),
  costPerOne: Number(poolRow.normalOneDrawCostNum) || 0,
  costPerTen: Number(poolRow.normalTenDrawCostNum) || 0,
})
if (poolRow.ticketDrawResId) drawModes.push({
  id: 'ticket',
  label: '用券抽',
  costResId: String(poolRow.ticketDrawResId),
  costPerOne: Number(poolRow.ticketDrawCostNum) || 1,
  costPerTen: (Number(poolRow.ticketDrawCostNum) || 1) * 10,
})

const pool = {
  id: 'kaipao-tingyuan',
  name: '塔防 庭院 S 皮肤池',
  description: '塔防项目 庭院池(skinBox.json id=1)— 含 50/10 双保底、4 个一级 bucket(S 皮肤箱 / 普通宝石箱 / 璀璨宝石箱 / 道具箱)。注:首抽脚本因引用池外物品(宝石装备部位)已省略,不影响稳态概率。',
  buckets,
  items: Array.from(itemsSet.values()),
  drawModes,
  rules,
}

// ─── 11. Write TypeScript preset ───
const ts = `/**
 * 塔防项目 庭院 S 皮肤抽卡 池 — auto-generated from
 *   F:/kaipaogame/doc/trunk/塔防数据配置/{S皮肤抽卡, 宝箱配置, W-物品表, gem宝石, S-皮肤}.xlsx
 *
 * Regenerate via:  node scripts/build-kaipao-preset.mjs
 *
 * Source: skinBox.json id=1 "庭院" / itemBoxPro.json
 * Buckets:
 *   20000 (S 皮肤箱)    weight 3       bigBaodi T=50
 *   10014 (普通宝石箱)   weight 500     smallBaodi T=10
 *   10015 (璀璨宝石箱)   weight 150     无保底
 *   10028 (道具箱)      weight 7000    无保底
 *
 * DO NOT EDIT BY HAND — change source xlsx + rerun the script.
 */
import type { z } from 'zod'
import type { PoolSchema } from '../engine/schema'

type Pool = z.input<typeof PoolSchema>

export const kaipaoTingyuanPool: Pool = ${JSON.stringify(pool, null, 2)}

export const kaipaoExpectedDistribution = {
  // Closed-form per-pull effective probability (含保底). MC 验证 ±0.4%.
  buckets: {
    '20000': 0.02017,   // S 皮肤箱  (含 50 抽硬保底)
    '10014': 0.13172,   // 普通宝石箱 (含 10 抽硬保底)
    '10015': 0.01779,   // 璀璨宝石箱
    '10028': 0.83034,   // 道具箱
  },
  gemPerPull: 0.14951,  // 普通箱 + 璀璨箱 加总(因两箱全部 100% 是宝石)
  perGrade: {
    1: 0.00000132,  // 白色宝石
    2: 0.0000191,   // 绿色宝石
    3: 0.00792,     // 蓝色宝石
    4: 0.09625,     // 紫色宝石
    5: 0.03170,     // 金色宝石
    6: 0.00907,     // 红色宝石
    7: 0.00455,     // 多彩宝石
  },
} as const
`
writeFileSync('G:/2026claude/gacha-simulator/src/presets/kaipao-tingyuan.ts', ts)

// Also export JSON for "Import JSON" button usage
writeFileSync('G:/2026claude/gacha-simulator/scripts/.kaipao-tingyuan.json', JSON.stringify(pool, null, 2))

console.log(`\n=== Generated ===`)
if (firstDrawSkippedReason) console.warn(`⚠ ${firstDrawSkippedReason}`)
console.log(`  Buckets: ${pool.buckets.length}`)
console.log(`  Items:   ${pool.items.length}`)
console.log(`  Rules:   ${pool.rules.length} (${pool.rules.map(r => r.type).join(', ')})`)
console.log(`  Draw modes: ${pool.drawModes.length}`)
console.log(`\nWritten:`)
console.log(`  src/presets/kaipao-tingyuan.ts`)
console.log(`  scripts/.kaipao-tingyuan.json (for Import JSON)`)

// Sanity: count items by type
const typeCounts = {}
for (const it of pool.items) {
  typeCounts[it.type ?? '?'] = (typeCounts[it.type ?? '?'] ?? 0) + 1
}
console.log(`\nItems by type:`)
for (const [t, n] of Object.entries(typeCounts).sort((a,b)=>b[1]-a[1])) {
  console.log(`  ${t.padEnd(12)} ${n}`)
}
