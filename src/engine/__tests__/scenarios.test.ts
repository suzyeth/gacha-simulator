import { describe, it, expect } from 'vitest'
import {
  simulateUntilTarget,
  multiTrialUntilTarget,
  percentile,
  summarizeTrials,
} from '../scenarios'
import { adaptToEngine } from '../adapter'
import { defaultRegistry } from '../rules/registry'
import type { PoolSchema } from '../schema'

const easyPool: PoolSchema = {
  id: 'easy',
  name: 'easy',
  buckets: [
    {
      id: 'A',
      kind: 'box',
      weight: 1, // 100% drops A
      contents: [{ resId: 'gold', weight: 1, minCount: 1 }],
    },
  ],
  items: [{ resId: 'gold', name: 'Gold', isFeatured: false }],
  drawModes: [],
  rules: [],
}

const noopPool: PoolSchema = {
  id: 'noop',
  name: 'noop',
  buckets: [
    {
      id: 'A',
      kind: 'box',
      weight: 1,
      contents: [{ resId: 'iron', weight: 1, minCount: 1 }],
    },
  ],
  items: [
    { resId: 'iron', name: 'Iron', isFeatured: false },
    { resId: 'gold', name: 'Gold', isFeatured: false }, // never appears in any bucket
  ],
  drawModes: [],
  rules: [],
}

describe('percentile', () => {
  it('returns NaN for empty array', () => {
    expect(percentile([], 0.5)).toBeNaN()
  })

  it('returns min for p=0, max for p=1', () => {
    expect(percentile([1, 2, 3, 4, 5], 0)).toBe(1)
    expect(percentile([1, 2, 3, 4, 5], 1)).toBe(5)
  })

  it('returns median for p=0.5', () => {
    expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3)
  })

  it('returns 90th percentile correctly', () => {
    const arr = Array.from({ length: 100 }, (_, i) => i + 1) // 1..100
    expect(percentile(arr, 0.9)).toBe(90)
    expect(percentile(arr, 0.99)).toBe(99)
  })
})

describe('simulateUntilTarget', () => {
  it('returns 1 when first pull is the target', () => {
    const engine = adaptToEngine(easyPool)
    const result = simulateUntilTarget({
      pool: engine,
      targetResId: 'gold',
      maxPulls: 100,
      rng: () => 0.5,
      registry: defaultRegistry,
    })
    expect(result.succeeded).toBe(true)
    expect(result.pullsToTarget).toBe(1)
  })

  it('returns maxPulls + failed when target never drops', () => {
    const engine = adaptToEngine(noopPool)
    const result = simulateUntilTarget({
      pool: engine,
      targetResId: 'gold', // not in any bucket
      maxPulls: 50,
      rng: () => 0.5,
      registry: defaultRegistry,
    })
    expect(result.succeeded).toBe(false)
    expect(result.pullsToTarget).toBe(50)
  })
})

describe('multiTrialUntilTarget', () => {
  it('runs N trials', () => {
    const engine = adaptToEngine(easyPool)
    const trials = multiTrialUntilTarget({
      pool: engine,
      targetResId: 'gold',
      trials: 100,
      maxPulls: 50,
      rng: () => 0.5,
      registry: defaultRegistry,
    })
    expect(trials).toHaveLength(100)
    for (const t of trials) {
      expect(t.succeeded).toBe(true)
      expect(t.pullsToTarget).toBe(1)
    }
  })
})

describe('summarizeTrials', () => {
  it('summarizes percentiles correctly on uniform distribution', () => {
    // 100 trials all succeeded with pulls 1..100
    const trials = Array.from({ length: 100 }, (_, i) => ({
      pullsToTarget: i + 1,
      succeeded: true,
    }))
    const stats = summarizeTrials(trials)
    expect(stats.count).toBe(100)
    expect(stats.succeeded).toBe(100)
    expect(stats.failed).toBe(0)
    expect(stats.failureRate).toBe(0)
    expect(stats.p50).toBe(50)
    expect(stats.p90).toBe(90)
    expect(stats.p99).toBe(99)
    expect(stats.min).toBe(1)
    expect(stats.max).toBe(100)
    expect(stats.mean).toBeCloseTo(50.5)
  })

  it('reports failureRate when some trials cap out', () => {
    const trials = [
      { pullsToTarget: 10, succeeded: true },
      { pullsToTarget: 20, succeeded: true },
      { pullsToTarget: 30, succeeded: true },
      { pullsToTarget: 100, succeeded: false },
      { pullsToTarget: 100, succeeded: false },
    ]
    const stats = summarizeTrials(trials)
    expect(stats.failed).toBe(2)
    expect(stats.failureRate).toBeCloseTo(2 / 5)
    expect(stats.succeeded).toBe(3)
    expect(stats.p50).toBe(20) // nearest-rank median of [10, 20, 30]
  })

  it('returns NaN percentiles when all trials fail', () => {
    const trials = [
      { pullsToTarget: 100, succeeded: false },
      { pullsToTarget: 100, succeeded: false },
    ]
    const stats = summarizeTrials(trials)
    expect(stats.failureRate).toBe(1)
    expect(stats.p50).toBeNaN()
  })
})
