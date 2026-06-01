import type { z } from 'zod'
import type { PoolSchema } from '../engine/schema'

// Use the Zod INPUT type so fields with .default(...) (like isFeatured,
// costPerOne, costPerTen) can be omitted in the preset literal. The
// schema's .parse() at load time fills in the defaults to produce the
// OUTPUT type the rest of the app consumes.
type PoolInput = z.input<typeof PoolSchema>

/**
 * Reference gacha pool — anonymized 2-level draw schema for the public demo.
 *
 * Mechanics: A1 cyclic-pity (counter resets on natural drop, replacement-style).
 *   - smallBaodi: every 10 pulls, force bucket 10014 (Common Gem Box)
 *   - bigBaodi:   every 50 pulls, force bucket 20000 (Hero Box, 9 Heroes + 5 Aides)
 *
 * Numeric structure (resIds / weights / bucket layout) preserved from an
 * internal industry-standard config; all display names + types replaced with
 * neutral English placeholders so the demo can be deployed publicly without
 * leaking proprietary IP.
 */
export const xmTingyuanPool: PoolInput = {
  id: 'reference-pool',
  name: 'Reference Pool (Hero Skin)',
  description: 'Anonymized 2-level draw · A1 cyclic pity (smallBaodi=10, bigBaodi=50)',
  buckets: [
    {
      id: '20000',
      name: 'Hero Box (S-tier)',
      kind: 'box',
      weight: 0.03,
      color: '#f5a623',
      contents: [
        // 9 S-tier Hero skins (uniform weight 7100)
        { resId: '80001', weight: 7100, minCount: 1 },
        { resId: '80002', weight: 7100, minCount: 1 },
        { resId: '80003', weight: 7100, minCount: 1 },
        { resId: '80005', weight: 7100, minCount: 1 },
        { resId: '80007', weight: 7100, minCount: 1 },
        { resId: '80008', weight: 7100, minCount: 1 },
        { resId: '80009', weight: 7100, minCount: 1 },
        { resId: '80010', weight: 7100, minCount: 1 },
        { resId: '80011', weight: 7100, minCount: 1 },
        // 5 Aides (slightly higher weight)
        { resId: '90101', weight: 7180, minCount: 1 },
        { resId: '90102', weight: 7180, minCount: 1 },
        { resId: '90106', weight: 7180, minCount: 1 },
        { resId: '90107', weight: 7180, minCount: 1 },
        { resId: '90108', weight: 7180, minCount: 1 },
      ],
    },
    {
      id: '10014',
      name: 'Common Gem Box',
      kind: 'box',
      weight: 5,
      color: '#7ed321',
      contents: [
        { resId: 'gem-1', weight: 59800, minCount: 1 },
        { resId: 'gem-2', weight: 30000, minCount: 1 },
        { resId: 'gem-3', weight: 9900, minCount: 1 },
        { resId: 'gem-4', weight: 200, minCount: 1 },
        { resId: 'gem-5', weight: 90, minCount: 1 },
        { resId: 'gem-6', weight: 9, minCount: 1 },
        { resId: 'gem-7', weight: 1, minCount: 1 },
      ],
    },
    {
      id: '10015',
      name: 'Rare Gem Box',
      kind: 'box',
      weight: 1,
      color: '#bd10e0',
      contents: [
        { resId: 'gem-3', weight: 59000, minCount: 1 },
        { resId: 'gem-4', weight: 31000, minCount: 1 },
        { resId: 'gem-5', weight: 9000, minCount: 1 },
        { resId: 'gem-6', weight: 900, minCount: 1 },
        { resId: 'gem-7', weight: 100, minCount: 1 },
      ],
    },
    {
      id: '10028',
      name: 'Item Box (filler)',
      kind: 'box',
      weight: 70,
      color: '#6b7280',
      contents: [
        { resId: '10001', weight: 100, minCount: 1 },
        { resId: '10002', weight: 100, minCount: 1 },
        { resId: '10003', weight: 100, minCount: 1 },
        { resId: '10004', weight: 100, minCount: 1 },
        { resId: '10005', weight: 100, minCount: 1 },
        { resId: '10006', weight: 100, minCount: 1 },
      ],
    },
  ],
  items: [
    // S-tier Hero skins
    { resId: '80001', name: 'Hero 01', type: 'Skin', quality: 'Legendary' },
    { resId: '80002', name: 'Hero 02', type: 'Skin', quality: 'Legendary' },
    { resId: '80003', name: 'Hero 03', type: 'Skin', quality: 'Legendary' },
    { resId: '80005', name: 'Hero 04', type: 'Skin', quality: 'Legendary' },
    { resId: '80007', name: 'Hero 05', type: 'Skin', quality: 'Legendary' },
    { resId: '80008', name: 'Hero 06', type: 'Skin', quality: 'Legendary' },
    { resId: '80009', name: 'Hero 07', type: 'Skin', quality: 'Legendary' },
    { resId: '80010', name: 'Hero 08', type: 'Skin', quality: 'Legendary' },
    { resId: '80011', name: 'Hero 09', type: 'Skin', quality: 'Legendary' },
    // Aides
    { resId: '90101', name: 'Aide 01', type: 'Aide', quality: 'Legendary' },
    { resId: '90102', name: 'Aide 02', type: 'Aide', quality: 'Legendary' },
    { resId: '90106', name: 'Aide 03', type: 'Aide', quality: 'Legendary' },
    { resId: '90107', name: 'Aide 04', type: 'Aide', quality: 'Legendary' },
    { resId: '90108', name: 'Aide 05', type: 'Aide', quality: 'Legendary' },
    // Gems (rarity tiers)
    { resId: 'gem-1', name: 'White Gem', type: 'Gem', quality: 'Common' },
    { resId: 'gem-2', name: 'Green Gem', type: 'Gem', quality: 'Fine' },
    { resId: 'gem-3', name: 'Blue Gem', type: 'Gem', quality: 'Rare' },
    { resId: 'gem-4', name: 'Purple Gem', type: 'Gem', quality: 'Epic' },
    { resId: 'gem-5', name: 'Gold Gem', type: 'Gem', quality: 'Legendary' },
    { resId: 'gem-6', name: 'Red Gem', type: 'Gem', quality: 'Mythic' },
    { resId: 'gem-7', name: 'Prismatic Gem', type: 'Gem', quality: 'Divine' },
    // Equipment blueprints
    { resId: '10001', name: 'Weapon Blueprint', type: 'Equipment' },
    { resId: '10002', name: 'Helmet Blueprint', type: 'Equipment' },
    { resId: '10003', name: 'Armor Blueprint', type: 'Equipment' },
    { resId: '10004', name: 'Necklace Blueprint', type: 'Equipment' },
    { resId: '10005', name: 'Ring Blueprint', type: 'Equipment' },
    { resId: '10006', name: 'Boots Blueprint', type: 'Equipment' },
  ],
  drawModes: [
    { id: 'normal', label: 'Normal Pull', costResId: '6', costPerOne: 200, costPerTen: 2000 },
    { id: 'ticket', label: 'Ticket Pull', costResId: '10020', costPerOne: 1, costPerTen: 10 },
    { id: 'free', label: 'Free Pull', dailyTimes: 0 },
  ],
  rules: [
    { type: 'cyclic-pity', params: { period: 10, bucketId: '10014' } }, // smallBaodi
    { type: 'cyclic-pity', params: { period: 50, bucketId: '20000' } }, // bigBaodi
  ],
}

/**
 * Closed-form per-bucket P expectations (A1 theory) — used by the
 * formula-vs-reality comparison panel.
 *
 * E[T_drop] = (1 - (1-p)^N) / p
 * theoryP   = 1 / E[T_drop]
 *
 * (10015/10028 values are empirical from the 200k Monte Carlo gold-standard,
 * because their displacement by pity-forced pulls doesn't have a clean
 * closed form.)
 */
export const xmExpectedDistribution = {
  '20000': {
    name: 'Hero Box',
    randomP: 0.000395,
    formulaP: 0.02039, // designer's spreadsheet formula: p + 1/N
    theoryP: 0.0202, // closed-form: (1 - (1-p)^50) / p
  },
  '10014': {
    name: 'Common Gem Box',
    randomP: 0.06576,
    formulaP: 0.16576,
    theoryP: 0.1333,
  },
  '10015': {
    name: 'Rare Gem Box',
    randomP: 0.01315,
    formulaP: 0.01315,
    theoryP: 0.0119,
  },
  '10028': {
    name: 'Item Box',
    randomP: 0.92069,
    formulaP: 0.92069,
    theoryP: 0.8352,
  },
} as const
