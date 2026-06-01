#!/usr/bin/env node
/**
 * Compute the *true* gem drop rate under the current 塔防 S皮肤抽卡 config.
 *
 *   Pool buckets (from rewards JSON in skinBox.json id=1 "庭院"):
 *     20000  S皮肤箱  weight 3      bigBaodi  T=50
 *     10014  普通宝石箱 weight 500   smallBaodi T=10
 *     10015  璀璨宝石箱 weight 150   no pity
 *     10028  道具箱   weight 7000   no pity
 *     ──────────────────────────────────────── sum = 7653
 *
 *   Pity (cyclic, XM convention): counter resets on natural OR forced drop.
 *     T=10 cycle for 10014: if not naturally rolled by pull 10, pull 10 is
 *                            forced = 10014.
 *     T=50 cycle for 20000: same idea, T=50.
 *
 *   Gem grades = resId 1..7 from gem宝石.xlsx 宝石品质 sheet:
 *     1 白 / 2 绿 / 3 蓝 / 4 紫 / 5 金 / 6 红 / 7 (最高级)
 *
 *   Bucket → grade weights (from 宝箱配置.xlsx itemBoxPro):
 *     10014 普通: g1=1 g2=1 g3=6000 g4=71500 g5=22490 g6=9 g7=1   (sum 100002)
 *     10015 璀璨: g2=1 g3=1 g4=117  g5=117   g6=510  g7=256       (sum 1002)
 *
 * Runs:
 *   1) closed-form marginal P (each bucket × in-bucket weight, ignoring pity-
 *      interaction-eating-slots — small error)
 *   2) Monte Carlo 2M pulls with both pity rules → ground truth
 */
import { performance } from 'node:perf_hooks'

// ─── Pool config ───
const BUCKETS = {
  20000: { weight: 3,    pity: 50 },
  10014: { weight: 500,  pity: 10 },
  10015: { weight: 150,  pity: null },
  10028: { weight: 7000, pity: null },
}
const ORDER = [20000, 10014, 10015, 10028]
const SUM_W = ORDER.reduce((s, id) => s + BUCKETS[id].weight, 0)  // 7653

const GEM_CONTENTS = {
  10014: { 1: 1, 2: 1, 3: 6000, 4: 71500, 5: 22490, 6: 9, 7: 1 },
  10015: { 2: 1, 3: 1, 4: 117, 5: 117, 6: 510, 7: 256 },
}
const GRADE_NAMES = {
  1: '白', 2: '绿', 3: '蓝', 4: '紫', 5: '金', 6: '红', 7: 'T7(最高)',
}

const NORMAL_COST_ONE = 200
const NORMAL_COST_TEN = 1800

// ─── 1. Closed-form marginal ───
function cyclicPityEffP(p, T) {
  if (T == null) return p
  if (p <= 0) return 1 / T
  if (p >= 1) return p
  const q = 1 - p
  const Eprior = (1 - Math.pow(q, T)) / p
  return 1 / Eprior
}

const closedForm = {}
const effBucketP = {}
for (const id of ORDER) {
  const natP = BUCKETS[id].weight / SUM_W
  effBucketP[id] = cyclicPityEffP(natP, BUCKETS[id].pity)
}

const closedGrade = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 }
for (const bid of [10014, 10015]) {
  const contents = GEM_CONTENTS[bid]
  const sumW = Object.values(contents).reduce((a, b) => a + b, 0)
  for (const [grade, w] of Object.entries(contents)) {
    closedGrade[grade] += effBucketP[bid] * (w / sumW)
  }
}

