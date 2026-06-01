import { useEffect, useMemo, useRef } from 'react'
import * as echarts from 'echarts'
import type { PullResult } from '../engine/types'
import type { PoolSchema } from '../engine/schema'
import { useT } from '../i18n/store'
import { computeDistRows } from './distribution-rows'

interface Props {
  pool: PoolSchema
  results: PullResult[]
}

function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!m) return hex
  const r = parseInt(m[1], 16)
  const g = parseInt(m[2], 16)
  const b = parseInt(m[3], 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * Horizontal bar chart comparing theoretical drop rate vs. observed share.
 *
 * Always shows the theoretical baseline (computed from pool weights), so the
 * chart updates live as the user edits the pool — even before any sim runs.
 * Observed bars overlay once results accumulate.
 */
export function DistributionChart({ pool, results }: Props) {
  const t = useT()
  const ref = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)

  const { rows, totalPulls } = useMemo(
    () => computeDistRows(pool, results),
    [pool, results],
  )

  useEffect(() => {
    if (!ref.current) return
    if (!chartRef.current) {
      chartRef.current = echarts.init(ref.current, 'dark')
    }
    const chart = chartRef.current

    const labels = rows.map((r) => r.name)
    const theoreticalPct = rows.map((r) => ({
      value: +(r.theoreticalP * 100).toFixed(6),
      itemStyle: { color: hexToRgba(r.color, 0.32) },
    }))
    const observedPct = rows.map((r) => ({
      value:
        totalPulls > 0 ? +((r.observedCount / totalPulls) * 100).toFixed(6) : 0,
      itemStyle: { color: r.color },
    }))

    chart.setOption(
      {
        backgroundColor: 'transparent',
        grid: { left: 110, right: 110, top: 32, bottom: 28 },
        legend: {
          show: true,
          top: 4,
          right: 8,
          textStyle: { color: '#aaa', fontSize: 10 },
          icon: 'roundRect',
          itemWidth: 10,
          itemHeight: 10,
        },
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          formatter: (params: unknown) => {
            const arr = params as Array<{ dataIndex: number }>
            if (!arr.length) return ''
            const row = rows[arr[0].dataIndex]
            const thePct = (row.theoreticalP * 100).toFixed(3)
            const obsPct =
              totalPulls > 0
                ? ((row.observedCount / totalPulls) * 100).toFixed(3)
                : '—'
            const obsCount =
              totalPulls > 0 ? row.observedCount.toLocaleString() : '—'
            return [
              `<b>${row.name}</b>`,
              `${t('dist.tooltip.bucket')}: ${row.bucketId}`,
              `${t('dist.tooltip.theoretical')}: ${thePct}%`,
              `${t('dist.tooltip.observed')}: ${obsPct}% (${obsCount})`,
            ].join('<br/>')
          },
        },
        xAxis: {
          type: 'value',
          axisLine: { lineStyle: { color: '#555' } },
          axisLabel: {
            color: '#888',
            fontSize: 10,
            formatter: (v: number) => `${v}%`,
          },
          splitLine: { lineStyle: { color: '#2a2a2a' } },
        },
        yAxis: {
          type: 'category',
          inverse: true,
          data: labels,
          axisLine: { lineStyle: { color: '#555' } },
          axisLabel: {
            color: '#ddd',
            fontSize: 11,
            formatter: (name: string, idx: number) => {
              const row = rows[idx]
              return `{b|${row.bucketId}} ${name}`
            },
            rich: {
              b: {
                color: '#888',
                fontFamily: 'monospace',
                fontSize: 10,
                padding: [0, 6, 0, 0],
              },
            },
          },
        },
        series: [
          {
            name: t('dist.series.theoretical'),
            type: 'bar',
            data: theoreticalPct,
            barCategoryGap: '32%',
            barGap: '-100%',
            label: { show: false },
            z: 1,
          },
          {
            name: t('dist.series.observed'),
            type: 'bar',
            data: observedPct,
            barCategoryGap: '32%',
            barGap: '-100%',
            label: {
              show: totalPulls > 0,
              position: 'right',
              color: '#aaa',
              fontSize: 10,
              formatter: (params: { dataIndex: number; value: number }) => {
                if (totalPulls === 0) return ''
                const row = rows[params.dataIndex]
                return `${row.observedCount.toLocaleString()} (${params.value.toFixed(2)}%)`
              },
            },
            z: 2,
          },
        ],
      },
      { notMerge: true },
    )
  }, [rows, totalPulls, t])

  useEffect(() => {
    const handler = () => chartRef.current?.resize()
    window.addEventListener('resize', handler)
    return () => {
      window.removeEventListener('resize', handler)
      chartRef.current?.dispose()
      chartRef.current = null
    }
  }, [])

  const chartHeight = Math.max(360, rows.length * 28)

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">{t('dist.title')}</h2>
        <span className="text-xs text-zinc-500">
          {totalPulls > 0
            ? t('dist.total', { n: totalPulls.toLocaleString() })
            : t('dist.theoretical_only')}
        </span>
      </div>
      <div ref={ref} style={{ width: '100%', height: chartHeight }} />
    </section>
  )
}
