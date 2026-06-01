import { useEffect, useMemo, useRef, useState } from 'react'
import { useSimStore } from '../store/sim-store'
import type { PoolSchema } from '../engine/schema'
import type { ContinuousRequest, SimResponse } from '../workers/sim.worker'
import SimWorker from '../workers/sim.worker?worker'
import { useT } from '../i18n/store'
import type { TranslationKey } from '../i18n/translations'

const PULL_OPTIONS: Array<{ labelKey: TranslationKey; count: number }> = [
  { labelKey: 'sim.btn.1', count: 1 },
  { labelKey: 'sim.btn.10', count: 10 },
  { labelKey: 'sim.btn.100', count: 100 },
  { labelKey: 'sim.btn.100k', count: 100_000 },
]

export function SimControls({ pool }: { pool: PoolSchema }) {
  const t = useT()
  const { appendRun, setRunning, reset, isRunning, results, engineState } = useSimStore()
  const workerRef = useRef<Worker | null>(null)
  const [lastElapsed, setLastElapsed] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    workerRef.current = new SimWorker()
    return () => {
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [])

  function run(count: number) {
    const w = workerRef.current
    if (!w || isRunning) return
    setRunning(true)
    setError(null)
    const onMessage = (e: MessageEvent<SimResponse>) => {
      if (e.data.mode === 'error') {
        setError(e.data.message)
        setRunning(false)
        w.removeEventListener('message', onMessage)
        return
      }
      if (e.data.mode !== 'continuous') return
      appendRun(e.data.results, e.data.state)
      setLastElapsed(e.data.elapsedMs)
      setRunning(false)
      w.removeEventListener('message', onMessage)
    }
    w.addEventListener('message', onMessage)
    const req: ContinuousRequest = { mode: 'continuous', pool, state: engineState, count }
    w.postMessage(req)
  }

  const totalPulls = useMemo(() => results.length, [results])

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">{t('sim.title')}</h2>
        <span className="text-xs text-zinc-400 tabular-nums">
          {t('sim.total', { n: totalPulls.toLocaleString() })}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {PULL_OPTIONS.map((opt) => (
          <button
            key={opt.count}
            onClick={() => run(opt.count)}
            disabled={isRunning}
            className="rounded px-3 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isRunning ? t('sim.running') : t(opt.labelKey)}
          </button>
        ))}
      </div>
      <button
        onClick={reset}
        disabled={isRunning || totalPulls === 0}
        className="w-full rounded px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 disabled:opacity-30 transition"
      >
        {t('sim.reset')}
      </button>
      <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-600 leading-relaxed">
        <span>{t('sim.help')}</span>
        {lastElapsed !== null && (
          <span className="text-zinc-500 tabular-nums">
            {t('sim.last_elapsed', { n: lastElapsed.toFixed(0) })}
          </span>
        )}
      </div>
      {error && (
        <div className="mt-2 text-[11px] text-rose-300 bg-rose-950/40 border border-rose-800/50 rounded px-2 py-1.5 leading-relaxed">
          ⚠ {t('sim.error')}: {error}
        </div>
      )}
    </section>
  )
}
