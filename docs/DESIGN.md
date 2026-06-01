# Gacha Simulator — Design Document

A gacha simulator built for **the XM project specifically**, optimized for 数值策划-owned iteration loops.

> **Scope (2026-05-18 pivot):** Not a "universal" cross-project tool. The goal is to let one designer change parameters and see results without programmer round-trips. Plugin-rule architecture is kept (because XM will evolve), but multi-project generic imports are out of scope.

---

## 1. Problem & Value Proposition

Real-world gacha-design workflows have three iteration tools:

| Tool                  | Strength                          | Weakness for 数值策划                       |
| --------------------- | --------------------------------- | -------------------------------------------- |
| Excel + 公式           | Closed-form math, designer-owned  | Distribution charts weak, no scenarios       |
| Python scripts        | Powerful Monte Carlo              | Designer can't iterate without engineer help |
| In-house pipeline UI  | Polished, integrated              | Proprietary, slow to add features            |

The **value-add** this tool targets: a web simulator the designer owns end-to-end — change a parameter, see the distribution change, no engineer needed.

Capabilities (in build order — A→B→C per user priority):

- **Sprint 1 (engine trust):** XM rule semantics (cyclic保底 + 首抽脚本) + math correctness gate.
- **Sprint 2 (basic usability):** Load XM pool, run 1/10/100k pulls, distribution chart by terminal item.
- **Sprint 3 (Value A — multi-banner sim):** Cross-pool budget projections with 保底继承 / UP 状态 / 货币聚合.
- **Sprint 4 (Value B — sensitivity slider):** Drag parameter, watch P50/P90 update live; A/B compare two configs.
- **Sprint 5 (Value C — health radar):** 基尼系数 / 同类对照 / ARPU 测算.
- **Sprint 6:** Deploy + 5-min demo for colleagues / interviewers.

---

## 2. The XM Reference Config

The XM抽卡 folder on Desktop drives the schema design. Sticking to real data forces the schema to handle real-world quirks instead of clean theory.

### XM's gacha model — two-level draw

```
                     Single pull
                          │
              ┌───────────┴───────────┐
              │  Level 1: Bucket sample│
              │  (weights from 一级随机) │
              └───────────┬───────────┘
                          │
                ┌─────────┴─────────┐
                ▼                   ▼
          [Bucket "20000"]    [Bucket "10014"]   ...
          S皮肤箱             普通宝石匣
                │                   │
              ┌─┴─┐               ┌─┴─┐
              ▼   ▼               ▼   ▼
        ┌────────────────┐   ┌────────────────┐
        │ Level 2:       │   │ Level 2:       │
        │ contents sample│   │ contents sample│
        │ (in-box weight)│   │ (in-box weight)│
        └────────────────┘   └────────────────┘
                │                   │
              莉亚 80001 …        白色宝石 12001 …
```

### XM's bucket weights (一级随机)

| Bucket ID | Name           | Weight    | Random p   | Pity p (cyclic)   |
| --------- | -------------- | --------- | ---------- | ----------------- |
| 20000     | S 皮肤箱       | 0.03      | 0.000395   | **0.02039** ✱     |
| 10014     | 普通宝石匣     | 5         | 0.06576    | **0.16576** ✱     |
| 10015     | 璀璨宝石匣     | 1         | 0.01315    | 0.01315           |
| 10028     | 道具箱（填充） | 70        | 0.92069    | 0.92069           |
| **Total** |                | **76.03** | **1.0000** |                   |

✱ **Pity p = "含保底每抽期望概率"** = `random p + cyclic-pity contribution`. These values are the **gold-standard for engine validation** — Monte Carlo simulation must converge to them within ±2% over 100k pulls. This is the Sprint 1 acceptance gate.

### XM's rules (per `skinBox.json` row)

| Column            | Value         | Meaning                                    |
| ----------------- | ------------- | ------------------------------------------ |
| `smallBaodi`      | `10014`       | Every 10 pulls force one `10014`           |
| `bigBaodi`        | `20000`       | Every 50 pulls force one `20000`           |
| `firstDrawResId`  | `[{...}]`     | First N pulls fixed script (new account)   |
| `ticketDrawResId` | `10020`       | Ticket-pull consumes item 10020 ×1         |
| `normalDrawResId` | `6`           | Normal pull consumes resource 6, 200/抽    |
| `freeTimes`       | `0`           | Daily free pulls (ads / login)             |
| `limit`           | `999`         | Daily cap                                  |

`processBox` (累计抽数奖励) is deprecated — present in legacy tables, not modeled.

---

## 3. Schema Design

All authoring goes through one Zod schema: `src/engine/schema.ts`.

### Core entities

```
PoolSchema
├── id, name, description
├── buckets[]        — first-level draw targets (boxes)
│   ├── id, name, kind, weight, color
│   └── contents[]   — second-level items (resId, weight, min/maxCount)
├── items[]          — item metadata (resId, name, type, quality, isFeatured)
├── drawModes[]      — cost / daily-limit info (normal / ticket / free)
└── rules[]          — discriminated union of mechanics
```

Why decouple `items[]` from `buckets[].contents[]`?

- Same `resId` can appear across multiple buckets without duplicating metadata.
- Item table is the **single source of truth** for display name / type / quality.
- Matches XM's `物品对照表` / `保底规则` sheet separation.

### Rules (2 types, discriminated union)

