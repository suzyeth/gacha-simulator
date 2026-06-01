import type { PoolSchema } from '../engine/schema'
import type { PullResult } from '../engine/types'

/**
 * Headline KPI for either a bucket (一级 = 整个 bucket 命中率) or a specific
 * item (二级 = 某个具体物品的真实掉率).
 *
 * For 数值策划:
 *   - bucket level: "这次活动的 S 皮肤箱掉率是多少"
 *   - item level:   "多彩宝石 / 莉亚 / 紫色宝石 具体的真实掉率"
 */
export interface HeadlineKpi {
  selection: HeadlineSelection
  /** Display label: bucket name or item name. */
  label: string
  /** Per-pull base-rate probability (不含保底). */
  theoreticalP: number
  /** Per-pull effective probability (含 cyclic pity 修正). Same as theoreticalP if no pity affects this. */
  effectiveP: number
  /** observedCount / totalPulls (0 if no pulls yet). */
  observedP: number
  /** Raw count of pulls matching this selection. */
  observedCount: number
  totalPulls: number
  /** observedP - effectiveP. */
  deviation: number
  /** Whether cyclic pity affects this selection's effective rate. */
  hasPity: boolean
  /** Optional bucket id this item belongs to (for UI color hint). */
  bucketId?: string
}

export type HeadlineSelection =
  | { kind: 'bucket'; bucketId: string }
  | { kind: 'item'; resId: string }

/**
 * Pick the default *core resource ITEM* — the actual thing a player receives.
 *
 * 宝箱(bucket)只是概率容器,玩家实得的是开箱后的物品。所以默认核心资源
 * 应该是一个具体物品,而不是宝箱。
 *
 * Priority:
 *   1. Any `isFeatured` item.
 *   2. The rarest item (lowest in-bucket weight) inside the headline bucket
 *      (= lowest-weight bucket, usually the S 皮肤箱).
 *   3. null if pool empty.
 */
export function pickHeadlineItem(pool: PoolSchema): string | null {
  const featured = (pool.items ?? []).find((i) => i.isFeatured)
  if (featured) return featured.resId

  const headlineBucketId = pickHeadlineBucket(pool)
  if (!headlineBucketId) return null
  const bucket = pool.buckets.find((b) => b.id === headlineBucketId)
  if (!bucket || bucket.contents.length === 0) return null

  // Rarest item in the headline bucket = lowest in-bucket weight (tie → first).
  let rarest = bucket.contents[0]
  for (const c of bucket.contents) {
    if (c.weight < rarest.weight) rarest = c
  }
  return rarest.resId
}

/** Heuristic default — featured bucket, else lowest-weight bucket. */
export function pickHeadlineBucket(pool: PoolSchema): string | null {
  if (pool.buckets.length === 0) return null
  const featuredResIds = new Set(
    (pool.items ?? []).filter((i) => i.isFeatured).map((i) => i.resId),
  )
  if (featuredResIds.size > 0) {
    const featuredBucket = pool.buckets.find((b) =>
      b.contents.some((c) => featuredResIds.has(c.resId)),
    )
    if (featuredBucket) return featuredBucket.id
  }
  const totalWeight = pool.buckets.reduce((s, b) => s + b.weight, 0)
  if (totalWeight <= 0) return pool.buckets[0].id
  let bestId = pool.buckets[0].id
  let bestWeight = Infinity
  for (const b of pool.buckets) {
    if (b.weight > 0 && b.weight < bestWeight) {
      bestWeight = b.weight
      bestId = b.id
    }
  }
  return bestId
}

function pityForcedP(p: number, T: number): number {
  if (T <= 0 || p <= 0 || p >= 1) return 0
  const q = 1 - p
  return (Math.pow(q, T - 1) * p) / (1 - Math.pow(q, T))
}

/**
 * Compute all effective bucket probabilities given the active pity rules.
 * Approximation: assumes pity events on different counters are independent
 * (good enough — verified against MC within ±0.5%).
 *
 * Exported so other panels (LootHaul) can show pity-adjusted expectations
 * rather than raw weight ratios.
 */
