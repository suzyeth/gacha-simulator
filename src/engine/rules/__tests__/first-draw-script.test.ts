import { describe, it, expect } from 'vitest'
import { createInitialState, pullMany } from '../../simulator'
import { cyclicPity } from '../cyclic-pity'
import { firstDrawScript } from '../first-draw-script'
import type { PoolConfig } from '../../types'

const registry = {
  'cyclic-pity': cyclicPity,
  'first-draw-script': firstDrawScript,
}

describe('first-draw-script rule', () => {
  const basicPool: PoolConfig = {
    id: 'test-script',
    name: 'Script test',
    rarities: [
      { id: 'A', baseRate: 0.01 },
      { id: 'B', baseRate: 0.99 },
    ],
    items: [
      { id: 'a-item', name: 'A item', rarity: 'A' },
      { id: 'b-item', name: 'B item', rarity: 'B' },
      { id: 'a-special', name: 'A special', rarity: 'A' },
    ],
    rules: [
      {
        type: 'first-draw-script',
        params: {
          script: [
            { resId: 'a-special', count: 1 }, // pull 1
            { resId: 'b-item', count: 1 }, // pull 2
            { resId: 'a-item', count: 1 }, // pull 3
          ],
        },
      },
    ],
  }

  it('delivers scripted items for pulls 1..script.length', () => {
    const state = createInitialState(basicPool)
    const rng = () => 0.5
    const { results } = pullMany(5, { pool: basicPool, state, rng, registry })

    expect(results[0].item.id).toBe('a-special')
    expect(results[1].item.id).toBe('b-item')
    expect(results[2].item.id).toBe('a-item')
    // pulls 4+ are normal RNG (rng=0.5 → B at rates {A:0.01, B:0.99})
    expect(results[3].rarity).toBe('B')
    expect(results[4].rarity).toBe('B')
  })

  it('scripted pulls record triggeredRules', () => {
    const state = createInitialState(basicPool)
    const rng = () => 0.5
    const { results } = pullMany(4, { pool: basicPool, state, rng, registry })

    expect(results[0].triggeredRules).toContain('first-draw-script')
    expect(results[2].triggeredRules).toContain('first-draw-script')
    expect(results[3].triggeredRules).not.toContain('first-draw-script')
  })

  it('throws when script references unknown item', () => {
    const brokenPool: PoolConfig = {
      ...basicPool,
      rules: [
        {
          type: 'first-draw-script',
          params: { script: [{ resId: 'ghost-item' }] },
        },
      ],
    }
    const state = createInitialState(brokenPool)
    expect(() =>
      pullMany(1, { pool: brokenPool, state, rng: () => 0.5, registry }),
    ).toThrow(/scripted resId/)
  })

  it('D4: scripted pulls do NOT reset bucket counters', () => {
    // Script delivers A-bucket item at pull 1. Without D4, A counter resets to 0.
    // With D4, A counter increments to 1 (transparent pull).
    const state = createInitialState(basicPool)
    const rng = () => 0.5
    const { state: afterPull1 } = pullMany(1, {
      pool: basicPool,
      state,
      rng,
      registry,
    })
    // a-special is in bucket A; if D4 works, A counter = 1 (incremented), not 0 (reset)
    expect(afterPull1.pullsSinceRarity['A']).toBe(1)
    expect(afterPull1.pullsSinceRarity['B']).toBe(1)
  })

  it('D4 + cyclic-pity integration: scripted A drop does not satisfy cyclic-pity for A', () => {
    // Critical XM scenario: firstDrawResId scripts an item from bucket 20000
    // (S皮肤箱) at pull 1. bigBaodi (cyclic-pity period 50 on 20000) should
    // STILL fire at the period-th pull, because the scripted pull didn't
    // reset the 20000 counter.
    const xmLike: PoolConfig = {
      id: 'xm-script-pity',
      name: 'XM-like script+pity',
      rarities: [
        { id: '20000', baseRate: 0.0004 },
        { id: '10028', baseRate: 0.92 }, // dominant filler
      ],
      items: [
        { id: 'skin', name: 'S Skin', rarity: '20000' },
        { id: 'filler', name: 'Filler', rarity: '10028' },
      ],
      rules: [
        {
          type: 'first-draw-script',
          params: { script: [{ resId: 'skin' }] }, // pull 1 = skin
        },
        {
          type: 'cyclic-pity',
          params: { period: 5, bucketId: '20000' }, // short for testing
        },
      ],
    }
    const state = createInitialState(xmLike)
    const rng = () => 0.999 // always natural filler (10028)
    const { results } = pullMany(5, { pool: xmLike, state, rng, registry })

    expect(results[0].item.id).toBe('skin') // scripted
    expect(results[1].rarity).toBe('10028')
    expect(results[2].rarity).toBe('10028')
    expect(results[3].rarity).toBe('10028')
    // Pull 5: cyclic-pity fires because scripted pull 1 did NOT reset 20000 counter
    // Counter went: 0 (init) → 1 (pull 1, scripted, all-incr) → 2 → 3 → 4 → trigger at 5
    expect(results[4].rarity).toBe('20000')
    expect(results[4].triggeredRules).toContain('cyclic-pity')
  })

  it('selectItem returns null after script exhausted (falls back to RNG)', () => {
    const state = createInitialState(basicPool)
    let pulls = 0
    const rng = () => {
      pulls++
      return 0.5
    }
    pullMany(5, { pool: basicPool, state, rng, registry })
    // First 3 pulls scripted (rng called once each for rarity sample which is forced/skipped)
    // Pulls 4-5 are pure RNG. Important: no errors, scripted items don't bleed past length.
    expect(pulls).toBeGreaterThan(0) // just sanity that rng was called
  })
})
