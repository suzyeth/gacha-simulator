import { describe, it, expect } from 'vitest'
import { adaptToEngine } from '../adapter'
import type { PoolSchema } from '../schema'

describe('adaptToEngine', () => {
  const sample: PoolSchema = {
    id: 'sample',
    name: 'Sample Pool',
    description: 'test fixture',
    buckets: [
      {
        id: 'A',
        name: 'A box',
        kind: 'box',
        weight: 1,
        contents: [
          { resId: 'a1', weight: 5, minCount: 1 },
          { resId: 'a2', weight: 1, minCount: 1 },
        ],
      },
      {
        id: 'B',
        name: 'B box',
        kind: 'box',
        weight: 3,
        contents: [{ resId: 'b1', weight: 1, minCount: 1 }],
      },
    ],
    items: [
      { resId: 'a1', name: 'A One', type: 'gem', quality: 'rare', isFeatured: false },
      { resId: 'a2', name: 'A Two', type: 'gem', quality: 'epic', isFeatured: true },
      { resId: 'b1', name: 'B One', type: 'box', quality: 'common', isFeatured: false },
    ],
    drawModes: [],
    rules: [
      { type: 'cyclic-pity', params: { period: 10, bucketId: 'A' } },
    ],
  }

  it('normalizes bucket weights to baseRate summing to 1', () => {
    const engine = adaptToEngine(sample)
    const totalRate = engine.rarities.reduce((s, r) => s + r.baseRate, 0)
    expect(totalRate).toBeCloseTo(1, 10)
    expect(engine.rarities[0].baseRate).toBeCloseTo(1 / 4)
    expect(engine.rarities[1].baseRate).toBeCloseTo(3 / 4)
  })

  it('flattens bucket contents into items[] with rarity = bucket.id', () => {
    const engine = adaptToEngine(sample)
    expect(engine.items).toHaveLength(3)
    expect(engine.items.find((i) => i.id === 'a1')?.rarity).toBe('A')
    expect(engine.items.find((i) => i.id === 'a2')?.rarity).toBe('A')
    expect(engine.items.find((i) => i.id === 'b1')?.rarity).toBe('B')
  })

  it('preserves bucket-content weights on items', () => {
    const engine = adaptToEngine(sample)
    expect(engine.items.find((i) => i.id === 'a1')?.weight).toBe(5)
    expect(engine.items.find((i) => i.id === 'a2')?.weight).toBe(1)
  })

  it('looks up item metadata (name, isFeatured) from items[]', () => {
    const engine = adaptToEngine(sample)
    const a2 = engine.items.find((i) => i.id === 'a2')!
    expect(a2.name).toBe('A Two')
    expect(a2.isFeatured).toBe(true)
  })

  it('falls back to resId as name when metadata missing', () => {
    const noMeta: PoolSchema = {
      ...sample,
      items: [], // strip all metadata
    }
    const engine = adaptToEngine(noMeta)
    const a1 = engine.items.find((i) => i.id === 'a1')!
    expect(a1.name).toBe('a1')
  })

  it('passes rules through unchanged', () => {
    const engine = adaptToEngine(sample)
    expect(engine.rules).toHaveLength(1)
    expect(engine.rules[0]).toEqual({
      type: 'cyclic-pity',
      params: { period: 10, bucketId: 'A' },
    })
  })

  it('throws on zero total bucket weight', () => {
    const broken: PoolSchema = { ...sample, buckets: [] as never }
    expect(() => adaptToEngine(broken)).toThrow(/bucket weights sum to 0/)
  })
})
