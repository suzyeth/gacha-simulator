import type {
  Item,
  PoolConfig,
  PoolState,
  PullResult,
  Rarity,
  Rng,
} from './types'
import type { RuleContext, RuleRegistry, SelectItemResult } from './rules/rule'

/** Create a fresh state for a pool with all counters zeroed. */
export function createInitialState(pool: PoolConfig): PoolState {
  const pullsSinceRarity: Record<Rarity, number> = {}
  const guaranteedFeatured: Record<Rarity, boolean> = {}
  for (const r of pool.rarities) {
    pullsSinceRarity[r.id] = 0
    guaranteedFeatured[r.id] = false
  }
  return {
    totalPulls: 0,
    pullsSinceRarity,
    guaranteedFeatured,
    custom: {},
  }
}

function sampleRarity(rates: Record<Rarity, number>, rng: Rng): Rarity {
  const entries = Object.entries(rates)
  const total = entries.reduce((s, [, p]) => s + p, 0)
  if (total <= 0) {
    throw new Error('Rarity rates sum to zero or negative')
  }
  let roll = rng() * total
  for (const [rarity, p] of entries) {
    roll -= p
    if (roll <= 0) return rarity
  }
  return entries[entries.length - 1][0]
}

function selectItemDefault(rarity: Rarity, items: Item[], rng: Rng): Item {
  const candidates = items.filter((i) => i.rarity === rarity)
  if (candidates.length === 0) {
    throw new Error(`No items defined for rarity "${rarity}"`)
  }
  if (candidates.length === 1) return candidates[0]
  const weights = candidates.map((i) => i.weight ?? 1)
  const total = weights.reduce((s, w) => s + w, 0)
  let roll = rng() * total
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return candidates[i]
  }
  return candidates[candidates.length - 1]
}

/** Normalize a SelectItemResult to its constituent parts. */
function unpackSelection(sel: SelectItemResult): { item: Item; affectsBucketCounters: boolean } | null {
  if (sel === null) return null
  if ('item' in sel && 'rarity' in sel.item) {
    return { item: sel.item, affectsBucketCounters: sel.affectsBucketCounters ?? true }
  }
  if ('rarity' in sel) {
    return { item: sel, affectsBucketCounters: true }
  }
  return null
}

export interface PullOptions {
  pool: PoolConfig
  state: PoolState
  rng: Rng
  registry: RuleRegistry
}

/**
 * Resolve a single pull through the rule pipeline.
 *
 * Pipeline order (matches state-machine semantics most gacha games use):
 *   1. Seed rates from pool config base rates.
 *   2. Run every rule's modifyRates (e.g., soft pity bumps).
 *   3. Run every rule's forceRarity (hard pity wins, first match short-circuits).
 *   4. Sample rarity (or use forced rarity).
 *   5. Run every rule's selectItem (e.g., guaranteed-feature picks UP).
 *   6. Fall back to weighted-uniform selection within rarity.
 *   7. Build new state with pity counters advanced (or all-incremented if
 *      the selection signaled affectsBucketCounters=false, per D4).
 *   8. Run every rule's afterPull (e.g., flip 50/50 lost flag).
 */
export function pull(opts: PullOptions): { result: PullResult; state: PoolState } {
  const { pool, rng, registry, state } = opts
  const pullIndex = state.totalPulls + 1
  const triggeredRules: string[] = []

  // 1. Base rates
  let rates: Record<Rarity, number> = {}
  for (const r of pool.rarities) rates[r.id] = r.baseRate

  const baseCtx = (): RuleContext => ({ pool, state, pullIndex, rarities: rates, rng })

  // 2. modifyRates
  for (const ruleInstance of pool.rules) {
    const impl = registry[ruleInstance.type]
    if (!impl?.modifyRates) continue
    const before = rates
    rates = impl.modifyRates(rates, baseCtx(), ruleInstance.params)
    if (rates !== before) triggeredRules.push(ruleInstance.type)
  }

  // 3. forceRarity (first non-null wins)
  let forcedRarity: Rarity | null = null
  for (const ruleInstance of pool.rules) {
    const impl = registry[ruleInstance.type]
    if (!impl?.forceRarity) continue
    const forced = impl.forceRarity(baseCtx(), ruleInstance.params)
    if (forced != null) {
      forcedRarity = forced
      if (!triggeredRules.includes(ruleInstance.type)) {
        triggeredRules.push(ruleInstance.type)
      }
      break
    }
  }

  // 4. Sample rarity
  const rarity = forcedRarity ?? sampleRarity(rates, rng)

  // 5. selectItem (first non-null wins)
  let selectedItem: Item | null = null
  let affectsBucketCounters = true
  for (const ruleInstance of pool.rules) {
    const impl = registry[ruleInstance.type]
    if (!impl?.selectItem) continue
    const raw = impl.selectItem(rarity, pool.items, baseCtx(), ruleInstance.params)
    const unpacked = unpackSelection(raw)
    if (unpacked) {
      selectedItem = unpacked.item
      affectsBucketCounters = unpacked.affectsBucketCounters
      if (!triggeredRules.includes(ruleInstance.type)) {
        triggeredRules.push(ruleInstance.type)
      }
      break
    }
  }

  // 6. Fallback weighted-uniform selection
  if (!selectedItem) selectedItem = selectItemDefault(rarity, pool.items, rng)

  const result: PullResult = { pullIndex, item: selectedItem, rarity, triggeredRules }

  // 7. Build new state. D4: if affectsBucketCounters=false, all counters
  //    increment without reset (scripted/transparent pulls).
  const newPullsSince: Record<Rarity, number> = {}
  for (const r of pool.rarities) {
    if (affectsBucketCounters) {
      newPullsSince[r.id] = r.id === rarity ? 0 : state.pullsSinceRarity[r.id] + 1
    } else {
      newPullsSince[r.id] = state.pullsSinceRarity[r.id] + 1
    }
  }
  let newState: PoolState = {
    totalPulls: pullIndex,
    pullsSinceRarity: newPullsSince,
    guaranteedFeatured: { ...state.guaranteedFeatured },
    custom: { ...state.custom },
  }

  // 8. afterPull (each rule can transform state)
  for (const ruleInstance of pool.rules) {
    const impl = registry[ruleInstance.type]
    if (!impl?.afterPull) continue
    newState = impl.afterPull(result, newState, ruleInstance.params)
  }

  return { result, state: newState }
}

/** Run N sequential pulls. Returns all results plus final state. */
export function pullMany(
  count: number,
  opts: PullOptions,
): { results: PullResult[]; state: PoolState } {
  let state = opts.state
  const results: PullResult[] = []
  for (let i = 0; i < count; i++) {
    const out = pull({ ...opts, state })
    results.push(out.result)
    state = out.state
  }
  return { results, state }
}
