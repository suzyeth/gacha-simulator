import { describe, it, expect } from 'vitest'
import {
  detectHeader,
  classifySheet,
  normalizeField,
  stitchPool,
  type SheetData,
  type ImportIssue,
} from '../xlsx-adapter'

describe('normalizeField', () => {
  it('passes through English identifiers', () => {
    expect(normalizeField('resId')).toBe('resId')
    expect(normalizeField('smallBaodi')).toBe('smallBaodi')
  })

  it('maps Chinese column names to canonical English', () => {
    expect(normalizeField('权重')).toBe('weight')
    expect(normalizeField('物品名称')).toBe('name')
    expect(normalizeField('宝箱编号')).toBe('boxResId')
    expect(normalizeField('品质')).toBe('quality')
  })

  it('maps mixed Chinese/English (XM real cases)', () => {
    expect(normalizeField('权重 quality')).toBe('weight')
    expect(normalizeField('概率（公式）')).toBe('probability')
    expect(normalizeField('阶位/物品ID')).toBe('tier')
  })

  it('returns trimmed input for unknown fields', () => {
    expect(normalizeField('  随便什么  ')).toBe('随便什么')
    expect(normalizeField('1000 抽期望次数')).toBe('1000 抽期望次数')
  })

  it('handles null/undefined/empty', () => {
    expect(normalizeField(null)).toBe('')
    expect(normalizeField(undefined)).toBe('')
    expect(normalizeField('')).toBe('')
  })
})

describe('detectHeader', () => {
  it('finds the R05 row when present (English identifiers)', () => {
    const rows = [
      ['skinBox.json'],
      [1, 1, 1, 1],
      ['ID', '描述', '物品权重', '保底物品'],
      ['ID', '描述', '物品权重', '保底物品'],
      ['id', 'desc', 'weight', 'smallBaodi'],
      ['int', 'string', 'int', 'int'],
      [1, 'pool', 100, 10014],
    ]
    const { headerRowIdx, fields } = detectHeader(rows)
    expect(headerRowIdx).toBe(4)
    expect(fields).toEqual(['id', 'desc', 'weight', 'smallBaodi'])
  })

  it('falls back to Chinese header when no English row present (XM 保底规则 case)', () => {
    // Real XM "保底规则" sheet structure: banner, then mixed Chinese/English headers in R03
    const rows = [
      ['', '单抽随机产出', '', '', ''],
      [
        '',
        'resId',
        '物品名称',
        '品质',
        '权重 quality',
        '概率（公式）',
        '备注',
      ],
      ['', 20000, 'S皮肤箱', '—', 0.03, 0.000395, 'bigBaodi 命中物'],
      ['', 10014, '普通宝石匣', '稀有', 5, 0.0658, 'smallBaodi 命中物'],
    ]
    const { headerRowIdx, fields } = detectHeader(rows)
    expect(headerRowIdx).toBe(1)
    // Field at index 1 (resId) is English so it's already canonical;
    // Chinese ones at indices 2-6 normalize.
    expect(fields[1]).toBe('resId')
    expect(fields[2]).toBe('name')
    expect(fields[3]).toBe('quality')
    expect(fields[4]).toBe('weight')
    expect(fields[5]).toBe('probability')
    expect(fields[6]).toBe('notes')
  })

  it('returns -1 when no plausible header found', () => {
    const rows = [[], [null], ['']]
    const { headerRowIdx } = detectHeader(rows)
    expect(headerRowIdx).toBe(-1)
  })

  it('skips banner rows (single non-empty cell)', () => {
    const rows = [
      ['一些 banner 标题'],
      ['id', 'name', 'weight'],
      [1, 'a', 10],
    ]
    const { headerRowIdx, fields } = detectHeader(rows)
    expect(headerRowIdx).toBe(1)
    expect(fields).toEqual(['id', 'name', 'weight'])
  })

  it('prefers R05 (English) row over R03 (Chinese) when both are present', () => {
    // S皮肤抽卡 case: R03 Chinese + R04 R03-dup + R05 English
    const rows = [
      ['skinBox.json'],
      [1, 1, 1, 1],
      ['ID', '描述', '物品权重', '10次保底皮肤阶级'],
      ['ID', '描述', '物品权重', '10次保底皮肤阶级'],
      ['id', 'desc', 'weight', 'smallBaodi'],
      ['int', 'string', 'int', 'int'],
      [1, 'pool', 100, 10014],
    ]
    const { headerRowIdx } = detectHeader(rows)
    expect(headerRowIdx).toBe(4) // R05 wins
  })
})

