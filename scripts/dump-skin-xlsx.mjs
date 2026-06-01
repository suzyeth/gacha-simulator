#!/usr/bin/env node
import * as XLSX from 'xlsx'
import { readFileSync } from 'node:fs'

const FILES = [
  'F:/kaipaogame/doc/trunk/塔防数据配置/S皮肤抽卡.xlsx',
  'F:/kaipaogame/doc/trunk/塔防数据配置/宝箱配置.xlsx',
]

for (const fp of FILES) {
  const wb = XLSX.read(readFileSync(fp), { type: 'buffer' })
  console.log(`\n${'═'.repeat(80)}\nFILE: ${fp}\n${'═'.repeat(80)}`)
  for (const sn of wb.SheetNames) {
    const sheet = wb.Sheets[sn]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: null })
    console.log(`\n--- Sheet "${sn}" (${rows.length} rows) ---`)
    rows.slice(0, 15).forEach((r, i) => {
      const s = JSON.stringify(r)
      console.log(`R${i.toString().padStart(2)}: ${s.length > 250 ? s.slice(0, 250) + '...' : s}`)
    })
    if (rows.length > 15) console.log(`... ${rows.length - 15} more rows`)
  }
}