// ─── 2. Monte Carlo ───
function simulate(N) {
  const counts = { 20000: 0, 10014: 0, 10015: 0, 10028: 0 }
  const gradeCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 }
  let counter10014 = 0
  let counter20000 = 0

  // Precompute bucket-pick cumulative for natural roll
  const cum = []
  let acc = 0
  for (const id of ORDER) {
    acc += BUCKETS[id].weight
    cum.push({ id, threshold: acc })
  }

  // Precompute in-bucket cumulative for 10014, 10015
  const inBucketCum = {}
  for (const bid of [10014, 10015]) {
    const arr = []
    let a = 0
    for (const [grade, w] of Object.entries(GEM_CONTENTS[bid])) {
      a += w
      arr.push({ grade: +grade, threshold: a })
    }
    inBucketCum[bid] = { entries: arr, total: a }
  }

  for (let i = 0; i < N; i++) {
    counter10014++
    counter20000++
    let chosen

    // Forced pity? bigBaodi 优先(更稀有先判)
    if (counter20000 >= 50) {
      chosen = 20000
      counter20000 = 0
      counter10014 = 0  // XM convention: any pity hit resets ALL counters? Let me re-check.
      // Actually we said cyclic pity counter resets on natural OR forced drop OF THAT bucket.
      // So 20000's forced hit doesn't reset 10014's counter. But the same pull went to 20000,
      // so 10014 didn't drop on this pull → counter10014 stays as ++'d at top.
      // → revert that "counter10014 = 0" line. Keep separate counters.
      counter10014 = counter10014  // no reset
    } else if (counter10014 >= 10) {
      chosen = 10014
      counter10014 = 0
    } else {
      const r = Math.random() * SUM_W
      for (const c of cum) {
        if (r < c.threshold) { chosen = c.id; break }
      }
      // Reset counters for whatever was hit
      if (chosen === 10014) counter10014 = 0
      if (chosen === 20000) counter20000 = 0
    }

    counts[chosen]++

    // Second-level: only 10014/10015 yield gems
    if (chosen === 10014 || chosen === 10015) {
      const ib = inBucketCum[chosen]
      const r = Math.random() * ib.total
      for (const e of ib.entries) {
        if (r < e.threshold) { gradeCounts[e.grade]++; break }
      }
    }
  }
  return { counts, gradeCounts }
}

// Fix: re-derive simulate without the bogus reset chain. Re-pasting clean:
function simulateClean(N) {
  const counts = { 20000: 0, 10014: 0, 10015: 0, 10028: 0 }
  const gradeCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 }
  let c10014 = 0  // counter since last 10014 drop (natural or forced)
  let c20000 = 0  // counter since last 20000 drop (natural or forced)

  const cum = []
  let acc = 0
  for (const id of ORDER) { acc += BUCKETS[id].weight; cum.push({ id, t: acc }) }

  const inBucketCum = {}
  for (const bid of [10014, 10015]) {
    const arr = []; let a = 0
    for (const [g, w] of Object.entries(GEM_CONTENTS[bid])) { a += w; arr.push({ g: +g, t: a }) }
    inBucketCum[bid] = { arr, total: a }
  }

  for (let i = 0; i < N; i++) {
    c10014++; c20000++
    let chosen

    // Resolve pity in priority order. Big baodi (50) is rarer / harder threshold,
    // but it triggers at pull 50. Small baodi (10) triggers at pull 10. On any
    // given pull, both could be due simultaneously. Convention: big > small (S 皮肤优先).
    if (c20000 >= 50) {
      chosen = 20000
    } else if (c10014 >= 10) {
      chosen = 10014
    } else {
      const r = Math.random() * SUM_W
      for (const c of cum) { if (r < c.t) { chosen = c.id; break } }
    }

    counts[chosen]++
    // Reset only the counter for the bucket that actually dropped
    if (chosen === 10014) c10014 = 0
    if (chosen === 20000) c20000 = 0

    if (chosen === 10014 || chosen === 10015) {
      const ib = inBucketCum[chosen]
      const r = Math.random() * ib.total
      for (const e of ib.arr) { if (r < e.t) { gradeCounts[e.g]++; break } }
    }
  }
  return { counts, gradeCounts }
}

