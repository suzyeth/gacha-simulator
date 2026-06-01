import type { PoolConfig, Item } from './types'
import type { PoolSchema } from './schema'

/**
 * Adapt a PoolSchema (authoring shape — buckets + items + rules) into
 * the engine's flatter PoolConfig (rarities + items-with-rarity-tag).
 *
 * Key transformations:
 *  - First-level bucket weights are normalized to baseRate (0..1).
 *  - BucketContent entries become Items tagged with the bucket id as
 *    their rarity. Metadata (name / type / quality / isFeatured) is
 *    pulled from the schema's items[] lookup table.
 *  - Rules pass through as-is (RuleInstance shape is preserved).
 */
export function adaptToEngine(schema: PoolSchema): PoolConfig {
  const totalWeight = schema.buckets.reduce((s, b) => s + b.weight, 0)
  if (totalWeight <= 0) {
    throw new Error(`Pool "${schema.id}": bucket weights sum to ${totalWeight}`)
  }

  const rarities = schema.buckets.map((b) => ({
    id: b.id,
    baseRate: b.weight / totalWeight,
    label: b.name,
    color: b.color,
  }))

  const itemMeta = new Map(schema.items.map((i) => [i.resId, i]))

  const items: Item[] = schema.buckets.flatMap((b) =>
    b.contents.map((c) => {
      const meta = itemMeta.get(c.resId)
      return {
        id: c.resId,
        name: meta?.name ?? c.resId,
        rarity: b.id,
        weight: c.weight,
        isFeatured: meta?.isFeatured,
      }
    }),
  )

  const rules = schema.rules.map((r) => ({
    type: r.type,
    params: r.params as Record<string, unknown>,
  }))

  return {
    id: schema.id,
    name: schema.name,
    description: schema.description,
    rarities,
    items,
    rules,
  }
}
