/**
 * Generic xlsx → PoolSchema adapter.
 *
 * Designed for中国二游策划表 convention:
 *   R01 = filename hint (e.g., "skinBox.json")
 *   R03 = 中文列名 (human-facing)
 *   R04 = 中文备注
 *   R05 = English field name (the code key — `resId`, `weight`, ...)
 *   R06 = type (int / string / json)
 *   R07+ = data
 *
 * Pipeline:
 *   1. Parse all xlsx files → list of sheets
 *   2. Detect header row (prefer R05-style English identifiers; fall back to first non-empty row)
 *   3. Classify sheet by field signature → role (pool_row / buckets / bucket_contents / items / draw_modes / unclassified)
 *   4. Stitch classified sheets into a single PoolSchema
 *
 * Lenient by design: surfaces issues as warnings (don't block import unless
 * the result is unusable).
 */

import * as XLSX from 'xlsx'
import type { z } from 'zod'
import { PoolSchema } from '../engine/schema'

type PoolInput = z.input<typeof PoolSchema>

// ─────────────────────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────────────────────

export type SheetRole =
  | 'pool_row'
  | 'buckets'
  | 'bucket_contents'
  | 'items'
  | 'draw_modes'
  | 'unclassified'

export interface SheetData {
  fileName: string
  sheetName: string
  rawRows: unknown[][]
  headerRowIdx: number
  fields: string[]
  /** dataRows[i][fieldName] = cell value. Empty if header not detected. */
  dataRows: Array<Record<string, unknown>>
  role: SheetRole
}

export interface ImportIssue {
  severity: 'error' | 'warning' | 'info'
  message: string
  context?: string
}

export interface ImportResult {
  /** Parsed pool ready to feed into config store (null if stitching failed). */
  pool: PoolInput | null
  /** Issues for UI surface — warnings + errors. */
  issues: ImportIssue[]
  /** Per-sheet classification for the preview UI. */
  sheets: SheetData[]
}

// ─────────────────────────────────────────────────────────────────────────────
//  Field name canonicalization
//
//  Maps both English (R05) and Chinese (R03 / R02) column names to a single
//  canonical English identifier so both header styles classify identically.
//  Extend this map when encountering new column names in real configs.
// ─────────────────────────────────────────────────────────────────────────────

const FIELD_SYNONYMS: Record<string, string> = {
  // English identifiers (passthrough)
  resId: 'resId',
  id: 'id',
  name: 'name',
  weight: 'weight',
  boxResId: 'boxResId',
  probability: 'probability',
  type: 'type',
  quality: 'quality',
  desc: 'desc',
  minNumber: 'minNumber',
  maxNumber: 'maxNumber',
  showPer: 'showPer',
  smallBaodi: 'smallBaodi',
  bigBaodi: 'bigBaodi',
  ticketDrawResId: 'ticketDrawResId',
  ticketDrawCostNum: 'ticketDrawCostNum',
  normalDrawResId: 'normalDrawResId',
  normalOneDrawCostNum: 'normalOneDrawCostNum',
  normalTenDrawCostNum: 'normalTenDrawCostNum',
  freeTimes: 'freeTimes',
  firstDrawResId: 'firstDrawResId',
  processBox: 'processBox',
  limit: 'limit',
  rewards: 'rewards',
  costResId: 'costResId',
  costPerOne: 'costPerOne',
  costPerTen: 'costPerTen',
  dailyTimes: 'dailyTimes',
  dailyLimit: 'dailyLimit',
  tier: 'tier',
  step: 'step',
  roleId: 'roleId',

  // Chinese / mixed → canonical English (curated from real XM tables)
  '物品ID': 'resId',
  '物品id': 'resId',
  '物品Id': 'resId',
  resID: 'resId',
  '物品名称': 'name',
  名称: 'name',
  '宝箱名称': 'name',
  '宝箱编号': 'boxResId',
  '宝箱ID': 'boxResId',
  '宝箱id': 'boxResId',
  权重: 'weight',
  '物品权重': 'weight',
  '权重 quality': 'weight',
  概率: 'probability',
  '概率（公式）': 'probability',
  '概率(公式)': 'probability',
  类型: 'type',
  品质: 'quality',
  描述: 'desc',
  备注: 'notes',
  阶位: 'tier',
  '阶位/物品ID': 'tier',
  阶级: 'step',
  '角色id': 'roleId',
}

const CANONICAL_FIELDS = new Set(Object.values(FIELD_SYNONYMS))

