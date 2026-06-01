/**
 * LootHaulPanel — 获得物品总结面板
 *
 * 按 item.type 分类聚合 PullResult,显示:
 *   - 每个类别的总获得数量
 *   - 每个物品的实际获得 vs 理论期望
 *   - 理论 / 实际 偏差 (±%)
 *
 * 跟 DistributionChart 的区别:
 *   DistributionChart = 横向条形图比较 % 占比
 *   LootHaulPanel     = 按类别聚合的清单视图,看"具体得了多少"
 */
import { Fragment, useMemo, useState } from 'react'
import type { PoolSchema } from '../engine/schema'
import type { PullResult } from '../engine/types'
import { useT } from '../i18n/store'
import { computeEffectiveBucketP } from './headline-drop-rate'

interface Props {
  pool: PoolSchema
  results: PullResult[]
}

interface ItemRow {
  resId: string
  name: string
  type: string
  quality?: string
  bucketId: string
  bucketColor: string
  observed: number
  theoreticalP: number  // per-pull probability
  theoreticalCount: number  // = theoreticalP × totalPulls
}

interface CategoryGroup {
  type: string
  rows: ItemRow[]
  observed: number
  theoreticalCount: number
  theoreticalP: number  // sum of all items' per-pull probabilities
}

function buildGroups(
  pool: PoolSchema,
  results: ReadonlyArray<PullResult>,
): { groups: CategoryGroup[]; totalPulls: number } {
  const totalPulls = results.length

  // Tally observed counts by resId
  const observed = new Map<string, number>()
  for (const r of results) {
    observed.set(r.item.id, (observed.get(r.item.id) ?? 0) + 1)
  }

  // Item lookup
  const itemMeta = new Map(pool.items.map((i) => [i.resId, i]))
  const bucketColor = new Map(pool.buckets.map((b) => [b.id, b.color ?? '#888888']))

  // 用「有效概率」(含 cyclic-pity 修正)作为期望基准,而不是裸权重比。
  // 否则非保底箱的物品会系统性显示 ~-9% 偏差(保底挤占格子),误导成"模拟不准"。
  const effBucketP = computeEffectiveBucketP(pool)

  // Build all item rows (one row per item per bucket appearance)
  // If the same resId appears in multiple buckets we sum their per-pull probabilities.
  const rowMap = new Map<string, ItemRow>()
  for (const bucket of pool.buckets) {
    const totalContentW = bucket.contents.reduce((s, c) => s + c.weight, 0)
    const pBucket = effBucketP.get(bucket.id) ?? 0
    for (const c of bucket.contents) {
      const meta = itemMeta.get(c.resId)
      const pItemInBucket = totalContentW > 0 ? c.weight / totalContentW : 0
      const pTotal = pBucket * pItemInBucket
      const existing = rowMap.get(c.resId)
      if (existing) {
        existing.theoreticalP += pTotal
        existing.theoreticalCount = existing.theoreticalP * totalPulls
      } else {
        rowMap.set(c.resId, {
          resId: c.resId,
          name: meta?.name ?? c.resId,
          type: meta?.type ?? '未分类',
          quality: meta?.quality,
          bucketId: bucket.id,
          bucketColor: bucketColor.get(bucket.id) ?? '#888888',
          observed: observed.get(c.resId) ?? 0,
          theoreticalP: pTotal,
          theoreticalCount: pTotal * totalPulls,
        })
      }
    }
  }

  // Group by type
  const groupMap = new Map<string, CategoryGroup>()
  for (const row of rowMap.values()) {
    const g = groupMap.get(row.type)
    if (g) {
      g.rows.push(row)
      g.observed += row.observed
      g.theoreticalP += row.theoreticalP
      g.theoreticalCount += row.theoreticalCount
    } else {
      groupMap.set(row.type, {
        type: row.type,
        rows: [row],
        observed: row.observed,
        theoreticalP: row.theoreticalP,
        theoreticalCount: row.theoreticalCount,
      })
    }
  }

  // Sort: groups by total expected count desc; rows within group by expected count desc
  const groups = Array.from(groupMap.values())
  groups.forEach((g) => g.rows.sort((a, b) => b.theoreticalP - a.theoreticalP))
  groups.sort((a, b) => b.theoreticalP - a.theoreticalP)

  return { groups, totalPulls }
}

function fmtCount(n: number): string {
  if (n === 0) return '0'
  if (n < 0.01) return n.toExponential(1)
  if (n < 1) return n.toFixed(2)
  if (n < 100) return n.toFixed(1)
  return Math.round(n).toLocaleString()
}

function fmtDelta(observed: number, expected: number): {
  text: string
  color: string
} {
  if (expected === 0) {
    return observed > 0
      ? { text: '+∞', color: 'text-emerald-400' }
      : { text: '—', color: 'text-zinc-600' }
  }
  const delta = (observed - expected) / expected
  const pct = (delta * 100).toFixed(1)
  const sign = delta >= 0 ? '+' : ''
  const color = Math.abs(delta) < 0.05
    ? 'text-zinc-400'
    : delta > 0
      ? 'text-emerald-400'
      : 'text-rose-400'
  return { text: `${sign}${pct}%`, color }
}