| Rule                  | XM convention | Implementation summary                                |
| --------------------- | ------------- | ----------------------------------------------------- |
| `cyclic-pity`         | 周期保底       | Every N pulls without bucket X dropping → force X     |
| `first-draw-script`   | 首抽脚本       | First N pulls deliver fixed item array; eats counts; does NOT reset bucket counters (D4) |

Future mechanics (UP 50/50, cross-pool 保底 继承) will be added as plugin rules when XM project actually needs them — not speculatively.

### Built-in validation

`validatePool(pool)` returns `ConfigIssue[]`:

1. **Undefined item references** — bucket `contents` pointing to a `resId` not in `items[]`.
2. **Duplicate entries** — same item appears twice in one bucket (catches the bug XM has on bucket 10015 阶3).
3. **Invalid rule targets** — rules targeting buckets that don't exist.
4. **Stale script references** — `first-draw-script` pointing to missing items.

Issues surface as warnings — the simulator still runs but flags problems for the designer.

---

## 4. Engine Architecture

```
src/engine/
├── types.ts          ← PoolConfig, PoolState (immutable), Item, PullResult
├── schema.ts         ← Zod PoolSchema + validatePool
├── adapter.ts        ← PoolSchema → PoolConfig (flatten 2-level box)
├── simulator.ts      ← pull(), pullMany(), createInitialState() — pure
└── rules/
    ├── rule.ts             ← Rule plugin interface (4 hooks)
    ├── cyclic-pity.ts
    └── first-draw-script.ts
```

### Rule plugin interface (4 hooks)

```ts
interface Rule<P> {
  type: string
  modifyRates?: (rates, ctx, params) => Record<Rarity, number>
  forceRarity?: (ctx, params) => Rarity | null
  selectItem?:  (rarity, items, ctx, params)
                => Item | { item: Item; affectsBucketCounters?: boolean } | null
  afterPull?:   (result, state, params) => PoolState
}
```

The selectItem return type supports D4: when a rule returns `{ item, affectsBucketCounters: false }`, the simulator advances all bucket counters without resetting the selected one.

### Pull pipeline (deterministic order)

```
1. Seed rates from bucket weights
2. Run all modifyRates rules
3. Run all forceRarity rules (first non-null wins)
4. Sample bucket (or use forced bucket)
5. Run all selectItem rules (first non-null wins)
6. Fall back to weighted selection within bucket
7. Build new PoolState — counters either selected-reset OR all-increment
8. Run all afterPull rules
```

State is always immutable. Pure functions throughout.

---

## 5. Design Decisions (resolved)

**D1+D4. First-draw script: eats counts, does NOT reset bucket counters.**
Scripted pulls increment `totalPulls`, consume cost / daily-limit, advance every bucket counter — but the bucket the scripted item nominally belongs to does NOT reset. So if the script gives 艾拉娜 (bucket 20000) at pull 1, the bigBaodi cycle counter for 20000 still advances 1→2→…→50, and bigBaodi WILL fire at pull 50 forcing another natural 20000 drop.

Implementation: `Rule.selectItem` returns `{ item, affectsBucketCounters: false }` for scripted pulls. Simulator branches on this flag.

**D2. Distribution analytics group by terminal item, not bucket.**
When 一抽 lands on bucket 20000, the chart shows "P(80001 莉亚)" not "P(20000 S皮肤箱)". The engine already returns the terminal `Item` in `PullResult.item`.

**D3. Cumulative reward (`processBox`) scoped out.** Deprecated by the design team.

**D5. Rule execution order = array order.**
Within a hook, rules fire in `rules[]` order; first non-null result wins for `forceRarity` / `selectItem`. Authoring order = precedence.

**D6. Excel adapter scope reduced.**
Originally planned as a lenient multi-file mapping wizard. Now: a hardcoded XM importer reads the 4 relevant sheets directly. Generic-import design is parked in git history if needed later.

---

## 6. Validation: Engine vs XM Gold Standard

The XM rules sheet provides closed-form formulas for "含保底每抽期望概率". These are the **acceptance criteria** for Sprint 1:

| Bucket | Formula value | Engine target (100k pulls)        |
| ------ | ------------- | ---------------------------------- |
| 20000  | 0.02039       | 0.020 ± 0.002 (binomial 95% CI)    |
| 10014  | 0.16576       | 0.166 ± 0.003                      |
| 10015  | 0.01315       | 0.013 ± 0.001                      |
| 10028  | 0.92069       | 0.921 ± 0.002                      |

If Monte Carlo doesn't converge to these, the engine's pity logic is wrong — full stop. Sprint 2 onwards is gated on this passing.

---

## 7. Out of Scope (current sprint set)

- Mechanics XM doesn't use yet: HardPity (Genshin), SoftPity (Genshin), GuaranteedFeature 50/50 (Genshin). Add when XM adds.
- Generic multi-project Excel importer + field-mapping wizard + per-project mapping memory.
- Reference pool validation against 原神 / 方舟 (universality claim dropped).
- Real-time live-ops parameter A/B testing — future.
- Multi-language UI (Chinese only initially).

Sprint 3 (Value A multi-banner) will introduce **cross-pool state** (`PlayerContext`: 保底继承 / UP 传递 / 货币累计). Design for that emerges then.

---

_Last updated: 2026-05-18 — Sprint 1 starting. Schema + design locked, implementation in progress._
