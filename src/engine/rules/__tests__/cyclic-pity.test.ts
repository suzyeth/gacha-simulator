import { describe, it, expect } from 'vitest'
import { createInitialState, pullMany } from '../../simulator'
import { cyclicPity } from '../cyclic-pity'
import type { PoolConfig } from '../../types'

const twoBucketPool: PoolConfig = {
  id: 'test-cyclic',
  name: 'Cyclic test',
  rarities: [
    { id: 'X', baseRate: 0.01 },
    { id: 'O', baseRate: 0.99 },
  ],
  items: [
    { id: 'x-item', name: 'X item', rarity: 'X' },
    { id: 'o-item', name: 'O item', rarity: 'O' },
  ],
  rules: [{ type: 'cyclic-pity', params: { period: 10, bucketId: 'X' } }],
}

const registry = { 'cyclic-pity': cyclicPity }

describe('cyclic-pity rule (A1 semantic)', () => {
  it('forces bucket X every period pulls when X never drops naturally', () => {
    const state = createInitialState(twoBucketPool)
    // RNG returns 0.5 — with rates {X: 0.01, O: 0.99}, sample picks O (0.5 > 0.01)
    const rng = () => 0.5
    const { results } = pullMany(30, {
      pool: twoBucketPool,
      state,
      rng,
      registry,
    })

    // X should drop exactly at pulls 10, 20, 30 (1-indexed)
    expect(results[9].rarity).toBe('X') // pull 10
    expect(results[19].rarity).toBe('X') // pull 20
    expect(results[29].rarity).toBe('X') // pull 30
    // Surrounding pulls are O
    expect(results[8].rarity).toBe('O')
    expect(results[10].rarity).toBe('O')
    expect(results[18].rarity).toBe('O')
    expect(results[20].rarity).toBe('O')
  })

  it('triggeredRules records cyclic-pity on forced pulls', () => {
    const state = createInitialState(twoBucketPool)
    const rng = () => 0.5
    const { results } = pullMany(10, {
      pool: twoBucketPool,
      state,
      rng,
      registry,
    })
    expect(results[8].triggeredRules).not.toContain('cyclic-pity')
    expect(results[9].triggeredRules).toContain('cyclic-pity')
  })

  it('resets counter when X drops naturally — next pity shifted', () => {
    // Pull 5 → X natural; pulls 6-14 → O; pull 15 → forced X
    // RNG: 0.5 means O (when rates are {X:0.01, O:0.99}); 0.001 means X
    const rolls = [
      0.5, 0.5, 0.5, 0.5, // pulls 1-4: O
      0.001, // pull 5: X (natural, low roll < 0.01)
      0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, // pulls 6-14: O
      0.5, // pull 15: should be forced X
    ]
    let i = 0
    const rng = () => rolls[i++]

    const state = createInitialState(twoBucketPool)
    const { results } = pullMany(15, {
      pool: twoBucketPool,
      state,
      rng,
      registry,
    })

    expect(results[4].rarity).toBe('X') // pull 5: natural X
    expect(results[9].rarity).toBe('O') // pull 10: NOT forced (counter was 4 after pull 5)
    expect(results[14].rarity).toBe('X') // pull 15: forced X (counter reached 9)
    expect(results[14].triggeredRules).toContain('cyclic-pity')
  })

  it('handles two independent cyclic-pity rules', () => {
    const threeBucket: PoolConfig = {
      id: 'test-multi',
      name: 'Multi-cyclic test',
      rarities: [
        { id: 'A', baseRate: 0.001 },
        { id: 'B', baseRate: 0.001 },
        { id: 'C', baseRate: 0.998 },
      ],
      items: [
        { id: 'a', name: 'A', rarity: 'A' },
        { id: 'b', name: 'B', rarity: 'B' },
        { id: 'c', name: 'C', rarity: 'C' },
      ],
      rules: [
        { type: 'cyclic-pity', params: { period: 5, bucketId: 'A' } },
        { type: 'cyclic-pity', params: { period: 7, bucketId: 'B' } },
      ],
    }
    const state = createInitialState(threeBucket)
    const rng = () => 0.999 // always natural C

    const { results } = pullMany(15, { pool: threeBucket, state, rng, registry })

    // A forced at 5, 10, 15
    expect(results[4].rarity).toBe('A')
    expect(results[9].rarity).toBe('A')
    expect(results[14].rarity).toBe('A')
    // B forced at 7, 14 (per its own counter)
    expect(results[6].rarity).toBe('B')
    expect(results[13].rarity).toBe('B')
  })

  it('does not fire before period reached', () => {
    const state = createInitialState(twoBucketPool)
    const rng = () => 0.5
    const { results } = pullMany(9, { pool: twoBucketPool, state, rng, registry })
    for (const r of results) {
      expect(r.rarity).toBe('O')
    }
  })
})
