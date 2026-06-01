import { describe, expect, it } from 'vitest'
import {
  pickHeadlineBucket,
  computeHeadlineKpi,
} from '../headline-drop-rate'
import type { PoolSchema } from '../../engine/schema'
import type { Item, PullResult } from '../../engine/types'

function pool(overrides: Partial<PoolSchema> = {}): PoolSchema {
  return {
    id: 'p',
    name: 'p',
    buckets: [
      {
        id: 'hero',
        name: 'Hero Box',
        kind: 'box',
        weight: 0.03,
        contents: [{ resId: 'h1', weight: 1, minCount: 1 }],
      },
      {
        id: 'common',
        name: 'Common',
        kind: 'box',
        weight: 70,
        contents: [{ resId: 'c1', weight: 1, minCount: 1 }],
      },
    ],
    items: [
      { resId: 'h1', name: 'Hero 01', isFeatured: false },
      { resId: 'c1', name: 'Filler', isFeatured: false },
    ],
    rules: [],
    ...overrides,
  } as PoolSchema
}

function pull(id: string, idx = 1): PullResult {
  const item: Item = { id, name: id, rarity: 'r' }
  return { pullIndex: idx, item, rarity: 'r', triggeredRules: [] }
}

describe('pickHeadlineBucket', () => {
  it('picks the lowest-weight bucket when nothing is featured', () => {
    expect(pickHeadlineBucket(pool())).toBe('hero')
  })

  it('prefers a bucket that contains a featured item', () => {
    const p = pool({
      items: [
        { resId: 'h1', name: 'Hero 01', isFeatured: false },
        { resId: 'c1', name: 'Filler', isFeatured: true },
      ],
    } as Partial<PoolSchema>)
    expect(pickHeadlineBucket(p)).toBe('common')
  })

  it('skips zero-weight buckets when picking by weight', () => {
    const p = pool({
      buckets: [
        {
          id: 'zero',
          name: 'Zero',
          kind: 'box',
          weight: 0,
          contents: [{ resId: 'z', weight: 1, minCount: 1 }],
        },
        ...pool().buckets,
      ],
    } as Partial<PoolSchema>)
    expect(pickHeadlineBucket(p)).toBe('hero')
  })

  it('returns null on empty pool', () => {
    const p = pool({ buckets: [] } as Partial<PoolSchema>)
    expect(pickHeadlineBucket(p)).toBeNull()
  })
})

describe('computeHeadlineKpi', () => {
  it('reports theoretical P from raw bucket weight ratio', () => {
    const kpi = computeHeadlineKpi(pool(), [], { kind: 'bucket', bucketId: 'hero' })!
    expect(kpi.theoreticalP).toBeCloseTo(0.03 / 70.03, 8)
    expect(kpi.observedCount).toBe(0)
    expect(kpi.observedP).toBe(0)
    expect(kpi.totalPulls).toBe(0)
    expect(kpi.deviation).toBeCloseTo(-kpi.theoreticalP, 8)
  })

  it('counts only pulls whose item is inside the bucket', () => {
    const results = [pull('h1'), pull('c1'), pull('c1'), pull('h1')]
    const kpi = computeHeadlineKpi(pool(), results, { kind: 'bucket', bucketId: 'hero' })!
    expect(kpi.observedCount).toBe(2)
    expect(kpi.totalPulls).toBe(4)
    expect(kpi.observedP).toBeCloseTo(0.5, 8)
    expect(kpi.deviation).toBeCloseTo(0.5 - kpi.theoreticalP, 8)
  })

  it('returns null for an unknown bucketId', () => {
    expect(computeHeadlineKpi(pool(), [], { kind: 'bucket', bucketId: 'nope' })).toBeNull()
  })
})