describe('classifySheet', () => {
  it('detects pool_row by smallBaodi/bigBaodi/ticketDrawResId/firstDrawResId', () => {
    expect(classifySheet(['id', 'smallBaodi', 'bigBaodi'])).toBe('pool_row')
    expect(classifySheet(['id', 'ticketDrawResId', 'normalDrawResId'])).toBe('pool_row')
    expect(classifySheet(['id', 'firstDrawResId'])).toBe('pool_row')
  })

  it('detects bucket_contents by boxResId + resId/probability/weight', () => {
    expect(classifySheet(['boxResId', 'resId', 'probability'])).toBe('bucket_contents')
    expect(classifySheet(['boxResId', 'resId', 'weight'])).toBe('bucket_contents')
  })

  it('detects buckets by resId + weight (no boxResId)', () => {
    expect(classifySheet(['resId', 'name', 'weight'])).toBe('buckets')
    expect(classifySheet(['resId', 'weight'])).toBe('buckets')
  })

  it('detects items by resId + name (no weight, no boxResId)', () => {
    expect(classifySheet(['resId', 'name', 'type', 'quality'])).toBe('items')
  })

  it('detects draw_modes by costResId / costPerOne', () => {
    expect(classifySheet(['id', 'costResId', 'costPerOne'])).toBe('draw_modes')
  })

  it('returns unclassified when no signature matches', () => {
    expect(classifySheet(['foo', 'bar', 'baz'])).toBe('unclassified')
    expect(classifySheet([])).toBe('unclassified')
  })

  it('pool_row signature wins over weight signature', () => {
    // pool_row may also have weight column — should still be pool_row
    expect(classifySheet(['resId', 'weight', 'smallBaodi'])).toBe('pool_row')
  })
})