export function LootHaulPanel({ pool, results }: Props) {
  const t = useT()
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [hideZero, setHideZero] = useState(true)

  const { groups, totalPulls } = useMemo(
    () => buildGroups(pool, results),
    [pool, results],
  )

  if (groups.length === 0) {
    return (
      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="text-lg font-semibold">{t('loot.title')}</h2>
        <p className="text-xs text-zinc-500 mt-2">{t('loot.empty')}</p>
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-sky-800/40 bg-gradient-to-br from-zinc-900 to-sky-950/15 p-4">
      <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
        <h2 className="text-lg font-semibold text-sky-200">{t('loot.title')}</h2>
        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5 text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={hideZero}
              onChange={(e) => setHideZero(e.target.checked)}
              className="accent-sky-500"
            />
            <span>{t('loot.hide_zero')}</span>
          </label>
          <span className="text-zinc-500 tabular-nums">
            {t('loot.total_pulls', { n: totalPulls.toLocaleString() })}
          </span>
        </div>
      </div>

      {totalPulls === 0 && (
        <p className="text-[11px] text-sky-700/80 mb-3">{t('loot.theoretical_only')}</p>
      )}

      <div className="space-y-2">
        <div className="grid grid-cols-12 gap-2 text-[10px] text-zinc-500 uppercase tracking-wider pb-1 border-b border-zinc-800">
          <div className="col-span-5">{t('loot.col.item')}</div>
          <div className="col-span-2 text-right">{t('loot.col.theoretical')}</div>
          <div className="col-span-2 text-right">{t('loot.col.observed')}</div>
          <div className="col-span-2 text-right">{t('loot.col.delta')}</div>
          <div className="col-span-1 text-right">{t('loot.col.rate')}</div>
        </div>

        {groups.map((g) => {
          const isCollapsed = collapsed[g.type]
          const groupDelta = fmtDelta(g.observed, g.theoreticalCount)
          return (
            <Fragment key={g.type}>
              {/* Category header */}
              <div
                className="grid grid-cols-12 gap-2 items-center py-1.5 px-1 bg-zinc-950/50 rounded cursor-pointer hover:bg-zinc-950/80 transition"
                onClick={() => setCollapsed((c) => ({ ...c, [g.type]: !c[g.type] }))}
              >
                <div className="col-span-5 flex items-center gap-2">
                  <span className="text-zinc-500 text-xs w-3">
                    {isCollapsed ? '▶' : '▼'}
                  </span>
                  <span className="font-semibold text-sky-100">{g.type}</span>
                  <span className="text-[10px] text-zinc-500">
                    ({g.rows.length} {t('loot.items_unit')})
                  </span>
                </div>
                <div className="col-span-2 text-right tabular-nums text-zinc-400 text-sm">
                  {fmtCount(g.theoreticalCount)}
                </div>
                <div className="col-span-2 text-right tabular-nums text-sky-200 text-sm font-semibold">
                  {totalPulls > 0 ? g.observed.toLocaleString() : '—'}
                </div>
                <div className={`col-span-2 text-right tabular-nums text-sm ${groupDelta.color}`}>
                  {totalPulls > 0 ? groupDelta.text : '—'}
                </div>
                <div className="col-span-1 text-right tabular-nums text-zinc-500 text-xs">
                  {(g.theoreticalP * 100).toFixed(2)}%
                </div>
              </div>

              {/* Item rows */}
              {!isCollapsed &&
                g.rows
                  .filter((r) => !hideZero || r.theoreticalP > 0 || r.observed > 0)
                  .map((row) => {
                    const rowDelta = fmtDelta(row.observed, row.theoreticalCount)
                    const ratePerPull = row.theoreticalP * 100
                    return (
                      <div
                        key={row.resId}
                        className="grid grid-cols-12 gap-2 items-center py-1 px-1 text-sm hover:bg-zinc-900/50 transition"
                      >
                        <div className="col-span-5 flex items-center gap-2 min-w-0">
                          <span
                            className="inline-block w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: row.bucketColor }}
                          />
                          <span className="text-zinc-200 truncate" title={row.name}>
                            {row.name}
                          </span>
                          {row.quality && (
                            <span className="text-[10px] text-zinc-600 shrink-0">
                              [{row.quality}]
                            </span>
                          )}
                          <span className="text-[10px] text-zinc-700 font-mono shrink-0">
                            {row.resId}
                          </span>
                        </div>
                        <div className="col-span-2 text-right tabular-nums text-zinc-400">
                          {fmtCount(row.theoreticalCount)}
                        </div>
                        <div className="col-span-2 text-right tabular-nums text-zinc-100 font-semibold">
                          {totalPulls > 0 ? row.observed.toLocaleString() : '—'}
                        </div>
                        <div className={`col-span-2 text-right tabular-nums text-xs ${rowDelta.color}`}>
                          {totalPulls > 0 ? rowDelta.text : '—'}
                        </div>
                        <div className="col-span-1 text-right tabular-nums text-zinc-600 text-xs">
                          {ratePerPull < 0.001
                            ? ratePerPull.toExponential(0)
                            : ratePerPull.toFixed(2) + '%'}
                        </div>
                      </div>
                    )
                  })}
            </Fragment>
          )
        })}
      </div>

      <p className="text-[10px] text-zinc-600 mt-3 leading-relaxed">
        {t('loot.help')}
      </p>
    </section>
  )
}