// ─── Run ───
console.log('═══ Closed-form marginal (analytic) ═══')
console.log('Effective bucket P:')
for (const id of ORDER) {
  const nat = BUCKETS[id].weight / SUM_W
  const eff = effBucketP[id]
  console.log(`  ${id}  natP=${(nat*100).toFixed(4)}%   pity=${BUCKETS[id].pity ?? '—'}   effP=${(eff*100).toFixed(4)}%`)
}
const closedTotal = Object.values(closedGrade).reduce((a, b) => a + b, 0)
console.log(`\nGem grade closed-form P (per pull):`)
console.log(`Grade | 名称  | P (%)        | E(抽数) | 单抽成本 (物品6)`)
for (const g of [7, 6, 5, 4, 3, 2, 1]) {
  const p = closedGrade[g]
  console.log(`  ${g}   | ${GRADE_NAMES[g].padEnd(5)} | ${(p*100).toFixed(5).padStart(11)}% | ${(1/p).toFixed(1).padStart(8)} | ${(NORMAL_COST_ONE/p).toFixed(0).padStart(9)}`)
}
console.log(`────────────────────────────────────────────────────────`)
console.log(`总宝石 P/pull = ${(closedTotal*100).toFixed(4)}% (~1/${(1/closedTotal).toFixed(2)} 抽)`)

// Monte Carlo
const N = 2_000_000
console.log(`\n═══ Monte Carlo (${N.toLocaleString()} pulls) ═══`)
const t0 = performance.now()
const mc = simulateClean(N)
const t1 = performance.now()
console.log(`runtime: ${(t1-t0).toFixed(0)} ms`)

console.log(`\nBucket frequency:`)
for (const id of ORDER) {
  const f = mc.counts[id] / N
  const expected = effBucketP[id]
  const delta = ((f - expected) / expected * 100).toFixed(2)
  console.log(`  ${id}  ${(f*100).toFixed(4)}%  (closed-form: ${(expected*100).toFixed(4)}%,  Δ ${delta}%)`)
}

console.log(`\nGem grade real probability:`)
console.log(`Grade | 名称  | MC P (%)     | closed-form  | Δ%    | E(抽数) | 单抽成本 (物品6)`)
let mcTotal = 0
for (const g of [7, 6, 5, 4, 3, 2, 1]) {
  const p = mc.gradeCounts[g] / N
  mcTotal += p
  const cf = closedGrade[g]
  const delta = cf > 0 ? ((p - cf) / cf * 100).toFixed(2) : '—'
  console.log(`  ${g}   | ${GRADE_NAMES[g].padEnd(5)} | ${(p*100).toFixed(5).padStart(11)}% | ${(cf*100).toFixed(5).padStart(11)}% | ${String(delta).padStart(6)} | ${(1/p).toFixed(1).padStart(8)} | ${p > 0 ? (NORMAL_COST_ONE/p).toFixed(0).padStart(9) : '∞'.padStart(9)}`)
}
console.log(`────────────────────────────────────────────────────────`)
console.log(`总宝石 P/pull = ${(mcTotal*100).toFixed(4)}%  (closed-form: ${(closedTotal*100).toFixed(4)}%)`)
console.log(`\nMC tells us: 平均每 ${(1/mcTotal).toFixed(2)} 抽出 1 颗宝石(任何品质)`)
console.log(`             每 10 抽期望 ${(mcTotal*10).toFixed(2)} 颗宝石`)
console.log(`             每 50 抽期望 ${(mcTotal*50).toFixed(1)} 颗宝石`)

// Source breakdown: how many of each grade come from 10014 vs 10015
console.log(`\n═══ 宝石来源分解 (每个品质来自哪个箱) ═══`)
console.log(`Grade | 来自 10014 普通箱      | 来自 10015 璀璨箱      | 璀璨占比`)
for (const g of [7, 6, 5, 4, 3, 2, 1]) {
  const w14 = GEM_CONTENTS[10014][g] ?? 0
  const w15 = GEM_CONTENTS[10015][g] ?? 0
  const sumW14 = Object.values(GEM_CONTENTS[10014]).reduce((a, b) => a + b, 0)
  const sumW15 = Object.values(GEM_CONTENTS[10015]).reduce((a, b) => a + b, 0)
  const p14 = effBucketP[10014] * w14 / sumW14
  const p15 = effBucketP[10015] * w15 / sumW15
  const total = p14 + p15
  const ratio = total > 0 ? (p15 / total * 100).toFixed(1) : '—'
  console.log(`  ${g}   | ${(p14*100).toFixed(4)}% (w=${String(w14).padStart(5)}) | ${(p15*100).toFixed(4)}% (w=${String(w15).padStart(3)}) | ${ratio}%`)
}