/** Map a raw header cell to a canonical field name (or return the cell text if unrecognized). */
export function normalizeField(raw: unknown): string {
  if (raw == null) return ''
  const trimmed = String(raw).trim()
  if (!trimmed) return ''
  if (FIELD_SYNONYMS[trimmed]) return FIELD_SYNONYMS[trimmed]
  return trimmed
}

// ─────────────────────────────────────────────────────────────────────────────
//  Header detection
// ─────────────────────────────────────────────────────────────────────────────

const ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/

/**
 * Words used in R06 (type marker row, e.g. "int", "string", "json"). Filtered
 * out from English-identifier scoring so a row of type names doesn't outscore
 * the real R05 English header.
 */
const TYPE_WORDS = new Set([
  'int',
  'long',
  'string',
  'json',
  'float',
  'double',
  'bool',
  'boolean',
  'number',
  'short',
  'byte',
])

/**
 * Pick the row most likely to be a header by scoring candidates:
 *   +1 per cell that maps to a known canonical field (English or Chinese)
 *   +3 per cell that is a bare English identifier (R05 preference tie-breaker)
 *   — type-marker words ("int" / "string" / "json" ...) explicitly excluded
 *
 * Skips banner rows (single non-empty cell). Returns headerRowIdx = -1 if no
 * row scores ≥ 3.
 */
export function detectHeader(rows: unknown[][]): {
  headerRowIdx: number
  fields: string[]
} {
  const SCAN_LIMIT = Math.min(12, rows.length)
  let best: { idx: number; score: number; fields: string[] } = {
    idx: -1,
    score: 0,
    fields: [],
  }

  for (let i = 0; i < SCAN_LIMIT; i++) {
    const row = rows[i]
    if (!Array.isArray(row)) continue
    const cells = row.map((c) => (c == null ? '' : String(c).trim()))
    const nonEmpty = cells.filter(Boolean).length
    if (nonEmpty < 2) continue // banner / blank
    // If this row looks like a type-marker row, skip it entirely.
    const typeWordCount = cells.filter((c) => TYPE_WORDS.has(c.toLowerCase())).length
    if (typeWordCount >= Math.max(2, nonEmpty * 0.5)) continue
    const normalized = cells.map((c) => normalizeField(c))
    const canonical = normalized.filter((n) => CANONICAL_FIELDS.has(n)).length
    const englishOnly = cells.filter(
      (c) => ID_PATTERN.test(c) && !TYPE_WORDS.has(c.toLowerCase()),
    ).length
    const score = canonical + englishOnly * 3
    if (score > best.score) {
      best = { idx: i, score, fields: normalized }
    }
  }

  if (best.idx === -1 || best.score < 3) {
    return { headerRowIdx: -1, fields: [] }
  }
  return { headerRowIdx: best.idx, fields: best.fields }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Classification
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determine sheet role from the set of detected field names.
 *
 * Heuristic priority (first match wins):
 *   pool_row   — has smallBaodi / bigBaodi / ticketDrawResId / firstDrawResId
 *   bucket_contents — has boxResId AND (resId OR probability OR weight)
 *   buckets    — has resId AND weight, NO boxResId
 *   items      — has resId AND name, NO weight
 *   draw_modes — has costResId OR costPerOne
 *   unclassified — none of the above
 */
export function classifySheet(fields: string[]): SheetRole {
  const has = (n: string) => fields.includes(n)
  if (
    has('smallBaodi') ||
    has('bigBaodi') ||
    has('ticketDrawResId') ||
    has('firstDrawResId')
  ) {
    return 'pool_row'
  }
  if (has('boxResId') && (has('resId') || has('probability') || has('weight'))) {
    return 'bucket_contents'
  }
  if (has('resId') && has('weight') && !has('boxResId')) {
    return 'buckets'
  }
  if (has('resId') && has('name') && !has('weight') && !has('boxResId')) {
    return 'items'
  }
  if (has('costResId') || has('costPerOne')) {
    return 'draw_modes'
  }
  return 'unclassified'
}

// ─────────────────────────────────────────────────────────────────────────────
//  xlsx file → SheetData[]
// ─────────────────────────────────────────────────────────────────────────────

/** A file buffer + name pair. Decouples the parser from the browser File API
 *  so Node tests can drive the same pipeline. */
export interface SheetSource {
  name: string
  buffer: ArrayBuffer | Uint8Array
}

export async function extractSheets(
  sources: ReadonlyArray<File | SheetSource>,
): Promise<SheetData[]> {
  const out: SheetData[] = []
  for (const src of sources) {
    let buffer: ArrayBuffer | Uint8Array
    let fileName: string
    if (src instanceof File || (typeof File !== 'undefined' && src instanceof File)) {
      buffer = await (src as File).arrayBuffer()
      fileName = (src as File).name
    } else if ('buffer' in src && 'name' in src) {
      buffer = src.buffer
      fileName = src.name
    } else if ('arrayBuffer' in src && typeof (src as File).arrayBuffer === 'function') {
      buffer = await (src as File).arrayBuffer()
      fileName = (src as File).name
    } else {
      throw new Error(
        `extractSheets: unsupported source — needs File or { name, buffer }`,
      )
    }
    const wb = XLSX.read(buffer, { type: 'array' })
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName]
      const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        blankrows: false,
        defval: null,
      })
      const { headerRowIdx, fields } = detectHeader(rawRows)
      let dataRows: Array<Record<string, unknown>> = []
      if (headerRowIdx >= 0) {
        // Skip the next 1-2 rows after R05 (R06 = type row in中国二游 convention).
        // Heuristic: if the row right after the header is all short non-data
        // strings like "int" / "string" / "long" / "json", it's a type row.
        let dataStart = headerRowIdx + 1
        const typeRow = rawRows[dataStart]
        if (Array.isArray(typeRow)) {
          const tcells = typeRow.map((c) => (c == null ? '' : String(c).trim()))
          const typeWords = ['int', 'long', 'string', 'json', 'float', 'double', 'bool']
          const typeCount = tcells.filter((c) => typeWords.includes(c.toLowerCase())).length
          if (typeCount >= Math.max(1, tcells.filter(Boolean).length * 0.5)) {
            dataStart++
          }
        }
        dataRows = rawRows.slice(dataStart).map((row) =>
          Object.fromEntries(
            fields.map((f, i) => [f, Array.isArray(row) ? row[i] : null]),
          ),
        )
        // Drop rows that are entirely null/empty
        dataRows = dataRows.filter((r) =>
          Object.values(r).some((v) => v !== null && v !== undefined && v !== ''),
        )
      }
      const role = headerRowIdx >= 0 ? classifySheet(fields) : 'unclassified'
      out.push({
        fileName,
        sheetName,
        rawRows,
        headerRowIdx,
        fields,
        dataRows,
        role,
      })
    }
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
//  Stitching
// ─────────────────────────────────────────────────────────────────────────────

