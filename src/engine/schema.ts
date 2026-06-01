/**
 * Universal gacha pool configuration schema (Zod).
 *
 * This is the *external* / authoring shape: what users edit, what Excel imports
 * produce, what JSON exports look like. It is decoupled from the engine's
 * internal PoolConfig (see types.ts) — an adapter (see future adapter.ts)
 * flattens schema buckets into engine rarities.
 *
 * Design rationale:
 * - Mirrors the conventions of standard 中国二游 策划表 (game-designer Excel
 *   tables): two-level draw (一级随机 → 宝箱 → 二级开箱), cyclic保底, 首抽
 *   脚本, 累计抽数奖励, multiple draw modes (用券/普通/免费).
 * - Each schema concept maps 1:1 to a column/sheet from the XM reference
 *   config — see docs/DESIGN.md for the field-by-field mapping.
 * - The schema is also general enough for Genshin/Star Rail-style pools: model
 *   each rarity tier (SSR/SR/R) as a degenerate "bucket" whose `contents`
 *   list the items in that tier.
 */
import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
//  ITEMS — atomic, terminal-state things a player can receive.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single obtainable item.
 *
 * `resId` matches XM's `resId` column convention (long/int IDs like 80001,
 * 10014, 12001). Stored as string so the schema works for games using string
 * IDs too.
 */
export const ItemDef = z.object({
  /** Item ID (来源池 "resId"). Stable across all references. */
  resId: z.string().min(1),
  /** Display name (来源池 "name"). */
  name: z.string().min(1),
  /** Item type (来源池 "type"): e.g., "皮肤", "宝石", "装备图纸". */
  type: z.string().optional(),
  /** Quality tier (来源池 "quality"): e.g., "传奇", "稀有", "普通". */
  quality: z.string().optional(),
  /** Whether this item is a featured/UP item (50/50 mechanics target). */
  isFeatured: z.boolean().default(false),
  /** Optional category for analytics (e.g., "S皮肤", "副官"). */
  tag: z.string().optional(),
})
export type ItemDef = z.infer<typeof ItemDef>

// ─────────────────────────────────────────────────────────────────────────────
//  BUCKETS — first-level draw targets (a.k.a. "boxes" or "rarities").
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A bucket = one possible outcome of the first-level draw.
 *
 * Two flavors of the same shape:
 *   - "box" — concrete container that opens into an item (XM-style 宝箱).
 *   - "rarity" — abstract tier whose contents are items of that tier
 *     (Genshin-style: SSR/SR/R).
 *
 * The distinction is cosmetic at the engine level — both resolve as
 * "pick the bucket, then pick an item from its contents".
 */
export const BucketContent = z.object({
  /** Item resId inside this bucket. References ItemDef.resId. */
  resId: z.string().min(1),
  /** Weight for second-level (in-bucket) selection. Defaults to 1. */
  weight: z.number().positive().default(1),
  /** Minimum count granted per drop. Defaults to 1. */
  minCount: z.number().int().nonnegative().default(1),
  /** Maximum count granted per drop. Defaults to minCount. */
  maxCount: z.number().int().nonnegative().optional(),
})
export type BucketContent = z.infer<typeof BucketContent>

export const BucketDef = z.object({
  /** Bucket ID. For XM this is the box resId (20000, 10014); for Genshin "SSR". */
  id: z.string().min(1),
  /** Display name (e.g., "S皮肤箱", "普通宝石匣"). */
  name: z.string().optional(),
  /** Cosmetic kind — "box" (XM) vs "rarity" (Genshin). Engine ignores. */
  kind: z.enum(['box', 'rarity']).default('box'),
  /**
   * First-level weight. Relative — actual probability = weight / sum(weights).
   * XM example: 20000 → 0.03, 10014 → 5, 10015 → 1, 10028 → 70 (sum 76.03).
   */
  weight: z.number().positive(),
  /** Color hint for UI. */
  color: z.string().optional(),
  /** Items obtainable by opening this bucket. */
  contents: z.array(BucketContent).min(1),
})
export type BucketDef = z.infer<typeof BucketDef>

// ─────────────────────────────────────────────────────────────────────────────
//  DRAW MODES — how the player pays for a pull (economy link).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One method of executing a pull. Lifted directly from XM's skinBox.json row
 * (ticketDraw / normalDraw / freeTimes columns).
 *
 * The engine doesn't reason about cost — the economy module consumes this to
 * compute "抽数 → ¥" conversions.
 */
export const DrawMode = z.object({
  id: z.string().min(1), // 'normal' | 'ticket' | 'free' (free-form)
  label: z.string().optional(), // "普通抽" / "用券抽" / "免费"
  /** Resource consumed (resId, e.g., 6 for normal, 10020 for ticket). */
  costResId: z.string().optional(),
  costPerOne: z.number().int().nonnegative().default(0),
  costPerTen: z.number().int().nonnegative().default(0),
  /** Free draws granted per day (XM freeTimes). 0/undefined = none. */
  dailyTimes: z.number().int().nonnegative().optional(),
  /** Daily cap on this mode (XM limit). undefined = unlimited. */
  dailyLimit: z.number().int().nonnegative().optional(),
})
export type DrawMode = z.infer<typeof DrawMode>

