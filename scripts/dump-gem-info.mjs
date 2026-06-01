#!/usr/bin/env node
import * as XLSX from 'xlsx'
import { readFileSync } from 'node:fs'

// Look up what resId 1-7 are, and what 10028 contains beyond runes
const F = 'F:/kaipaogame/doc/trunk/塔防数据配置/gem宝石.xlsx'
const wb = XLSX.read(readFileSync(F), { type: 'buffer' })
console.log('Sheets:', wb.SheetNames)
for (const sn of wb.SheetNames.slice(0, 3)) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, blankrows: false, defval: null })
  console.log(`\n--- ${sn} (${rows.length} rows) ---`)
  rows.slice(0, 12).forEach((r, i) => {
    const s = JSON.stringify(r)
    console.log(`R${i.toString().padStart(2)}: ${s.length > 300 ? s.slice(0, 300) + '...' : s}`)
  })
}

// Also dump bucket 10028 row in itemBox.json + look at item-master for 11001-11005
console.log('\n\n=== 宝箱配置.xlsx Sheet1 row for 10028 ===')
const wb2 = XLSX.read(readFileSync('F:/kaipaogame/doc/trunk/塔防数据配置/宝箱配置.xlsx'), { type: 'buffer' })
const s1 = XLSX.utils.sheet_to_json(wb2.Sheets['Sheet1'], { header: 1, blankrows: false, defval: null })
for (const r of s1) {
  if (r && (r[0] === 10028 || String(r[0]).includes('10028'))) console.log(JSON.stringify(r))
}
console.log('\n=== itemBoxPro Sheet2 rows for 10028 (sample) ===')
const s2 = XLSX.utils.sheet_to_json(wb2.Sheets['Sheet2'], { header: 1, blankrows: false, defval: null })
let c = 0
for (const r of s2) {
  if (r && r[0] === 10028) {
    console.log(JSON.stringify(r))
    if (++c >= 35) break
  }
}
