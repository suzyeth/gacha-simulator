# Gacha Simulator

A real-time gacha pool simulator for game numerical designers (数值策划). Edit weights, see distribution shifts instantly. No engineer round-trips.

🚀 **[Live demo → gacha-simulator-ten.vercel.app](https://gacha-simulator-ten.vercel.app)** | [Quick start](#run-locally) | [Architecture](#architecture)

---

## What it does

| Capability | Why it matters |
| --- | --- |
| **2-level draw engine** (bucket → in-bucket item) with plugin rules (cyclic pity, first-draw script) | Models 中国二游 standard gacha pattern faithfully — verified within ±0.4% of A1-cyclic theoretical values over 200k Monte Carlo pulls |
| **Target-driven simulation** (1000 players each pull until they get item X) | Answers the real question: *"What's the P90 cost for an unlucky player to get this skin?"* — Excel can't easily do this |
| **Real-time inline editing** (weights, percentages, pity periods, structural CRUD) | Designer owns the iteration loop: click a number, edit, see new distribution. Zero engineer-in-the-loop |
| **Formula-vs-reality deviation panel** | Surfaces that the common `random + 1/N` spreadsheet formula overstates true drop rate by ~20% for higher-`p` buckets — actionable insight for ARPU modeling |
| **Multi-scheme management** with `localStorage` persistence + JSON / xlsx import | Save baseline; clone; tweak; compare. Import 中国二游策划表 (R03 Chinese / R05 English convention) directly |
| **Web Worker batch sim** | 100k+ pulls in ~500ms without blocking the UI |

## The headline insight

The default reference-pool simulation shows the spreadsheet formula `random_p + 1/N` is **only an approximation**. For bucket `10014` (Common Gem Box):

| | Formula P | A1 closed-form | Engine measured (200k MC) | Formula gap |
| --- | --- | --- | --- | --- |
| `P(10014)` per pull | 0.16576 | 0.1333 | 0.13276 | **-20%** |

If you're using the spreadsheet formula for ARPU / bundle pricing / economy modeling, you may be **overestimating drop rates by ~25%** for higher-`p` buckets. That's the kind of finding that should change real decisions.

---

## Run locally

```bash
git clone <this-repo>
cd gacha-simulator
npm install
npm run dev          # http://localhost:5173
```

Other useful commands:

```bash
npm test             # 60 tests across engine, rules, adapter, gold-standard
npm run build        # production bundle → dist/
npm run preview      # serve the production build locally
```

Requires Node 18+. SheetJS (`xlsx`) is loaded from `cdn.sheetjs.com` per their distribution policy.

---

## 5-minute walkthrough

1. **Default pool loaded** — 2-level draw, 4 buckets (Hero Box / Common Gem Box / Rare Gem Box / Item Box), `smallBaodi`=10 / `bigBaodi`=50.
2. **Click "🎯 Run 1000 players until they acquire Hero 01"** in the right panel — wait ~500ms → see P50/P75/P90/P99 pull counts + ¥ cost + histogram.
3. **Note the ⚠ formula-deviation panel** — bucket `10014` row shows `-20%` deviation from the spreadsheet formula. That's the value-add insight.
4. **Click ▶ next to bucket `10014`** in the left panel → expand to see 7 gem tiers with editable weights AND editable percentages.
5. **Click `0.0010%` on `Prismatic Gem`** → type `5` → Enter. Engine reverse-derives the weight. Re-run the simulation; observe ARPU shift.
6. **Top-right: switch / clone / export schemes**, or upload a JSON config to A/B against the default.

---

## Architecture

```
src/
├── engine/                     ← pure functions, zero UI deps
│   ├── types.ts                ← PoolConfig, PoolState (immutable), Item, PullResult
│   ├── schema.ts               ← Zod PoolSchema + validatePool
│   ├── adapter.ts              ← schema → engine (normalize bucket weights to baseRate)
│   ├── simulator.ts            ← pull(), pullMany(), createInitialState() — pure
│   ├── scenarios.ts            ← simulateUntilTarget, multiTrialUntilTarget, percentile
│   └── rules/
│       ├── rule.ts             ← 4-hook plugin interface (modifyRates, forceRarity, selectItem, afterPull)
│       ├── cyclic-pity.ts      ← A1 semantic: counter resets on natural drop
│       ├── first-draw-script.ts ← First-N-pulls scripted item; D4: scripted pulls don't reset bucket counters
│       └── registry.ts
├── importers/
│   └── xlsx-adapter.ts         ← SheetJS-based parser, R03/R05 convention, classify + stitch
├── store/                      ← Zustand
│   ├── config-store.ts         ← multi-scheme + localStorage persist
│   └── sim-store.ts            ← results + carrying engineState across runs
├── workers/
│   └── sim.worker.ts           ← off-main-thread batch Monte Carlo
└── ui/                         ← React components
    ├── PoolSummary.tsx         ← inline-editable weights/%/periods/CRUD
    ├── SimControls.tsx
    ├── DistributionChart.tsx   ← terminal-item bars, color-coded by bucket
    ├── TargetSimPanel.tsx      ← P50/P75/P90/P99 + histogram with percentile lines
    ├── FormulaComparePanel.tsx ← the -20% deviation insight
    ├── EconomyPanel.tsx
    ├── ConfigSelector.tsx      ← top-bar multi-scheme + import/export
    └── EditableNumber.tsx
```

### Engine pipeline (one pull)

```
1. Seed rates from bucket weights
2. Apply all modifyRates rules (e.g., soft pity)
3. Apply all forceRarity rules (e.g., cyclic pity at period boundary)
4. Sample bucket (or use forced)
5. Apply all selectItem rules (e.g., first-draw-script overrides selection)
6. Fall back to weighted-uniform selection within bucket
7. Build new PoolState with pity counters advanced (immutable)
8. Apply all afterPull rules
```

Adding a new gacha mechanic = drop a file in `src/engine/rules/`. Engine pipeline does not change.

### Gold standard test

`src/engine/__tests__/xm-gold-standard.test.ts` runs 200,000 Monte Carlo pulls and asserts per-bucket frequencies fall within tight bounds of closed-form A1 theoretical values. Gates the whole project: if engine math drifts, ship is blocked.

---

## Deployment

### Option A — Vercel CLI

```bash
npm install -g vercel
vercel login
vercel --prod
```

The `vercel.json` in this repo declares the Vite framework and SPA rewrites. Vercel will auto-build via `npm run build` and serve `dist/`.

### Option B — Connect a GitHub repo

1. Push this directory to a GitHub repo
2. Open <https://vercel.com/new>, import the repo
3. Vercel auto-detects Vite; click Deploy

### Option C — Static hosting

`npm run build` produces a fully static `dist/` directory. Drop it on any static host (Netlify, GitHub Pages, S3 + CloudFront, etc.).

---

## Status & roadmap

**Built (60 tests passing):**
- ✅ Plugin-rule engine (2 rules: cyclic-pity, first-draw-script)
- ✅ XM gold-standard validation (within ±0.4%)
- ✅ Target-driven simulation + percentiles + histogram
- ✅ Real-time inline editing (weights, %, periods, structural CRUD)
- ✅ Multi-scheme management with localStorage + JSON / xlsx import
- ✅ Web Worker for non-blocking 100k+ batch MC
- ✅ Economy panel + formula-deviation insight

**Deferred (in priority order):**
- A/B compare view (two schemes side-by-side, numerical diff table)
- Cumulative probability curve (P(by pull N have at least 1 X))
- Undo/redo for the editor
- Health radar (基尼系数 / 同类对照 / ARPU intervals)
- Multi-banner / cross-pool simulation with PlayerContext (保底继承 / UP 50-50 / 复刻池)
- Genshin/Star Rail rule pack (soft-pity, hard-pity, guaranteed-featured) — add when XM does

---

## 中文简介

数值策划日常工具，定位 **"策划全程自主、零工程师介入"**：改 UI 上任意权重 / 概率 / 保底周期 → 立即重算 → 实时看分布。

核心价值点：
- **目标驱动模拟**：1000 个玩家各自抽到目标为止，看 P50/P75/P90/P99 成本分位数 —— Excel 死活算不出来的数
- **公式 vs 引擎实测 diff**：暴露你 Excel 公式跟实际游戏数学的偏离（约 20% 对高 p bucket）
- **多方案管理 + JSON / xlsx 导入**：兼容中国二游策划表 R03 中文 / R05 英文双约定
- **实时编辑**：权重、箱内概率、保底周期、加/删 bucket/物品/规则 全部 click-to-edit
- **A1 周期保底**（counter on drop reset）—— 国内二游主流；引擎数学经 200k 蒙模验证 ±0.4%

5 分钟试用：默认 Reference Pool → 点 "🎯 Run 1000 players until acquire Hero 01" → 看 P90/P99 → 看公式偏离面板。

---

## License

Private — author's portfolio + internal tool. No license granted for commercial use without permission.
