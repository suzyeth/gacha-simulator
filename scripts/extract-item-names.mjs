#!/usr/bin/env node
/**
 * Extract Chinese item names from kaipaogame config files,
 * build a unified resId → { name, type, quality } map for the simulator preset.
 */
import * as XLSX from 'xlsx'
import { readFileSync, writeFileSync } from 'node:fs'

const FILES = {
  items: 'F:/kaipaogame/doc/trunk/塔防数据配置/W-物品表.xlsx',
  skins: 'F:/kaipaogame/doc/trunk/塔防数据配置/S-皮肤.xlsx',
  gems: 'F:/kaipaogame/doc/trunk/塔防数据配置/gem宝石.xlsx',
  boxes: 'F:/kaipaogame/doc/trunk/塔防数据配置/宝箱配置.xlsx',
}

function readSheet(path, sheetIdx = 0) {
  const wb = XLSX.read(readFileSync(path), { type: 'buffer' })
  const sn = wb.SheetNames[sheetIdx]
  return { sheetName: sn, rows: XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, blankrows: false, defval: null }) }
}

// XM convention: row 4 = English fields, row 5 = types, row 6+ = data
function recordsXM(rows) {
  if (rows.length < 7) return []
  const fields = rows[4].map(c => c == null ? '' : String(c).trim())
  return rows.slice(6).map(row =>
    Object.fromEntries(fields.map((f, i) => [f, row[i]]))
  ).filter(r => Object.values(r).some(v => v !== null && v !== undefined && v !== ''))
}

const itemMap = {}

// 1. W-物品表
{
  const { rows } = readSheet(FILES.items)
  // Find the English header row
  let headerIdx = -1
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const r = rows[i]
    if (!Array.isArray(r)) continue
    const cells = r.map(c => c == null ? '' : String(c).trim())
    if (cells.includes('resId') && cells.includes('name')) { headerIdx = i; break }
  }
  if (headerIdx >= 0) {
    const fields = rows[headerIdx].map(c => c == null ? '' : String(c).trim())
    const idxResId = fields.indexOf('resId')
    const idxName = fields.indexOf('name')
    const idxType = fields.indexOf('type')
    const idxQuality = fields.indexOf('quality')
    const idxDesc = fields.indexOf('desc')
    for (let j = headerIdx + 2; j < rows.length; j++) {
      const r = rows[j]
      if (!Array.isArray(r)) continue
      const rid = r[idxResId]
      const nm = r[idxName]
      if (rid != null) {
        itemMap[String(rid)] = {
          name: nm != null ? String(nm) : String(rid),
          type: idxType >= 0 && r[idxType] != null ? String(r[idxType]) : undefined,
          quality: idxQuality >= 0 && r[idxQuality] != null ? String(r[idxQuality]) : undefined,
          desc: idxDesc >= 0 && r[idxDesc] != null ? String(r[idxDesc]) : undefined,
        }
      }
    }
    console.log(`W-物品表: ${Object.keys(itemMap).length} items`)
  } else {
    console.log('W-物品表: no English header found — dumping first 8 rows:')
    rows.slice(0, 8).forEach((r, i) => console.log(`R${i}:`, JSON.stringify(r).slice(0, 200)))
  }
}

// 2. S-皮肤
{
  const { rows } = readSheet(FILES.skins)
  let headerIdx = -1
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const r = rows[i]
    if (!Array.isArray(r)) continue
    const cells = r.map(c => c == null ? '' : String(c).trim())
    if (cells.includes('resId') && cells.includes('name')) { headerIdx = i; break }
  }
  if (headerIdx >= 0) {
    const fields = rows[headerIdx].map(c => c == null ? '' : String(c).trim())
    const idxResId = fields.indexOf('resId')
    const idxName = fields.indexOf('name')
    for (let j = headerIdx + 2; j < rows.length; j++) {
      const r = rows[j]
      if (!Array.isArray(r)) continue
      const rid = r[idxResId]
      const nm = r[idxName]
      if (rid != null && nm != null) {
        if (!itemMap[String(rid)]) itemMap[String(rid)] = { name: String(nm), type: '皮肤' }
        else if (!itemMap[String(rid)].type) itemMap[String(rid)].type = '皮肤'
      }
    }
  }
}

// 3. Gem 品质 names (resId 1-7 inside boxes refer to gemQuality)
// Map gem品质 → name (used by box 10014/10015 to identify gem grade)
const gemQualityNames = {}
{
  const wb = XLSX.read(readFileSync(FILES.gems), { type: 'buffer' })
  const sheet = wb.Sheets['宝石品质']
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: null })
  // row 4: quality desc consume consume1 icon
  for (let i = 6; i < rows.length; i++) {
    const r = rows[i]
    if (!Array.isArray(r)) continue
    const q = r[0]
    const desc = r[1]
    if (q != null && desc != null) gemQualityNames[q] = String(desc)
  }
}
// User correction: T7 = 多彩宝石
if (!gemQualityNames[7]) gemQualityNames[7] = '多彩宝石'
console.log('Gem 品质:', gemQualityNames)

// 4. itemBox bucket names from 宝箱配置 Sheet1 (备注 column)
const bucketNames = {}
{
  const wb = XLSX.read(readFileSync(FILES.boxes), { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Sheet1'], { header: 1, blankrows: false, defval: null })
  for (let i = 6; i < rows.length; i++) {
    const r = rows[i]
    if (!Array.isArray(r)) continue
    if (r[0] != null && r[4]) bucketNames[String(r[0])] = String(r[4])
  }
}
console.log('Bucket names:', bucketNames)

// Output
const out = { itemMap, gemQualityNames, bucketNames }
writeFileSync('G:/2026claude/gacha-simulator/scripts/.kaipao-names.json', JSON.stringify(out, null, 2))
console.log(`\nTotal items mapped: ${Object.keys(itemMap).length}`)
console.log(`Sample items:`)
const sampleIds = ['1', '4', '7', '80001', '80003', '10001', '10101', '11001', '11005', '20000', '10014', '10015', '10028']
for (const id of sampleIds) {
  console.log(`  ${id}: ${JSON.stringify(itemMap[id] ?? bucketNames[id] ?? 'NOT FOUND')}`)
}