// ─────────────────────────────────────────────────────────────────────────────
//  RULES — discriminated union of all pity / scripted mechanics.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cyclic pity (周期保底). XM convention.
 *
 * Every `period` pulls form a cycle. Within each cycle the bucket
 * `bucketId` must drop at least once; if it hasn't dropped naturally by
 * the period-th pull, that pull is forced to drop it.
 *
 * XM examples:
 *   - smallBaodi: { period: 10, bucketId: '10014' }
 *   - bigBaodi:   { period: 50, bucketId: '20000' }
 */
export const CyclicPityRule = z.object({
  type: z.literal('cyclic-pity'),
  params: z.object({
    period: z.number().int().positive(),
    bucketId: z.string().min(1),
  }),
})

/**
 * First-draw script (首抽脚本 / firstDrawResId). XM convention.
 *
 * The first `script.length` pulls on this pool, for a fresh account, deliver
 * the corresponding scripted item instead of running the RNG pipeline. After
 * the script is exhausted, normal pulls resume.
 *
 * XM example (firstDrawResId):
 *   script: [
 *     { resId: '80003', count: 1 },  // pull 1 → 艾拉娜 (S 级皮肤)
 *     { resId: '10001', count: 1 },  // pull 2 → 枪械强化蓝图
 *     ...
 *   ]
 */
export const FirstDrawScriptRule = z.object({
  type: z.literal('first-draw-script'),
  params: z.object({
    script: z
      .array(
        z.object({
          resId: z.string().min(1),
          count: z.number().int().positive().default(1),
        }),
      )
      .min(1),
  }),
})

// NOTE: `cumulative-reward` (XM processBox) was DEPRECATED per user feedback
// 2026-05-18 — the field exists in legacy tables but the mechanic is no
// longer used in current pool design. Not implemented. Re-add if a future
// project needs it.

export const RuleSpec = z.discriminatedUnion('type', [
  CyclicPityRule,
  FirstDrawScriptRule,
])
export type RuleSpec = z.infer<typeof RuleSpec>

// ─────────────────────────────────────────────────────────────────────────────
//  POOL — the top-level config a user authors or imports.
// ─────────────────────────────────────────────────────────────────────────────

export const PoolSchema = z.object({
  /** Stable pool ID. */
  id: z.string().min(1),
  /** Display name (e.g., "庭院 S 皮肤池"). */
  name: z.string().min(1),
  /** Optional human description. */
  description: z.string().optional(),
  /** First-level buckets (boxes/rarities). */
  buckets: z.array(BucketDef).min(1),
  /** Item metadata table. Referenced by BucketContent.resId. */
  items: z.array(ItemDef).default([]),
  /** Draw modes for the economy module. */
  drawModes: z.array(DrawMode).default([]),
  /** Active rules. Order matters for some combinations — see DESIGN.md. */
  rules: z.array(RuleSpec).default([]),
})
export type PoolSchema = z.infer<typeof PoolSchema>

// ─────────────────────────────────────────────────────────────────────────────
//  CROSS-FIELD VALIDATION — catches the kind of bugs XM tables actually have.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate a parsed PoolSchema for cross-field consistency.
 *
 * Returns array of issues. Empty array = healthy. Surface in UI as warnings —
 * a 数值策划 wants to know "your config has 2 entries for box 10015 阶3"
 * before they ship.
 */
export interface ConfigIssue {
  severity: 'error' | 'warning'
  path: string
  message: string
}

export function validatePool(pool: PoolSchema): ConfigIssue[] {
  const issues: ConfigIssue[] = []

  // 1. Every BucketContent.resId must exist in items[].
  const itemIds = new Set(pool.items.map((i) => i.resId))
  for (const b of pool.buckets) {
    for (let i = 0; i < b.contents.length; i++) {
      const c = b.contents[i]
      if (!itemIds.has(c.resId)) {
        issues.push({
          severity: 'warning',
          path: `buckets.${b.id}.contents[${i}].resId`,
          message: `Item "${c.resId}" referenced but not defined in items[]`,
        })
      }
    }
  }

  // 2. Duplicate contents within a bucket (XM 10015 阶3 出现两行的情况).
  for (const b of pool.buckets) {
    const seen = new Map<string, number>()
    b.contents.forEach((c, i) => {
      const count = (seen.get(c.resId) ?? 0) + 1
      seen.set(c.resId, count)
      if (count === 2) {
        issues.push({
          severity: 'warning',
          path: `buckets.${b.id}.contents[${i}].resId`,
          message: `Duplicate entry for item "${c.resId}" in bucket "${b.id}"`,
        })
      }
    })
  }

  // 3. Rule targets must reference existing buckets.
  for (let i = 0; i < pool.rules.length; i++) {
    const r = pool.rules[i]
    if ('bucketId' in r.params) {
      const bid = r.params.bucketId
      if (!pool.buckets.some((b) => b.id === bid)) {
        issues.push({
          severity: 'error',
          path: `rules[${i}].params.bucketId`,
          message: `Rule "${r.type}" targets bucket "${bid}" which doesn't exist`,
        })
      }
    }
  }

  // 4. FirstDrawScript and CumulativeReward references.
  for (let i = 0; i < pool.rules.length; i++) {
    const r = pool.rules[i]
    if (r.type === 'first-draw-script') {
      r.params.script.forEach((s, j) => {
        if (!itemIds.has(s.resId)) {
          issues.push({
            severity: 'warning',
            path: `rules[${i}].params.script[${j}].resId`,
            message: `First-draw script references unknown item "${s.resId}"`,
          })
        }
      })
    }
  }

  return issues
}
