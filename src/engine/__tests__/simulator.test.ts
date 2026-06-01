import { describe, it, expect } from 'vitest'
import { createInitialState, pull, pullMany } from '../simulator'
import type { PoolConfig } from '../types'

const binaryPool: PoolConfig = {
  id: 'test-binary',
  name: 'Test Binary Pool',
  rarities: [
    { id: 'SSR', baseRate: 0.5 },
    { id: 'R', baseRate: 0.5 },
  ],
  items: [
    { id: 'ssr1', name: 'SSR Item', rarity: 'SSR' },
    { id: 'r1', name: 'R Item', rarity: 'R' },
  ],
  rules: [],
}

const genshinLikePool: PoolConfig = {
  id: 'test-genshin-base',
  name: 'Genshin-like Base Rates',
  rarities: [
    { id: 'SSR', baseRate: 0.006 },
    { id: 'SR', baseRate: 0.051 },
    { id: 'R', baseRate: 0.943 },
  ],
  items: [
    { id: 'ssr', name: '5★', rarity: 'SSR' },
    { id: 'sr', name: '4★', rarity: 'SR' },
    { id: 'r', name: '3★', rarity: 'R' },
  ],
  rules: [],
}

describe('simulator: base rates without rules', () => {
  it('returns SSR when RNG rolls into the SSR bucket', () => {
    const state = createInitialState(binaryPool)
    const rng = () => 0.1
    const { result } = pull({ pool: binaryPool, state, rng, registry: {} })
    expect(result.rarity).toBe('SSR')
    expect(result.item.id).toBe('ssr1')
    expect(result.pullIndex).toBe(1)
    expect(result.triggeredRules).toEqual([])
  })

  it('returns R when RNG rolls into the R bucket', () => {
    const state = createInitialState(binaryPool)
    const rng = () => 0.9
    const { result } = pull({ pool: binaryPool, state, rng, registry: {} })
    expect(result.rarity).toBe('R')
  })

  it('updates pity counters: reset on drop, increment otherwise', () => {
    let state = createInitialState(binaryPool)
    const rolls = [0.1, 0.9, 0.1] // SSR, R, SSR
    let i = 0
    const rng = () => rolls[i++]

    const t1 = pull({ pool: binaryPool, state, rng, registry: {} })
    state = t1.state
    expect(state.totalPulls).toBe(1)
    expect(state.pullsSinceRarity['SSR']).toBe(0)
    expect(state.pullsSinceRarity['R']).toBe(1)

    const t2 = pull({ pool: binaryPool, state, rng, registry: {} })
    state = t2.state
    expect(state.totalPulls).toBe(2)
    expect(state.pullsSinceRarity['SSR']).toBe(1)
    expect(state.pullsSinceRarity['R']).toBe(0)

    const t3 = pull({ pool: binaryPool, state, rng, registry: {} })
    state = t3.state
    expect(state.totalPulls).toBe(3)
    expect(state.pullsSinceRarity['SSR']).toBe(0)
    expect(state.pullsSinceRarity['R']).toBe(1)
  })

  it('does not mutate the input state', () => {
    const state = createInitialState(binaryPool)
    const frozen = JSON.parse(JSON.stringify(state))
    pull({ pool: binaryPool, state, rng: () => 0.1, registry: {} })
    expect(state).toEqual(frozen)
  })

  it('converges to 50/50 over 100k pulls on the binary pool', () => {
    const state = createInitialState(binaryPool)
    const { results } = pullMany(100_000, {
      pool: binaryPool,
      state,
      rng: Math.random,
      registry: {},
    })
    const ssr = results.filter((r) => r.rarity === 'SSR').length / 100_000
    // Binomial 95% CI half-width at n=100k, p=0.5: ~0.003 → expect 0.497..0.503
    expect(ssr).toBeGreaterThan(0.49)
    expect(ssr).toBeLessThan(0.51)
  })

  it('converges to Genshin-like 0.6% base rate over 200k pulls', () => {
    const state = createInitialState(genshinLikePool)
    const N = 200_000
    const { results } = pullMany(N, {
      pool: genshinLikePool,
      state,
      rng: Math.random,
      registry: {},
    })
    const ssr = results.filter((r) => r.rarity === 'SSR').length / N
    // Binomial 95% CI half-width at n=200k, p=0.006: ~0.0011 → expect 0.0049..0.0071
    expect(ssr).toBeGreaterThan(0.0045)
    expect(ssr).toBeLessThan(0.0075)
  })

  it('throws when no items exist for the sampled rarity', () => {
    const brokenPool: PoolConfig = {
      ...binaryPool,
      items: [{ id: 'r1', name: 'R only', rarity: 'R' }],
    }
    const state = createInitialState(brokenPool)
    expect(() =>
      pull({ pool: brokenPool, state, rng: () => 0.1, registry: {} }),
    ).toThrow(/No items defined/)
  })
})
