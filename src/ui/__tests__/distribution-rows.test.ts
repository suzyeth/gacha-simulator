import { describe, expect, it } from 'vitest'
import { computeDistRows } from '../distribution-rows'
import type { PoolSchema } from '../../engine/schema'
import type { PullResult, Item } from '../../engine/types'

function buildPool(overrides: Partial<PoolSchema> = {}): PoolSchema {
  return {
    id: 'p1',
    name: 'p1',
    buckets: [
      {
        id: 'rare',
        kind: 'box',
        weight: 1,
        contents: [
          { resId: 'a', weight: 1, minCount: 1 },
          { resId: 'b', weight: 3, minCount: 1 },
        ],
      },
      {
        id: 'common',
        kind: 'box',
        weight: 99,
        contents: [{ resId: 'c', weight: 1, minCount: 1 }],
      },
    ],
    items: [
      { resId: 'a', name: 'Alpha', isFeatured: false },
      { resId: 'b', name: 'Beta', isFeatured: false },
      { resId: 'c', name: 'Filler', isFeatured: false },
    ],
    rules: [],
    ...overrides,
  } as PoolSchema
}

function mkResult(pullIndex: number, itemId: string): PullResult {
  const item: Item = { id: itemId, name: itemId, rarity: 'r' }
  return { pullIndex, item, rarity: 'r', triggeredRules: [] }
}

describe('computeDistRows', () => {
  it('returns one row per bucket content', () => {
    const { rows, totalPulls } = computeDistRows(buildPool(), [])
    expect(rows).toHaveLength(3)
    expect(totalPulls).toBe(0)
  })

  it('computes theoreticalP as bucket-prob × content-prob', () => {
    const { rows } = computeDistRows(buildPool(), [])
    const byId = new Map(rows.map((r) => [r.id, r]))
    expect(byId.get('a')!.theoreticalP).toBeCloseTo((1 / 100) * (1 / 4), 8)
    expect(byId.get('b')!.theoreticalP).toBeCloseTo((1 / 100) * (3 / 4), 8)
    expect(byId.get('c')!.theoreticalP).toBeCloseTo(99 / 100, 8)
    const sum = rows.reduce((s, r) => s + r.theoreticalP, 0)
    expect(sum).toBeCloseTo(1, 8)
  })

  it('counts observed pulls per item id', () => {
    const results: PullResult[] = [
      mkResult(1, 'a'),
      mkResult(2, 'b'),
      mkResult(3, 'b'),
      mkResult(4, 'c'),
    ]
    const { rows, totalPulls } = computeDistRows(buildPool(), results)
    const byId = new Map(rows.map((r) => [r.id, r]))
    expect(byId.get('a')!.observedCount).toBe(1)
    expect(byId.get('b')!.observedCount).toBe(2)
    expect(byId.get('c')!.observedCount).toBe(1)
    expect(totalPulls).toBe(4)
  })

  it('orders rows by theoreticalP within each bucket', () => {
    const { rows } = computeDistRows(buildPool(), [])
    const rare = rows.filter((r) => r.bucketId === 'rare')
    expect(rare.map((r) => r.id)).toEqual(['b', 'a'])
  })

  it('falls back to color #888 and name=resId when missing', () => {
    const pool = buildPool({
      buckets: [
        {
          id: 'x',
          kind: 'box',
          weight: 1,
          contents: [{ resId: 'orphan', weight: 1, minCount: 1 }],
        },
      ],
      items: [],
    } as Partial<PoolSchema>)
    const { rows } = computeDistRows(pool, [])
    expect(rows[0].color).toBe('#888')
    expect(rows[0].name).toBe('orphan')
  })

  it('handles zero bucket-weight without dividing by zero', () => {
    const pool = buildPool({
      buckets: [
        {
          id: 'z',
          kind: 'box',
          weight: 0,
          contents: [{ resId: 'a', weight: 1, minCount: 1 }],
        },
      ],
    } as Partial<PoolSchema>)
    const { rows } = computeDistRows(pool, [])
    expect(rows[0].theoreticalP).toBe(0)
  })
})