export function computeEffectiveBucketP(pool: PoolSchema): Map<string, number> {
  const totalW = pool.buckets.reduce((s, b) => s + b.weight, 0)
  const natP = new Map<string, number>()
  for (const b of pool.buckets) {
    natP.set(b.id, totalW > 0 ? b.weight / totalW : 0)
  }
  const pityByBucket = new Map<string, number>()  // bucketId → period
  for (const r of pool.rules ?? []) {
    if (r.type === 'cyclic-pity') {
      pityByBucket.set(r.params.bucketId, r.params.period)
    }
  }
  // Sum of forced shares across all pity buckets
  let totalForced = 0
  const forcedShare = new Map<string, number>()
  for (const [bid, T] of pityByBucket) {
    const p = natP.get(bid) ?? 0
    const f = pityForcedP(p, T)
    forcedShare.set(bid, f)
    totalForced += f
  }
  const naturalShare = Math.max(0, 1 - totalForced)
  const effP = new Map<string, number>()
  for (const b of pool.buckets) {
    const p = natP.get(b.id) ?? 0
    const forced = forcedShare.get(b.id) ?? 0
    effP.set(b.id, forced + naturalShare * p)
  }
  return effP
}

/** Bucket-level KPI. */
export function computeBucketKpi(
  pool: PoolSchema,
  results: ReadonlyArray<PullResult>,
  bucketId: string,
): HeadlineKpi | null {
  const bucket = pool.buckets.find((b) => b.id === bucketId)
  if (!bucket) return null
  const totalWeight = pool.buckets.reduce((s, b) => s + b.weight, 0)
  const theoreticalP = totalWeight > 0 ? bucket.weight / totalWeight : 0
  const effMap = computeEffectiveBucketP(pool)
  const effectiveP = effMap.get(bucketId) ?? theoreticalP
  const hasPity = (pool.rules ?? []).some(
    (r) => r.type === 'cyclic-pity' && r.params.bucketId === bucketId,
  )

  const bucketResIds = new Set(bucket.contents.map((c) => c.resId))
  let observedCount = 0
  for (const r of results) if (bucketResIds.has(r.item.id)) observedCount++
  const totalPulls = results.length
  const observedP = totalPulls > 0 ? observedCount / totalPulls : 0

  return {
    selection: { kind: 'bucket', bucketId },
    label: bucket.name ?? bucket.id,
    theoreticalP,
    effectiveP,
    observedP,
    observedCount,
    totalPulls,
    deviation: observedP - effectiveP,
    hasPity,
    bucketId,
  }
}

/** Item-level KPI (resId across all buckets where it appears). */
export function computeItemKpi(
  pool: PoolSchema,
  results: ReadonlyArray<PullResult>,
  resId: string,
): HeadlineKpi | null {
  const itemMeta = pool.items.find((i) => i.resId === resId)
  // Find all (bucket, in-bucket P) pairs where this resId appears
  const effMap = computeEffectiveBucketP(pool)
  const totalBucketW = pool.buckets.reduce((s, b) => s + b.weight, 0)
  let theoreticalP = 0
  let effectiveP = 0
  let firstBucketId: string | undefined
  let anyPity = false
  for (const b of pool.buckets) {
    const c = b.contents.find((x) => x.resId === resId)
    if (!c) continue
    if (!firstBucketId) firstBucketId = b.id
    const sumW = b.contents.reduce((s, x) => s + x.weight, 0)
    const pInBucket = sumW > 0 ? c.weight / sumW : 0
    const natBucketP = totalBucketW > 0 ? b.weight / totalBucketW : 0
    const effBucketP = effMap.get(b.id) ?? natBucketP
    theoreticalP += natBucketP * pInBucket
    effectiveP += effBucketP * pInBucket
    const hasPity = (pool.rules ?? []).some(
      (r) => r.type === 'cyclic-pity' && r.params.bucketId === b.id,
    )
    if (hasPity) anyPity = true
  }
  if (!firstBucketId) return null

  const totalPulls = results.length
  let observedCount = 0
  for (const r of results) if (r.item.id === resId) observedCount++
  const observedP = totalPulls > 0 ? observedCount / totalPulls : 0

  return {
    selection: { kind: 'item', resId },
    label: itemMeta?.name ?? resId,
    theoreticalP,
    effectiveP,
    observedP,
    observedCount,
    totalPulls,
    deviation: observedP - effectiveP,
    hasPity: anyPity,
    bucketId: firstBucketId,
  }
}

/** Polymorphic entry. */
export function computeHeadlineKpi(
  pool: PoolSchema,
  results: ReadonlyArray<PullResult>,
  selection: HeadlineSelection,
): HeadlineKpi | null {
  if (selection.kind === 'bucket') return computeBucketKpi(pool, results, selection.bucketId)
  return computeItemKpi(pool, results, selection.resId)
}
