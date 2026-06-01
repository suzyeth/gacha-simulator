import { describe, it, expect } from 'vitest'
import { adaptToEngine } from '../adapter'
import { createInitialState, pullMany } from '../simulator'
import { defaultRegistry } from '../rules/registry'
import type { PoolSchema } from '../schema'

/**
 * XM Gold Standard test — Sprint 1 acceptance gate.
 *
 * Validates that the engine produces correct per-bucket steady-state
 * probabilities for XM's pool under A1 cyclic-pity semantics (counter
 * resets on natural drop; pity replaces this pull's random sample).
 *
 * The XM 设计 spreadsheet uses the formula `random + 1/N` for "含保底
 * 每抽期望" — this is an APPROXIMATION that overstates true probability
 * (especially for higher-p buckets). The engine targets the true value:
 *   E[T_drop] = (1 - (1-p)^N) / p
 *   P_per_pull = 1 / E[T_drop]
 *
 * For 10014 with p=0.06576, N=10:
 *   E[T_drop] = (1 - 0.93424^10) / 0.06576 = 0.4934 / 0.06576 ≈ 7.50
 *   P ≈ 0.1333 (vs spreadsheet formula 0.1658, ~20% overstatement)
 *
 * For 20000 with p=0.000395, N=50:
 *   E[T_drop] = (1 - 0.99961^50) / 0.000395 ≈ 49.5
 *   P ≈ 0.0202 (vs formula 0.0204, ~1% — basically exact for low-p)
 */

const xmPool: PoolSchema = {
  id: 'xm-tingyuan-s-skin',
  name: '庭院 S 皮肤池',
  description: 'XM reference pool — A1 cyclic-pity (smallBaodi=10, bigBaodi=50)',
  buckets: [
    {
      id: '20000',
      name: 'S 皮肤箱',
      kind: 'box',
      weight: 0.03,
      contents: [{ resId: 'box-20000-default', weight: 1, minCount: 1 }],
    },
    {
      id: '10014',
      name: '普通宝石匣',
      kind: 'box',
      weight: 5,
      contents: [{ resId: 'box-10014-default', weight: 1, minCount: 1 }],
    },
    {
      id: '10015',
      name: '璀璨宝石匣',
      kind: 'box',
      weight: 1,
      contents: [{ resId: 'box-10015-default', weight: 1, minCount: 1 }],
    },
    {
      id: '10028',
      name: '道具箱',
      kind: 'box',
      weight: 70,
      contents: [{ resId: 'box-10028-default', weight: 1, minCount: 1 }],
    },
  ],
  items: [
    { resId: 'box-20000-default', name: 'S皮肤箱内容', type: '皮肤', isFeatured: false },
    { resId: 'box-10014-default', name: '普通宝石内容', type: '宝石', isFeatured: false },
    { resId: 'box-10015-default', name: '璀璨宝石内容', type: '宝石', isFeatured: false },
    { resId: 'box-10028-default', name: '道具内容', type: '道具', isFeatured: false },
  ],
  drawModes: [],
  rules: [
    { type: 'cyclic-pity', params: { period: 10, bucketId: '10014' } }, // smallBaodi
    { type: 'cyclic-pity', params: { period: 50, bucketId: '20000' } }, // bigBaodi
  ],
}

interface ExpectedRange {
  bucketId: string
  trueP: number
  formulaP: number
  observedMin: number
  observedMax: number
}

const expectations: ExpectedRange[] = [
  {
    bucketId: '20000',
    trueP: 0.0202,
    formulaP: 0.02039,
    observedMin: 0.018,
    observedMax: 0.023,
  },
  {
    bucketId: '10014',
    trueP: 0.1333,
    formulaP: 0.16576,
    observedMin: 0.125,
    observedMax: 0.145,
  },
  {
    bucketId: '10015',
    trueP: 0.0115, // displaced by pity-forced pulls; rough estimate
    formulaP: 0.01315,
    observedMin: 0.009,
    observedMax: 0.014,
  },
  {
    bucketId: '10028',
    trueP: 0.835, // displaced
    formulaP: 0.92069,
    observedMin: 0.81,
    observedMax: 0.86,
  },
]

describe('XM Gold Standard — Sprint 1 acceptance gate (A1 semantics)', () => {
  it('reproduces theoretical per-bucket probabilities over 200k pulls', () => {
    const engine = adaptToEngine(xmPool)
    const state = createInitialState(engine)
    const N = 200_000
    const { results } = pullMany(N, {
      pool: engine,
      state,
      rng: Math.random,
      registry: defaultRegistry,
    })

    const counts: Record<string, number> = {}
    for (const r of results) {
      counts[r.rarity] = (counts[r.rarity] ?? 0) + 1
    }

    const observed: Record<string, number> = {}
    let sum = 0
    for (const e of expectations) {
      observed[e.bucketId] = (counts[e.bucketId] ?? 0) / N
      sum += observed[e.bucketId]
    }

    // Diagnostic log: 公式 vs 真值 vs 实测
     
    console.log('\n=== XM Pool — 公式 vs A1 真值 vs 引擎实测 (N=200k) ===')
     
    console.log('Bucket   实测      理论真值   表格公式   公式偏离')
    for (const e of expectations) {
      const obs = observed[e.bucketId]
      const deviation = ((obs - e.formulaP) / e.formulaP) * 100
       
      console.log(
        `  ${e.bucketId.padEnd(6)} ${obs.toFixed(5)}   ${e.trueP.toFixed(5)}    ${e.formulaP.toFixed(5)}    ${deviation.toFixed(1)}%`,
      )
    }

    // Invariant: single-item-per-pull → all probabilities sum to 1
    expect(sum).toBeCloseTo(1.0, 4)

    // Per-bucket: observed must fall in the empirical range that brackets A1 truth
    for (const e of expectations) {
      const obs = observed[e.bucketId]
      expect(
        obs,
        `Bucket ${e.bucketId}: observed ${obs.toFixed(5)} outside [${e.observedMin}, ${e.observedMax}]`,
      ).toBeGreaterThanOrEqual(e.observedMin)
      expect(obs).toBeLessThanOrEqual(e.observedMax)
    }
  })
})
