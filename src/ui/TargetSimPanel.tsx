import { useEffect, useMemo, useRef, useState } from 'react'
import * as echarts from 'echarts'
import type { PoolSchema } from '../engine/schema'
import { summarizeTrials } from '../engine/scenarios'
import type { SimResponse, TargetRequest } from '../workers/sim.worker'
import SimWorker from '../workers/sim.worker?worker'
import { useT } from '../i18n/store'

interface Props {
  pool: PoolSchema
}

interface TrialResult {
  pullsToTarget: number
  succeeded: boolean
}

export function TargetSimPanel({ pool }: Props) {
  const t = useT()
  // Default target: first Skin-type item (works for English "Skin" or Chinese "皮肤" imports)
  const skinItem =
    pool.items.find((i) => i.type === 'Skin' || i.type === '皮肤') ?? pool.items[0]
  const [targetResId, setTargetResId] = useState(skinItem?.resId ?? '')
  const [trials, setTrials] = useState(1000)
  const [maxPulls, setMaxPulls] = useState(500)
  const [yuanPerPull, setYuanPerPull] = useState(10)
  const [trialResults, setTrialResults] = useState<TrialResult[] | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [elapsedMs, setElapsedMs] = useState<number | null>(null)

  const workerRef = useRef<Worker | null>(null)
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    workerRef.current = new SimWorker()
    return () => {
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [])

  function run() {
    const w = workerRef.current
    if (!w || isRunning || !targetResId) return
    setIsRunning(true)
    const onMessage = (e: MessageEvent<SimResponse>) => {
      if (e.data.mode !== 'target') return
      setTrialResults(e.data.trials)
      setElapsedMs(e.data.elapsedMs)
      setIsRunning(false)
      w.removeEventListener('message', onMessage)
    }
    w.addEventListener('message', onMessage)
    const req: TargetRequest = {
      mode: 'target',
      pool,
      targetResId,
      trials,
      maxPulls,
    }
    w.postMessage(req)
  }

  const stats = useMemo(() => {
    if (!trialResults) return null
    return summarizeTrials(trialResults)
  }, [trialResults])

  const itemMeta = useMemo(
    () => new Map(pool.items.map((i) => [i.resId, i])),
    [pool],
  )
  const targetName = itemMeta.get(targetResId)?.name ?? targetResId

  useEffect(() => {
    if (!chartRef.current || !stats || !trialResults) return
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, 'dark')
    }
    const chart = chartInstance.current
    const succeeded = trialResults
      .filter((tr) => tr.succeeded)
      .map((tr) => tr.pullsToTarget)
    if (succeeded.length === 0) {
      chart.clear()
      return
    }
    const upper = Math.max(stats.max, 10)
    const binSize = Math.max(1, Math.ceil(upper / 20))
    const binCount = Math.ceil(upper / binSize) + 1
    const bins = new Array(binCount).fill(0) as number[]
    for (const v of succeeded) {
      const idx = Math.min(binCount - 1, Math.floor((v - 1) / binSize))
      bins[idx]++
    }
    const xLabels = bins.map(
      (_, i) => `${i * binSize + 1}-${(i + 1) * binSize}`,
    )

    const percentileLines = [
      { name: 'P50', value: stats.p50, color: '#34d399' },
      { name: 'P75', value: stats.p75, color: '#fbbf24' },
      { name: 'P90', value: stats.p90, color: '#fb923c' },
      { name: 'P99', value: stats.p99, color: '#f87171' },
    ]

    chart.setOption({
      backgroundColor: 'transparent',
      grid: { left: 50, right: 30, top: 16, bottom: 30 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: {
        type: 'category',
        data: xLabels,
        name: t('target.chart.x'),
        nameLocation: 'middle',
        nameGap: 22,
        nameTextStyle: { color: '#888', fontSize: 11 },
        axisLabel: { color: '#666', fontSize: 9 },
        axisLine: { lineStyle: { color: '#555' } },
      },
      yAxis: {
        type: 'value',
        name: t('target.chart.y'),
        nameTextStyle: { color: '#888', fontSize: 11 },
        axisLabel: { color: '#888', fontSize: 10 },
        splitLine: { lineStyle: { color: '#2a2a2a' } },
      },
      series: [
        {
          type: 'bar',
          data: bins,
          itemStyle: { color: '#60a5fa', opacity: 0.85 },
          markLine: {
            symbol: 'none',
            silent: true,
            data: percentileLines.map((p) => ({
              name: p.name,
              xAxis: Math.min(binCount - 1, Math.floor((p.value - 1) / binSize)),
              lineStyle: { color: p.color, type: 'dashed', width: 1.5 },
              label: {
                formatter: `${p.name}\n${Math.round(p.value)}`,
                color: p.color,
                fontSize: 10,
                position: 'insideEndTop',
              },
            })),
          },
        },
      ],
    })
  }, [stats, trialResults, t])

  useEffect(() => {
    const handler = () => chartInstance.current?.resize()
    window.addEventListener('resize', handler)
    return () => {
      window.removeEventListener('resize', handler)
      chartInstance.current?.dispose()
      chartInstance.current = null
    }
  }, [])

  return (
    <section className="rounded-lg border border-violet-800/40 bg-violet-950/20 p-4">
      <h2 className="text-lg font-semibold text-violet-200 mb-3">
        {t('target.title')}
      </h2>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="col-span-2">
          <label className="text-xs text-violet-300/70 block mb-1">
            {t('target.field.target')}
          </label>
          <select
            value={targetResId}
            onChange={(e) => setTargetResId(e.target.value)}
            className="w-full bg-violet-950/60 border border-violet-800/40 rounded px-2 py-1.5 text-sm text-violet-100"
          >
            {pool.items.map((i) => (
              <option key={i.resId} value={i.resId}>
                {i.name} ({i.type ?? '—'} · {i.quality ?? '—'}) [{i.resId}]
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-violet-300/70 block mb-1">
            {t('target.field.trials')}
          </label>
          <input
            type="number"
            value={trials}
            min={10}
            max={10000}
            step={100}
            onChange={(e) => setTrials(Number(e.target.value))}
            className="w-full bg-violet-950/60 border border-violet-800/40 rounded px-2 py-1.5 text-sm text-violet-100 tabular-nums"
          />
        </div>
        <div>
          <label className="text-xs text-violet-300/70 block mb-1">
            {t('target.field.max_pulls')}
          </label>
          <input
            type="number"
            value={maxPulls}
            min={10}
            max={5000}
            step={50}
            onChange={(e) => setMaxPulls(Number(e.target.value))}
            className="w-full bg-violet-950/60 border border-violet-800/40 rounded px-2 py-1.5 text-sm text-violet-100 tabular-nums"
          />
        </div>
      </div>

      <div className="mb-3 flex items-center gap-3">
        <label className="text-xs text-violet-300/70 whitespace-nowrap">
          {t('target.field.cost')}
        </label>
        <input
          type="range"
          min={1}
          max={30}
          step={0.5}
          value={yuanPerPull}
          onChange={(e) => setYuanPerPull(Number(e.target.value))}
          className="flex-1 accent-violet-400"
        />
        <span className="text-violet-100 tabular-nums w-14 text-right text-sm">
          ¥{yuanPerPull.toFixed(1)}
        </span>
      </div>

      <button
        onClick={run}
        disabled={isRunning}
        className="w-full rounded px-3 py-2 text-sm bg-violet-800 hover:bg-violet-700 disabled:opacity-50 transition mb-3"
      >
        {isRunning
          ? t('target.btn.running')
          : t('target.btn.run', { n: trials.toLocaleString(), name: targetName })}
      </button>

      {stats && (
        <>
          <div className="mb-3">
            {stats.failureRate > 0 && (
              <div className="text-xs text-rose-400 mb-2">
                {t('target.failure_warn', {
                  pct: (stats.failureRate * 100).toFixed(1),
                  n: maxPulls,
                })}
              </div>
            )}
            <table className="w-full text-sm">
              <thead>
                <tr className="text-violet-500/70 text-xs border-b border-violet-800/30">
                  <th className="text-left py-1.5 font-normal">{t('target.col.percentile')}</th>
                  <th className="text-right py-1.5 font-normal">{t('target.col.pulls')}</th>
                  <th className="text-right py-1.5 font-normal">{t('target.col.cost')}</th>
                  <th className="text-left py-1.5 font-normal pl-3">{t('target.col.meaning')}</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                <tr className="border-b border-violet-900/30">
                  <td className="py-1.5 text-emerald-300">P50</td>
                  <td className="text-right text-violet-100">{Math.round(stats.p50)}</td>
                  <td className="text-right text-emerald-200">
                    ¥{Math.round(stats.p50 * yuanPerPull).toLocaleString()}
                  </td>
                  <td className="pl-3 text-violet-400 text-xs">{t('target.p50.meaning')}</td>
                </tr>
                <tr className="border-b border-violet-900/30">
                  <td className="py-1.5 text-amber-300">P75</td>
                  <td className="text-right text-violet-100">{Math.round(stats.p75)}</td>
                  <td className="text-right text-amber-200">
                    ¥{Math.round(stats.p75 * yuanPerPull).toLocaleString()}
                  </td>
                  <td className="pl-3 text-violet-400 text-xs">{t('target.p75.meaning')}</td>
                </tr>
                <tr className="border-b border-violet-900/30">
                  <td className="py-1.5 text-orange-300">P90</td>
                  <td className="text-right text-violet-100">{Math.round(stats.p90)}</td>
                  <td className="text-right text-orange-200">
                    ¥{Math.round(stats.p90 * yuanPerPull).toLocaleString()}
                  </td>
                  <td className="pl-3 text-violet-400 text-xs">{t('target.p90.meaning')}</td>
                </tr>
                <tr>
                  <td className="py-1.5 text-rose-400">P99</td>
                  <td className="text-right text-violet-100">{Math.round(stats.p99)}</td>
                  <td className="text-right text-rose-300 font-semibold">
                    ¥{Math.round(stats.p99 * yuanPerPull).toLocaleString()}
                  </td>
                  <td className="pl-3 text-violet-400 text-xs">{t('target.p99.meaning')}</td>
                </tr>
              </tbody>
            </table>
            <div className="text-[10px] text-violet-700 mt-2 flex justify-between">
              <span>
                {t('target.stats', {
                  s: stats.succeeded,
                  t: stats.count,
                  avg: stats.mean.toFixed(1),
                  min: stats.min,
                  max: stats.max,
                })}
              </span>
              {elapsedMs !== null && (
                <span className="tabular-nums">{elapsedMs.toFixed(0)}ms</span>
              )}
            </div>
          </div>

          <div ref={chartRef} style={{ width: '100%', height: 280 }} />
          <p className="text-[10px] text-violet-700/80 mt-2 leading-relaxed">
            {t('target.help', { name: targetName })}
          </p>
        </>
      )}

      {!stats && !isRunning && (
        <p className="text-xs text-violet-700 italic text-center py-4">
          {t('target.empty')}
        </p>
      )}
    </section>
  )
}
