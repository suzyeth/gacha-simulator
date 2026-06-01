/**
 * Core domain types for the gacha simulator engine.
 *
 * Design principles:
 * - All types are plain data, no methods.
 * - State is immutable: rules return new state, never mutate.
 * - Rarity is a string discriminator so games can define arbitrary tiers.
 */

/** Identifier for a rarity tier (e.g., "SSR", "SR", "R", or custom). */
export type Rarity = string

/** A single obtainable item in a pool. */
export interface Item {
  id: string
  name: string
  rarity: Rarity
  /** Featured/UP items — used by guaranteed-feature rules. */
  isFeatured?: boolean
  /** Relative weight for selection within rarity. Defaults to 1 (uniform). */
  weight?: number
}

/** Configuration for one rarity tier. */
export interface RarityConfig {
  id: Rarity
  /** Base drop probability (0..1). Sum across all rarities should equal 1. */
  baseRate: number
  /** Optional display label and color for UI. */
  label?: string
  color?: string
}

/** A configured rule instance referencing its registry type. */
export interface RuleInstance<P = Record<string, unknown>> {
  type: string
  params: P
}

/** Complete pool configuration. */
export interface PoolConfig {
  id: string
  name: string
  description?: string
  /** Rarities ordered from highest to lowest. */
  rarities: RarityConfig[]
  /** Available items in the pool. */
  items: Item[]
  /** Rules applied per-pull (soft pity, hard pity, guaranteed feature, ...). */
  rules: RuleInstance[]
}

/** Mutable state carried between pulls. */
export interface PoolState {
  /** Total pulls performed. */
  totalPulls: number
  /** Pulls since last drop of each rarity (for pity counters). */
  pullsSinceRarity: Record<Rarity, number>
  /** Whether next drop of a rarity is forced to be featured (50/50 lost flag). */
  guaranteedFeatured: Record<Rarity, boolean>
  /** Extension bucket for custom rule state. */
  custom: Record<string, unknown>
}

/** Result of a single pull. */
export interface PullResult {
  /** 1-indexed pull number within the simulation. */
  pullIndex: number
  item: Item
  rarity: Rarity
  /** Names of rules that fired during this pull. */
  triggeredRules: string[]
}

/** Random number generator returning a value in [0, 1). */
export type Rng = () => number
