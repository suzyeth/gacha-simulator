import { useMemo, useState } from 'react'
import type { PoolSchema } from '../engine/schema'
import type { PullResult } from '../engine/types'
import { useT } from '../i18n/store'
import {
  pickHeadlineBucket,
  pickHeadlineItem,
  computeHeadlineKpi,
  type HeadlineSelection,
} from './headline-drop-rate'

interface Props {
  pool: PoolSchema
  results: PullResult[]
}

const AUTO = '__auto__' as const

function fmtPct(p: number, digits = 3): string {
  if (p === 0) return '0.000%'
  if (p < 0.0001) return `${(p * 100).toExponential(2)}%`
  return `${(p * 100).toFixed(digits)}%`
}

function fmtDelta(delta: number, digits = 3): string {
  const sign = delta >= 0 ? '+' : ''
  return `${sign}${(delta * 100).toFixed(digits)}pp`
}

/** Decode a <select> value string back into a selection. */
function decodeSel(v: string): HeadlineSelection | null {
  if (v.startsWith('bucket:')) return { kind: 'bucket', bucketId: v.slice(7) }
  if (v.startsWith('item:')) return { kind: 'item', resId: v.slice(5) }
  return null
}

/**
 * Headline KPI strip.
 *
 * Selection covers both bucket-level (整个 bucket 的命中率) AND item-level
 * (具体物品的真实掉率). Items are grouped under their parent bucket in the
 * dropdown via <optgroup>, so a designer can quickly pick "多彩宝石" or
 * "莉亚" rather than just "璀璨宝石箱".
 */
