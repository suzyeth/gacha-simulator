import type { Rule } from './rule'
import type { Rarity } from '../types'

/**
 * First-draw script (XM `firstDrawResId` convention).
 *
 * For the first `script.length` pulls on a fresh account, deliver the
 * scripted items in order, overriding RNG. After the script is exhausted,
 * normal RNG resumes.
 *
 * D1+D4 semantics:
 *  - Scripted pulls increment totalPulls and consume cost / daily-limit
 *    budgets (handled by the simulator's normal totalPulls advance).
 *  - Scripted pulls do NOT reset bucket pity counters — all counters
 *    increment uniformly. This means cyclic-pity for the scripted
 *    item's bucket still fires on schedule, regardless of whether the
 *    script happened to deliver an item from that bucket.
 *
 * Achieved by:
 *  - `forceRarity` returning the bucket the scripted item belongs to,
 *    so rarity sampling picks the right bucket.
 *  - `selectItem` returning `{ item, affectsBucketCounters: false }` so
 *    the simulator's state-update step all-increments (no reset).
 */
export const firstDrawScript: Rule<{
  script: { resId: string; count?: number }[]
}> = {
  type: 'first-draw-script',
  forceRarity: (ctx, params): Rarity | null => {
    if (ctx.pullIndex > params.script.length) return null
    const scriptedResId = params.script[ctx.pullIndex - 1].resId
    const item = ctx.pool.items.find((i) => i.id === scriptedResId)
    if (!item) {
      throw new Error(
        `first-draw-script: scripted resId "${scriptedResId}" not found in pool items`,
      )
    }
    return item.rarity
  },
  selectItem: (_rarity, items, ctx, params) => {
    if (ctx.pullIndex > params.script.length) return null
    const scriptedResId = params.script[ctx.pullIndex - 1].resId
    const item = items.find((i) => i.id === scriptedResId)
    if (!item) return null
    return { item, affectsBucketCounters: false }
  },
}