function toStr(v: unknown): string | undefined {
  if (v == null || v === '') return undefined
  return String(v).trim()
}

function toNum(v: unknown): number | undefined {
  if (v == null || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

function tryParseJson(v: unknown): unknown {
  const s = toStr(v)
  if (!s) return undefined
  try {
    return JSON.parse(s)
  } catch {
    return undefined
  }
}

/**
 * Build a PoolInput from classified sheets.
 *
 * Required: at least 1 buckets sheet AND at least 1 bucket_contents sheet.
 * pool_row, items, draw_modes are optional but recommended.
 */
export function stitchPool(
  sheets: SheetData[],
  issues: ImportIssue[],
): PoolInput | null {
  const sheetsByRole = (role: SheetRole) => sheets.filter((s) => s.role === role)

  const poolRows = sheetsByRole('pool_row')
  const bucketsSheets = sheetsByRole('buckets')
  const contentsSheets = sheetsByRole('bucket_contents')
  const itemsSheets = sheetsByRole('items')
  const drawModesSheets = sheetsByRole('draw_modes')

  if (bucketsSheets.length === 0) {
    issues.push({
      severity: 'error',
      message:
        '没找到 buckets 表（应有 resId + weight 字段、无 boxResId）。无法构造池子。',
    })
    return null
  }
  if (contentsSheets.length === 0) {
    issues.push({
      severity: 'error',
      message:
        '没找到 bucket_contents 表（应有 boxResId + resId + weight/probability）。无法构造池子。',
    })
    return null
  }

  // — Pool metadata —
  const poolRow = poolRows[0]?.dataRows[0]
  const poolId =
    toStr(poolRow?.id) ?? `imported-${Date.now()}`
  const poolName =
    toStr(poolRow?.desc) ??
    toStr(poolRow?.name) ??
    poolRows[0]?.fileName.replace(/\.xlsx?$/i, '') ??
    '导入方案'

  if (poolRows.length > 1) {
    issues.push({
      severity: 'warning',
      message: `检测到 ${poolRows.length} 个 pool_row 表；取第一个 (${poolRows[0].fileName} · ${poolRows[0].sheetName})`,
    })
  }

  // — Buckets —
  const bucketsRaw: Array<Record<string, unknown>> = bucketsSheets.flatMap(
    (s) => s.dataRows,
  )

  type BucketAcc = {
    id: string
    name?: string
    weight: number
    contents: Array<{ resId: string; weight: number }>
  }
  const bucketMap = new Map<string, BucketAcc>()
  for (const row of bucketsRaw) {
    const id = toStr(row.resId)
    const weight = toNum(row.weight ?? row['权重'] ?? row['权重 quality'])
    if (!id || weight == null) {
      issues.push({
        severity: 'warning',
        message: `buckets 表里跳过一行：缺 resId 或 weight (resId=${id ?? '?'})`,
      })
      continue
    }
    if (bucketMap.has(id)) {
      issues.push({
        severity: 'warning',
        message: `buckets 重复 resId=${id}，保留首次出现的`,
      })
      continue
    }
    bucketMap.set(id, {
      id,
      name: toStr(row.name) ?? toStr(row['物品名称']),
      weight,
      contents: [],
    })
  }

  // — Bucket contents (二级开箱) — group by boxResId
  const orphanCounts = new Map<string, number>()
  for (const sheet of contentsSheets) {
    for (const row of sheet.dataRows) {
      const boxId = toStr(row.boxResId)
      const resId = toStr(row.resId)
      const weight =
        toNum(row.weight) ??
        toNum(row.probability) ??
        toNum(row['概率']) ??
        toNum(row['权重'])
      if (!boxId || !resId || weight == null) {
        continue
      }
      const bucket = bucketMap.get(boxId)
      if (!bucket) {
        orphanCounts.set(boxId, (orphanCounts.get(boxId) ?? 0) + 1)
        continue
      }
      bucket.contents.push({ resId, weight })
    }
  }
  // Aggregate orphan warnings: one line per unrelated bucket instead of N lines
  if (orphanCounts.size > 0) {
    const totalRows = Array.from(orphanCounts.values()).reduce((s, n) => s + n, 0)
    const sample = Array.from(orphanCounts.keys()).slice(0, 5).join(', ')
    const more = orphanCounts.size > 5 ? ` 等 ${orphanCounts.size} 个` : ''
    issues.push({
      severity: 'info',
      message: `跳过了 ${totalRows} 行 bucket_contents (引用了非本池子的 ${orphanCounts.size} 个无关 bucket: ${sample}${more})`,
    })
  }

  // Drop buckets with empty contents (engine requires min 1)
  const validBuckets = Array.from(bucketMap.values()).filter((b) => {
    if (b.contents.length === 0) {
      issues.push({
        severity: 'warning',
        message: `bucket ${b.id} 没有任何内容物条目，已丢弃`,
      })
      return false
    }
    return true
  })

  if (validBuckets.length === 0) {
    issues.push({
      severity: 'error',
      message: '所有 bucket 都没有有效的 contents，无法构造池子',
    })
    return null
  }

  // — Items metadata —
  const itemMap = new Map<string, { resId: string; name: string; type?: string; quality?: string }>()
  for (const sheet of itemsSheets) {
    for (const row of sheet.dataRows) {
      const resId = toStr(row.resId)
      const name = toStr(row.name) ?? toStr(row['物品名称'])
      if (!resId) continue
      if (!itemMap.has(resId)) {
        itemMap.set(resId, {
          resId,
          name: name ?? resId,
          type: toStr(row.type) ?? toStr(row['类型']),
          quality: toStr(row.quality) ?? toStr(row['品质']),
        })
      }
    }
  }

  // Auto-add items referenced by bucket contents but missing from items table
  for (const b of validBuckets) {
    for (const c of b.contents) {
      if (!itemMap.has(c.resId)) {
        itemMap.set(c.resId, { resId: c.resId, name: c.resId })
      }
    }
  }

  // — Draw modes —
  const drawModes: Array<{
    id: string
    label?: string
    costResId?: string
    costPerOne?: number
    costPerTen?: number
  }> = []
  for (const sheet of drawModesSheets) {
    for (const row of sheet.dataRows) {
      const id = toStr(row.id)
      if (!id) continue
      drawModes.push({
        id,
        label: toStr(row.label),
        costResId: toStr(row.costResId),
        costPerOne: toNum(row.costPerOne),
        costPerTen: toNum(row.costPerTen),
      })
    }
  }
  // Synthesize draw modes from pool_row if no dedicated draw_modes sheet
  if (drawModes.length === 0 && poolRow) {
    const normalCost = toStr(poolRow.normalDrawResId)
    const normalOne = toNum(poolRow.normalOneDrawCostNum)
    const normalTen = toNum(poolRow.normalTenDrawCostNum)
    if (normalCost) {
      drawModes.push({
        id: 'normal',
        label: '普通抽',
        costResId: normalCost,
        costPerOne: normalOne ?? 0,
        costPerTen: normalTen ?? 0,
      })
    }
    const ticketCost = toStr(poolRow.ticketDrawResId)
    const ticketNum = toNum(poolRow.ticketDrawCostNum)
    if (ticketCost) {
      drawModes.push({
        id: 'ticket',
        label: '用券抽',
        costResId: ticketCost,
        costPerOne: ticketNum ?? 1,
        costPerTen: (ticketNum ?? 1) * 10,
      })
    }
  }

  // — Rules synthesized from pool_row —
  const rules: PoolInput['rules'] = []
  if (poolRow) {
    const smallId = toStr(poolRow.smallBaodi)
    if (smallId && bucketMap.has(smallId)) {
      rules.push({
        type: 'cyclic-pity',
        params: { period: 10, bucketId: smallId },
      })
    } else if (smallId) {
      issues.push({
        severity: 'warning',
        message: `smallBaodi 引用未知 bucket ${smallId}，规则跳过`,
      })
    }
    const bigId = toStr(poolRow.bigBaodi)
    if (bigId && bucketMap.has(bigId)) {
      rules.push({
        type: 'cyclic-pity',
        params: { period: 50, bucketId: bigId },
      })
    } else if (bigId) {
      issues.push({
        severity: 'warning',
        message: `bigBaodi 引用未知 bucket ${bigId}，规则跳过`,
      })
    }
    const firstDraw = tryParseJson(poolRow.firstDrawResId)
    if (Array.isArray(firstDraw) && firstDraw.length > 0) {
      const script = firstDraw
        .map((entry) => {
          if (entry && typeof entry === 'object' && 'resId' in entry) {
            const e = entry as Record<string, unknown>
            const resId = toStr(e.resId)
            const count = toNum(e.number) ?? toNum(e.count) ?? 1
            return resId ? { resId, count } : null
          }
          return null
        })
        .filter((v): v is { resId: string; count: number } => v !== null)
      if (script.length > 0) {
        rules.push({ type: 'first-draw-script', params: { script } })
      }
    }
    if (rules.length === 0) {
      issues.push({
        severity: 'info',
        message:
          '未从 pool_row 推断出规则（缺 smallBaodi/bigBaodi/firstDrawResId）。如需保底，手动编辑方案添加规则。',
      })
    } else {
      issues.push({
        severity: 'info',
        message:
          '保底周期采用约定值：smallBaodi=10，bigBaodi=50。如果你们项目周期不同，请手动编辑方案。',
      })
    }
  }

  // Assemble
  return {
    id: poolId,
    name: poolName,
    description: `从 ${sheets.map((s) => s.fileName).filter((v, i, a) => a.indexOf(v) === i).join(' / ')} 导入`,
    buckets: validBuckets.map((b) => ({
      id: b.id,
      name: b.name,
      kind: 'box',
      weight: b.weight,
      contents: b.contents,
    })),
    items: Array.from(itemMap.values()),
    drawModes,
    rules,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Top-level orchestration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Import a set of xlsx files. Returns parsed pool + per-sheet classification
 * + issues. Caller should pass the pool through PoolSchema.safeParse before
 * storing.
 */
export async function importXlsxFiles(
  files: ReadonlyArray<File | SheetSource>,
): Promise<ImportResult> {
  const issues: ImportIssue[] = []
  if (files.length === 0) {
    return { pool: null, issues: [{ severity: 'error', message: '未选择任何文件' }], sheets: [] }
  }
  const sheets = await extractSheets(files)
  if (sheets.length === 0) {
    return {
      pool: null,
      issues: [{ severity: 'error', message: 'xlsx 解析后没有任何 sheet' }],
      sheets,
    }
  }
  const pool = stitchPool(sheets, issues)
  if (pool) {
    const bucketCount = pool.buckets.length
    const itemCount = pool.items?.length ?? 0
    const ruleCount = pool.rules?.length ?? 0
    issues.push({
      severity: 'info',
      message: `已解析 ${sheets.length} 个 sheet → 池子有 ${bucketCount} 个 bucket / ${itemCount} 个物品 / ${ruleCount} 条规则`,
    })
  }
  return { pool, issues, sheets }
}