export function HeadlineDropRate({ pool, results }: Props) {
  const t = useT()
  const [selectedRaw, setSelectedRaw] = useState<string>(AUTO)

  // Reset selection to AUTO when the pool changes (render-phase state adjust
  // instead of an effect, per React's "storing info from previous renders").
  const [prevPoolId, setPrevPoolId] = useState(pool.id)
  if (pool.id !== prevPoolId) {
    setPrevPoolId(pool.id)
    setSelectedRaw(AUTO)
  }

  const totalWeight = useMemo(
    () => pool.buckets.reduce((s, b) => s + b.weight, 0),
    [pool.buckets],
  )

  const autoItemId = useMemo(() => pickHeadlineItem(pool), [pool])
  const autoBucketId = useMemo(() => pickHeadlineBucket(pool), [pool])
  const isAuto = selectedRaw === AUTO

  const autoItemName = useMemo(
    () => pool.items.find((i) => i.resId === autoItemId)?.name ?? autoItemId,
    [pool.items, autoItemId],
  )

  const resolved: HeadlineSelection | null = useMemo(() => {
    if (isAuto) {
      // 默认核心资源 = 具体物品(宝箱只是容器,玩家实得的是物品)
      if (autoItemId) return { kind: 'item', resId: autoItemId }
      return autoBucketId ? { kind: 'bucket', bucketId: autoBucketId } : null
    }
    return decodeSel(selectedRaw)
  }, [isAuto, selectedRaw, autoItemId, autoBucketId])

  const kpi = useMemo(
    () => (resolved ? computeHeadlineKpi(pool, results, resolved) : null),
    [pool, results, resolved],
  )

  // 物品下拉:按 type 分组,组内按理论概率从高到低排
  const itemOptionGroups = useMemo(() => {
    const byType = new Map<
      string,
      Array<{ it: PoolSchema['items'][number]; pTheory: number }>
    >()
    for (const it of pool.items) {
      let pTheory = 0
      for (const b of pool.buckets) {
        const c = b.contents.find((x) => x.resId === it.resId)
        if (!c) continue
        const sumW = b.contents.reduce((s, x) => s + x.weight, 0)
        const pInBucket = sumW > 0 ? c.weight / sumW : 0
        const pBucket = totalWeight > 0 ? b.weight / totalWeight : 0
        pTheory += pBucket * pInBucket
      }
      if (pTheory <= 0) continue
      const type = it.type ?? '未分类'
      if (!byType.has(type)) byType.set(type, [])
      byType.get(type)!.push({ it, pTheory })
    }
    const groups = Array.from(byType.entries()).map(([type, items]) => {
      items.sort((a, b) => b.pTheory - a.pTheory)
      const groupP = items.reduce((s, x) => s + x.pTheory, 0)
      return { type, items, groupP }
    })
    // 组排序:整组理论概率高的在前
    groups.sort((a, b) => b.groupP - a.groupP)
    return groups
  }, [pool.items, pool.buckets, totalWeight])

  if (!kpi) return null

  const hasObserved = kpi.totalPulls > 0
  const devColor = !hasObserved
    ? 'text-zinc-600'
    : kpi.deviation >= 0
      ? 'text-emerald-400'
      : 'text-rose-400'

  const itemMeta = pool.items.find((i) =>
    kpi.selection.kind === 'item' ? i.resId === kpi.selection.resId : false,
  )
  const bucketObj = pool.buckets.find((b) => b.id === kpi.bucketId)
  const dotColor = bucketObj?.color ?? '#a78bfa'

  return (
    <section className="rounded-lg border border-amber-500/30 bg-gradient-to-br from-zinc-900 to-amber-950/15 px-5 py-4">
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-wider text-amber-300/90 uppercase whitespace-nowrap">
            ★ {t('headline.title')}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: dotColor }}
              aria-hidden
            />
            <span className="text-base font-semibold text-zinc-100 truncate">
              {kpi.label}
            </span>
            {kpi.selection.kind === 'item' && itemMeta?.quality && (
              <span className="text-[10px] text-zinc-500">[{itemMeta.quality}]</span>
            )}
            {kpi.hasPity && (
              <span className="text-[10px] text-amber-400/80 px-1.5 py-0.5 rounded bg-amber-950/40 border border-amber-800/40">
                {t('headline.pity_tag')}
              </span>
            )}
          </div>
        </div>

        <label className="flex flex-col gap-1 text-xs text-zinc-400 min-w-0">
          <span className="text-zinc-500 whitespace-nowrap text-[10px] uppercase tracking-wider">
            {t('headline.bucket_select')}
          </span>
          <select
            value={selectedRaw}
            onChange={(e) => setSelectedRaw(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100 min-w-[260px] max-w-[360px]"
          >
            <option value={AUTO}>
              {t('headline.auto_prefix')} · {autoItemName ?? '—'}
            </option>

            {/* 物品级(玩家实得资源)— 主视图,按 type 分组 */}
            {itemOptionGroups.map((grp) => (
              <optgroup key={grp.type} label={`📦 ${grp.type}`}>
                {grp.items.map(({ it, pTheory }) => {
                  const pStr =
                    pTheory < 0.0001
                      ? (pTheory * 100).toExponential(1) + '%'
                      : (pTheory * 100).toFixed(3) + '%'
                  const qualityTag = it.quality ? ` [${it.quality}]` : ''
                  return (
                    <option key={it.resId} value={`item:${it.resId}`}>
                      {it.name}{qualityTag} · {pStr}
                    </option>
                  )
                })}
              </optgroup>
            ))}

            {/* 宝箱级 — 降级为"概率容器",仅供调试 */}
            <optgroup label={t('headline.optgroup.bucket')}>
              {pool.buckets.map((b) => {
                const pct =
                  totalWeight > 0
                    ? ((b.weight / totalWeight) * 100).toFixed(3)
                    : '0.000'
                return (
                  <option key={b.id} value={`bucket:${b.id}`}>
                    {b.name ?? b.id} · {pct}%
                  </option>
                )
              })}
            </optgroup>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
            {t('headline.theoretical')}
          </div>
          <div className="text-2xl font-semibold tabular-nums text-zinc-100 mt-1 leading-none">
            {fmtPct(kpi.theoreticalP)}
          </div>
          <div className="text-[10px] text-zinc-600 mt-1.5">
            {t('headline.base_rate_hint')}
          </div>
        </div>

        <div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
            {t('headline.effective')}
          </div>
          <div className="text-2xl font-semibold tabular-nums text-amber-200 mt-1 leading-none">
            {fmtPct(kpi.effectiveP)}
          </div>
          <div className="text-[10px] text-zinc-600 mt-1.5">
            {kpi.hasPity ? t('headline.pity_hint') : t('headline.no_pity_hint')}
          </div>
        </div>

        <div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
            {t('headline.observed')}
          </div>
          <div
            className={`text-2xl font-semibold tabular-nums mt-1 leading-none ${
              hasObserved ? 'text-amber-300' : 'text-zinc-600'
            }`}
          >
            {hasObserved ? fmtPct(kpi.observedP) : '—'}
          </div>
          <div className="text-[10px] text-zinc-600 mt-1.5 tabular-nums">
            {hasObserved
              ? t('headline.count', {
                  obs: kpi.observedCount.toLocaleString(),
                  total: kpi.totalPulls.toLocaleString(),
                })
              : t('headline.empty')}
          </div>
        </div>

        <div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
            {t('headline.deviation')}
          </div>
          <div
            className={`text-2xl font-semibold tabular-nums mt-1 leading-none ${devColor}`}
          >
            {hasObserved ? fmtDelta(kpi.deviation) : '—'}
          </div>
          <div className="text-[10px] text-zinc-600 mt-1.5">
            {hasObserved ? t('headline.dev_vs_eff') : ''}&nbsp;
          </div>
        </div>
      </div>

      {/* Expected pulls per acquisition */}
      {kpi.effectiveP > 0 && (
        <div className="mt-3 pt-3 border-t border-zinc-800/60 text-xs text-zinc-400 flex flex-wrap gap-x-6 gap-y-1">
          <span>
            {t('headline.eq_pulls')}:{' '}
            <span className="text-amber-200 tabular-nums font-semibold">
              {(1 / kpi.effectiveP).toFixed(kpi.effectiveP < 0.01 ? 0 : 1)}
            </span>{' '}
            {t('headline.pulls_unit')}
          </span>
          <span>
            {t('headline.per_10')}:{' '}
            <span className="tabular-nums">
              {(kpi.effectiveP * 10).toFixed(kpi.effectiveP < 0.01 ? 3 : 2)}
            </span>{' '}
            {t('headline.unit')}
          </span>
          <span>
            {t('headline.per_50')}:{' '}
            <span className="tabular-nums">
              {(kpi.effectiveP * 50).toFixed(kpi.effectiveP < 0.01 ? 2 : 1)}
            </span>{' '}
            {t('headline.unit')}
          </span>
          <span>
            {t('headline.per_100')}:{' '}
            <span className="tabular-nums">
              {(kpi.effectiveP * 100).toFixed(kpi.effectiveP < 0.01 ? 2 : 1)}
            </span>{' '}
            {t('headline.unit')}
          </span>
        </div>
      )}
    </section>
  )
}
