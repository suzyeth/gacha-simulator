import { useMemo } from 'react'
import type { PullResult } from '../engine/types'
import { xmExpectedDistribution } from '../presets/xm'
import { useT } from '../i18n/store'

interface Props {
  results: PullResult[]
}

export function FormulaComparePanel({ results }: Props) {
  const t = useT()
  const stats = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of results) {
      counts[r.rarity] = (counts[r.rarity] ?? 0) + 1
    }
    const N = results.length
    return Object.entries(xmExpectedDistribution).map(([bucketId, exp]) => {
      const observed = N > 0 ? (counts[bucketId] ?? 0) / N : 0
      const deviationFromFormula =
        exp.formulaP > 0 ? ((observed - exp.formulaP) / exp.formulaP) * 100 : 0
      return {
        bucketId,
        name: exp.name,
        observed,
        formulaP: exp.formulaP,
        theoryP: exp.theoryP,
        deviationFromFormula,
      }
    })
  }, [results])

  const N = results.length
  const reliable = N >= 10_000

  return (
    <section className="rounded-lg border border-amber-700/40 bg-amber-950/20 p-4">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-lg font-semibold text-amber-200">{t('formula.title')}</h2>
        <span className="text-xs text-amber-700">
          {N === 0
            ? t('formula.not_run')
            : reliable
              ? t('formula.sample_ok', { n: N.toLocaleString() })
              : t('formula.sample_small', { n: N.toLocaleString() })}
        </span>
      </div>
      <p className="text-xs text-amber-300/70 mb-3 leading-relaxed">{t('formula.help')}</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-amber-500/70 text-xs border-b border-amber-800/30">
            <th className="text-left py-1.5 font-normal">{t('formula.col.bucket')}</th>
            <th className="text-right py-1.5 font-normal">{t('formula.col.formula_p')}</th>
            <th className="text-right py-1.5 font-normal">{t('formula.col.theory_p')}</th>
            <th className="text-right py-1.5 font-normal">{t('formula.col.observed_p')}</th>
            <th className="text-right py-1.5 font-normal">{t('formula.col.deviation')}</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => {
            const devColor =
              Math.abs(s.deviationFromFormula) > 10
                ? 'text-red-400'
                : Math.abs(s.deviationFromFormula) > 3
                  ? 'text-amber-300'
                  : 'text-zinc-400'
            return (
              <tr key={s.bucketId} className="border-b border-amber-900/20">
                <td className="py-1.5">
                  <span className="font-mono text-amber-200/80">{s.bucketId}</span>
                  <span className="ml-2 text-zinc-400 text-xs">{s.name}</span>
                </td>
                <td className="py-1.5 text-right tabular-nums text-zinc-400">
                  {s.formulaP.toFixed(5)}
                </td>
                <td className="py-1.5 text-right tabular-nums text-zinc-300">
                  {s.theoryP.toFixed(5)}
                </td>
                <td className="py-1.5 text-right tabular-nums text-amber-100">
                  {N === 0 ? '—' : s.observed.toFixed(5)}
                </td>
                <td className={`py-1.5 text-right tabular-nums ${devColor}`}>
                  {N === 0
                    ? '—'
                    : `${s.deviationFromFormula > 0 ? '+' : ''}${s.deviationFromFormula.toFixed(1)}%`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {reliable && (
        <p className="mt-3 text-xs text-amber-300/80 leading-relaxed">{t('formula.action')}</p>
      )}
    </section>
  )
}
