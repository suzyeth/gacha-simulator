import { createInitialState, pull } from './simulator'
import type { PoolConfig, Rng } from './types'
import type { RuleRegistry } from './rules/rule'

/**
 * Simulate one player pulling until target item drops (or maxPulls cap).
 * State starts fresh — represents one new account.
 */
export function simulateUntilTarget(opts: {
  pool: PoolConfig
  targetResId: string
  maxPulls: number
  rng: Rng
  registry: RuleRegistry
}): { pullsToTarget: number; succeeded: boolean } {
  let state = createInitialState(opts.pool)
  for (let i = 1; i <= opts.maxPulls; i++) {
    const out = pull({
      pool: opts.pool,
      state,
      rng: opts.rng,
      registry: opts.registry,
    })
    state = out.state
    if (out.result.item.id === opts.targetResId) {
      return { pullsToTarget: i, succeeded: true }
    }
  }
  return { pullsToTarget: opts.maxPulls, succeeded: false }
}

/**
 * Run K independent player trials, each pulling until target (or cap).
 * Returns pulls-to-target distribution.
 *
 * This is the "1000 个玩家会怎么样" simulation — the answer to
 * tail-risk questions商业化数值策划 actually asks ("what does the
 * unlucky 10% look like?").
 */
export function multiTrialUntilTarget(opts: {
  pool: PoolConfig
  targetResId: string
  trials: number
  maxPulls: number
  rng: Rng
  registry: RuleRegistry
}): Array<{ pullsToTarget: number; succeeded: boolean }> {
  const out: Array<{ pullsToTarget: number; succeeded: boolean }> = []
  for (let t = 0; t < opts.trials; t++) {
    out.push(simulateUntilTarget(opts))
  }
  return out
}

/**
 * Percentile from a sorted ascending array of numbers.
 * Uses nearest-rank method (no interpolation).
 *
 * p must be in [0, 1]. p=0.5 → median.
 */
export function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return NaN
  if (p <= 0) return sortedAsc[0]
  if (p >= 1) return sortedAsc[sortedAsc.length - 1]
  const idx = Math.min(sortedAsc.length - 1, Math.ceil(p * sortedAsc.length) - 1)
  return sortedAsc[Math.max(0, idx)]
}

export interface TargetStats {
  count: number
  succeeded: number
  failed: number
  failureRate: number
  /** Pulls-to-target percentiles, computed over succeeded trials only. */
  p50: number
  p75: number
  p90: number
  p99: number
  mean: number
  min: number
  max: number
}

/** Summarize an array of trial outcomes. */
export function summarizeTrials(
  trials: Array<{ pullsToTarget: number; succeeded: boolean }>,
): TargetStats {
  const succeeded = trials
    .filter((t) => t.succeeded)
    .map((t) => t.pullsToTarget)
    .sort((a, b) => a - b)
  const failed = trials.length - succeeded.length
  if (succeeded.length === 0) {
    return {
      count: trials.length,
      succeeded: 0,
      failed,
      failureRate: 1,
      p50: NaN,
      p75: NaN,
      p90: NaN,
      p99: NaN,
      mean: NaN,
      min: NaN,
      max: NaN,
    }
  }
  return {
    count: trials.length,
    succeeded: succeeded.length,
    failed,
    failureRate: failed / trials.length,
    p50: percentile(succeeded, 0.5),
    p75: percentile(succeeded, 0.75),
    p90: percentile(succeeded, 0.9),
    p99: percentile(succeeded, 0.99),
    mean: succeeded.reduce((s, x) => s + x, 0) / succeeded.length,
    min: succeeded[0],
    max: succeeded[succeeded.length - 1],
  }
}
