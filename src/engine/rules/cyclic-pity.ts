import type { Rule } from './rule'

/**
 * Cyclic pity (A1 semantic — XM smallBaodi / bigBaodi convention).
 *
 * Rule: every `period` pulls form a sliding cycle. If bucket `bucketId`
 * hasn't dropped naturally during the first (period - 1) pulls of the
 * cycle, the period-th pull is forced to drop it. Natural drops reset
 * the counter.
 *
 * Pity is REPLACEMENT-style: the forced pull replaces what would have
 * been a random sample (single item per pull is preserved). This is the
 * mainstream 国内二游 convention (原神 / 方舟 / 公主 / 碧蓝 …).
 *
 * Note: the closed-form formula `random + 1/N` used in many design
 * spreadsheets is an APPROXIMATION. True E[T_drop] = (1 - (1-p)^N) / p
 * gives slightly lower per-pull probability — engine targets the true
 * value; deviation report vs spreadsheet formula is shown in the
 * gold-standard test.
 */
export const cyclicPity: Rule<{ period: number; bucketId: string }> = {
  type: 'cyclic-pity',
  forceRarity: (ctx, params) => {
    const since = ctx.state.pullsSinceRarity[params.bucketId] ?? 0
    return since >= params.period - 1 ? params.bucketId : null
  },
}
