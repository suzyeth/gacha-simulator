import { useMemo, useState } from 'react'
import type { PullResult } from '../engine/types'
import type { PoolSchema } from '../engine/schema'
import { useT } from '../i18n/store'

interface Props {
  pool: PoolSchema
  results: PullResult[]
}

export function EconomyPanel({ pool, results }: Props) {
  const t = useT()
  const [yuanPerPull, setYuanPerPull] = useState(10)

  const stats = useMemo(() => {
    const totalSpend = results.length * yuanPerPull
    const itemCounts = new Map<string, number>()
    for (const r of results) {
      itemCounts.set(r.item.id, (itemCounts.get(r.item.id) ?? 0) + 1)
    }
    const itemMeta = new Map(pool.items.map((i) => [i.resId, i]))
    const byType = new Map<string, { count: number }>()
    for (const [resId, count] of itemCounts) {
      const type = itemMeta.get(resId)?.type ?? '—'
      const existing = byType.get(type) ?? { count: 0 }
      existing.count += count
      byType.set(type, existing)
    }
    return { totalSpend, byType, itemCounts }
  }, [pool, results, yuanPerPull])

  const N = results.length

  return (
    <section className="rounded-lg border border-emerald-800/40 bg-emerald-950/20 p-4">
      <h2 className="text-lg font-semibold text-emerald-200 mb-3">{t('economy.title')}</h2>

      <div className="mb-3">
        <label className="text-xs text-emerald-300/70 block mb-1">
          {t('economy.cost_label')}
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={1}
            max={30}
            step={0.5}
            value={yuanPerPull}
            onChange={(e) => setYuanPerPull(Number(e.target.value))}
            className="flex-1 accent-emerald-500"
          />
          <span className="text-emerald-100 tabular-nums w-16 text-right text-sm">
            ¥{yuanPerPull.toFixed(1)}
          </span>
        </div>
        <p className="text-[10px] text-emerald-700/80 mt-1 leading-relaxed">
          {t('economy.hint')}
        </p>
      </div>

      <div className="space-y-1.5 text-sm border-t border-emerald-800/30 pt-3">
        <div className="flex justify-between">
          <span className="text-emerald-300/70">{t('economy.total', { n: N.toLocaleString() })}</span>
          <span className="text-emerald-100 tabular-nums font-semibold">
            ¥{stats.totalSpend.toLocaleString()}
          </span>
        </div>
        {N === 0 ? (
          <p className="text-[10px] text-emerald-700 italic mt-2">{t('economy.no_data')}</p>
        ) : (
          <>
            <div className="text-xs text-emerald-400/70 mt-2 mb-1">{t('economy.by_type')}</div>
            {Array.from(stats.byType.entries())
              .sort((a, b) => a[1].count - b[1].count)
              .map(([type, { count }]) => {
                if (count === 0) return null
                const avgCost = stats.totalSpend / count
                return (
                  <div key={type} className="flex justify-between text-xs">
                    <span className="text-emerald-300/80">
                      {t('economy.per_item', { type })}
                      <span className="text-emerald-700/60 ml-1">×{count}</span>
                    </span>
                    <span className="text-emerald-200 tabular-nums">
                      ¥{avgCost.toFixed(avgCost > 1000 ? 0 : 2)}
                    </span>
                  </div>
                )
              })}
          </>
        )}
      </div>
    </section>
  )
}