describe('stitchPool', () => {
  function makeSheet(
    role: SheetData['role'],
    fields: string[],
    dataRows: Array<Record<string, unknown>>,
  ): SheetData {
    return {
      fileName: 'test.xlsx',
      sheetName: 'sheet1',
      rawRows: [],
      headerRowIdx: 0,
      fields,
      dataRows,
      role,
    }
  }

  it('builds a pool from buckets + bucket_contents + items', () => {
    const sheets: SheetData[] = [
      makeSheet(
        'buckets',
        ['resId', 'name', 'weight'],
        [
          { resId: 'A', name: 'A box', weight: 1 },
          { resId: 'B', name: 'B box', weight: 4 },
        ],
      ),
      makeSheet(
        'bucket_contents',
        ['boxResId', 'resId', 'weight'],
        [
          { boxResId: 'A', resId: 'a1', weight: 10 },
          { boxResId: 'B', resId: 'b1', weight: 1 },
        ],
      ),
      makeSheet(
        'items',
        ['resId', 'name', 'type'],
        [
          { resId: 'a1', name: 'A One', type: 'gem' },
          { resId: 'b1', name: 'B One', type: 'box' },
        ],
      ),
    ]
    const issues: ImportIssue[] = []
    const pool = stitchPool(sheets, issues)
    expect(pool).not.toBeNull()
    if (!pool) return
    expect(pool.buckets).toHaveLength(2)
    expect(pool.buckets[0].id).toBe('A')
    expect(pool.buckets[0].contents[0]).toEqual({ resId: 'a1', weight: 10 })
    expect(pool.items).toHaveLength(2)
    expect(pool.items?.find((i) => i.resId === 'a1')?.name).toBe('A One')
  })

  it('returns null and error when buckets missing', () => {
    const issues: ImportIssue[] = []
    const pool = stitchPool(
      [
        makeSheet(
          'bucket_contents',
          ['boxResId', 'resId', 'weight'],
          [{ boxResId: 'A', resId: 'a1', weight: 1 }],
        ),
      ],
      issues,
    )
    expect(pool).toBeNull()
    expect(issues.some((i) => i.severity === 'error' && /buckets/.test(i.message))).toBe(true)
  })

  it('synthesizes cyclic-pity rules from pool_row smallBaodi/bigBaodi', () => {
    const sheets: SheetData[] = [
      makeSheet(
        'pool_row',
        ['id', 'desc', 'smallBaodi', 'bigBaodi'],
        [{ id: '1', desc: '庭院', smallBaodi: '10014', bigBaodi: '20000' }],
      ),
      makeSheet(
        'buckets',
        ['resId', 'weight'],
        [
          { resId: '10014', weight: 5 },
          { resId: '20000', weight: 0.03 },
        ],
      ),
      makeSheet(
        'bucket_contents',
        ['boxResId', 'resId', 'weight'],
        [
          { boxResId: '10014', resId: 'gem-1', weight: 100 },
          { boxResId: '20000', resId: 'skin-1', weight: 100 },
        ],
      ),
    ]
    const issues: ImportIssue[] = []
    const pool = stitchPool(sheets, issues)
    expect(pool).not.toBeNull()
    if (!pool) return
    expect(pool.rules).toHaveLength(2)
    const small = pool.rules?.find(
      (r) => r.type === 'cyclic-pity' && r.params.bucketId === '10014',
    )
    expect(small).toBeDefined()
    expect((small as { params: { period: number } }).params.period).toBe(10)
    const big = pool.rules?.find(
      (r) => r.type === 'cyclic-pity' && r.params.bucketId === '20000',
    )
    expect((big as { params: { period: number } }).params.period).toBe(50)
  })

  it('warns when bucket_contents references unknown bucket', () => {
    const issues: ImportIssue[] = []
    stitchPool(
      [
        makeSheet('buckets', ['resId', 'weight'], [{ resId: 'A', weight: 1 }]),
        makeSheet(
          'bucket_contents',
          ['boxResId', 'resId', 'weight'],
          [
            { boxResId: 'A', resId: 'a1', weight: 1 },
            { boxResId: 'GHOST', resId: 'g1', weight: 1 },
          ],
        ),
      ],
      issues,
    )
    expect(issues.some((i) => /GHOST/.test(i.message))).toBe(true)
  })

  it('auto-creates item entries for resIds referenced but missing in items table', () => {
    const issues: ImportIssue[] = []
    const pool = stitchPool(
      [
        makeSheet('buckets', ['resId', 'weight'], [{ resId: 'A', weight: 1 }]),
        makeSheet(
          'bucket_contents',
          ['boxResId', 'resId', 'weight'],
          [{ boxResId: 'A', resId: 'unknown-item', weight: 1 }],
        ),
      ],
      issues,
    )
    expect(pool).not.toBeNull()
    if (!pool) return
    const item = pool.items?.find((i) => i.resId === 'unknown-item')
    expect(item).toBeDefined()
    expect(item?.name).toBe('unknown-item')
  })

  it('parses firstDrawResId JSON into first-draw-script rule', () => {
    const sheets: SheetData[] = [
      makeSheet(
        'pool_row',
        ['id', 'desc', 'firstDrawResId'],
        [
          {
            id: '1',
            desc: 'pool',
            firstDrawResId: '[{"resId":"a1","number":1},{"resId":"a2","number":1}]',
          },
        ],
      ),
      makeSheet('buckets', ['resId', 'weight'], [{ resId: 'A', weight: 1 }]),
      makeSheet(
        'bucket_contents',
        ['boxResId', 'resId', 'weight'],
        [
          { boxResId: 'A', resId: 'a1', weight: 1 },
          { boxResId: 'A', resId: 'a2', weight: 1 },
        ],
      ),
    ]
    const issues: ImportIssue[] = []
    const pool = stitchPool(sheets, issues)
    expect(pool).not.toBeNull()
    if (!pool) return
    const script = pool.rules?.find((r) => r.type === 'first-draw-script')
    expect(script).toBeDefined()
    expect((script as { params: { script: unknown[] } }).params.script).toHaveLength(2)
  })
})
