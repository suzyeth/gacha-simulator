/**
 * Integration test: feed real XM xlsx files through importXlsxFiles
 * and verify the full pipeline produces a valid pool.
 *
 * If this passes but the browser still fails → user's browser is stale
 * or didn't select all files. If this fails → bug in adapter.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { importXlsxFiles } from '../xlsx-adapter'

const XM_DIR = 'C:/Users/recep/Desktop/XM抽卡'

const dirExists = existsSync(XM_DIR)

describe.skipIf(!dirExists)('XM real files integration', () => {
  it('imports all XM xlsx files and builds a valid pool', async () => {
    const names = readdirSync(XM_DIR).filter((f) => f.endsWith('.xlsx'))
    expect(names.length).toBeGreaterThan(0)

    const sources = names.map((n) => {
      const buf = readFileSync(join(XM_DIR, n))
      return { name: n, buffer: new Uint8Array(buf) }
    })

    const result = await importXlsxFiles(sources)

    // Always log so we can diagnose, even if test fails
     
    console.log('\n=== xlsx import result ===')
     
    console.log(
      'sheets:',
      result.sheets.map((s) => ({
        file: s.fileName,
        sheet: s.sheetName,
        role: s.role,
        rows: s.dataRows.length,
      })),
    )
     
    console.log('issues:')
    for (const i of result.issues) {
       
      console.log(`  [${i.severity}] ${i.message}`)
    }
    if (result.pool) {
       
      console.log('pool:', {
        id: result.pool.id,
        name: result.pool.name,
        buckets: result.pool.buckets.length,
        items: result.pool.items?.length,
        rules: result.pool.rules?.length,
      })
    } else {
       
      console.log('POOL IS NULL')
    }

    expect(result.pool).not.toBeNull()
    if (!result.pool) return
    expect(result.pool.buckets.length).toBeGreaterThan(0)
  })
})
