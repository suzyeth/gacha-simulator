import type { PoolSchema } from '../engine/schema'
import type { PullResult } from '../engine/types'

export interface DistRow {
  id: string
  name: string
  bucketId: string
  color: string
  /** Times this item appeared in the results array. */
  observedCount: number
  /** Theoretical drop probability from raw bucket × content weights (ignores rules). */
  theoreticalP: number
}

/**
 * Build the rows shown by DistributionChart.
 *
 * Pure function — same inputs produce same outputs, no React or DOM access.
 * `theoreticalP` is the base rate computed from weights only; it ignores
 * cyclic-pity / first-draw-script rules. That intentionally matches what
 * users perceive as the "natural" drop chance shown in the pool editor.
 */
export function computeDistRows(
  pool: PoolSchema,
  results: ReadonlyArray<PullResult>,
): { rows: DistRow[]; totalPulls: number } {
  const counts = new Map<string, number>()
  for (const r of results) {
    counts.set(r.item.id, (counts.get(r.item.id) ?? 0) + 1)
  }

  const itemMeta = new Map(pool.items.map((i) => [i.resId, i]))
  const bucketColor = new Map(pool.buckets.map((b) => [b.id, b.color ?? '#888']))
  const totalBucketWeight = pool.buckets.reduce((s, b) => s + b.weight, 0)

  const rows: DistRow[] = []
  for (const bucket of pool.buckets) {
    const totalContentWeight = bucket.contents.reduce((s, c) => s + c.weight, 0)
    const pBucket = totalBucketWeight > 0 ? bucket.weight / totalBucketWeight : 0

    const bucketRows: DistRow[] = []
    for (const c of bucket.contents) {
      const meta = itemMeta.get(c.resId)
      const pItem =
        totalContentWeight > 0 ? pBucket * (c.weight / totalContentWeight) : 0
      bucketRows.push({
        id: c.resId,
        name: meta?.name ?? c.resId,
        bucketId: bucket.id,
        color: bucketColor.get(bucket.id) ?? '#888',
        observedCount: counts.get(c.resId) ?? 0,
        theoreticalP: pItem,
      })
    }
    bucketRows.sort((a, b) => b.theoreticalP - a.theoreticalP)
    rows.push(...bucketRows)
  }

  return { rows, totalPulls: results.length }
}
