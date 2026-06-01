import type { Item, PoolConfig, PoolState, PullResult, Rarity, Rng } from '../types'

/** Context provided to rule hooks. */
export interface RuleContext {
  /** Full pool config (read-only) — rules can introspect items, rarities, other rules. */
  pool: PoolConfig
  state: PoolState
  /** 1-indexed pull number (the pull currently being resolved). */
  pullIndex: number
  /** Current rarity rates after prior rule modifications. */
  rarities: Record<Rarity, number>
  rng: Rng
}

/**
 * Result of a `selectItem` rule hook.
 *
 * Plain `Item` is the simple case — pity counters update normally
 * (selected rarity resets, others increment).
 *
 * `{ item, affectsBucketCounters: false }` signals a "transparent" pull
 * (e.g., first-draw-script): the engine still records the item as the
 * result, but ALL bucket counters increment without reset. Used so
 * scripted pulls don't satisfy pity (D4).
 */
export type SelectItemResult = Item | { item: Item; affectsBucketCounters?: boolean } | null

/**
 * Plugin interface for a single gacha mechanic.
 *
 * Rules are pure: they read context, return new data. No mutation.
 * A rule may implement any subset of hooks.
 */
export interface Rule<P = Record<string, unknown>> {
  /** Stable identifier matched against RuleInstance.type. */
  type: string

  /** Reshape per-pull rarity probabilities (e.g., soft pity bumps SSR rate). */
  modifyRates?: (
    rates: Record<Rarity, number>,
    ctx: RuleContext,
    params: P,
  ) => Record<Rarity, number>

  /** Force a specific rarity to drop (e.g., hard pity at pull N). */
  forceRarity?: (ctx: RuleContext, params: P) => Rarity | null

  /** Override item selection within a chosen rarity (e.g., guaranteed feature). */
  selectItem?: (
    rarity: Rarity,
    items: Item[],
    ctx: RuleContext,
    params: P,
  ) => SelectItemResult

  /** Update state after the pull resolves. Must return new state (immutable). */
  afterPull?: (result: PullResult, state: PoolState, params: P) => PoolState
}

/** Lookup table from rule type → implementation. Heterogeneous by param type. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RuleRegistry = Record<string, Rule<any>>

/** Type guard for the rich SelectItemResult variant. */
export function isItem(r: SelectItemResult): r is Item {
  return r !== null && typeof r === 'object' && 'rarity' in r && !('item' in r)
}

// Re-export PoolConfig for convenience to anyone importing from rule.ts
export type { PoolConfig }
