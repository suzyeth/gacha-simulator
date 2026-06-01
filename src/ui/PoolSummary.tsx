import { Fragment, useMemo, useState } from 'react'
import type { PoolSchema } from '../engine/schema'
import { useConfigStore } from '../store/config-store'
import { useSimStore } from '../store/sim-store'
import { useT } from '../i18n/store'
import { EditableNumber } from './EditableNumber'

type Pool = PoolSchema
type Bucket = Pool['buckets'][number]
type RuleSpec = Pool['rules'][number]

export function PoolSummary({ pool }: { pool: PoolSchema }) {
  const t = useT()
  const activeId = useConfigStore((s) => s.activeId)
  const updateConfig = useConfigStore((s) => s.updateConfig)
  const resetSim = useSimStore((s) => s.reset)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const total = useMemo(
    () => pool.buckets.reduce((s, b) => s + b.weight, 0),
    [pool.buckets],
  )

  function commit(next: Pool) {
    updateConfig(activeId, next)
    resetSim()
  }

  function updateBucket(bucketId: string, patch: Partial<Bucket>) {
    commit({
      ...pool,
      buckets: pool.buckets.map((b) => (b.id === bucketId ? { ...b, ...patch } : b)),
    })
  }

  function removeBucket(bucketId: string) {
    if (pool.buckets.length <= 1) {
      alert(t('pool.confirm.last_bucket'))
      return
    }
    if (!confirm(t('pool.confirm.delete_bucket', { id: bucketId }))) return
    commit({
      ...pool,
      buckets: pool.buckets.filter((b) => b.id !== bucketId),
      rules: pool.rules.filter((r) => {
        if (r.type === 'cyclic-pity') return r.params.bucketId !== bucketId
        return true
      }),
    })
  }

  function addBucket() {
    let n = pool.buckets.length + 1
    while (pool.buckets.some((b) => b.id === `new-${n}`)) n++
    const newBucket: Bucket = {
      id: `new-${n}`,
      name: `New Bucket ${n}`,
      kind: 'box',
      weight: 1,
      contents: [{ resId: `new-item-${n}-1`, weight: 1, minCount: 1 }],
    }
    commit({
      ...pool,
      buckets: [...pool.buckets, newBucket],
      items: [
        ...(pool.items ?? []),
        { resId: `new-item-${n}-1`, name: `New item ${n}-1`, isFeatured: false },
      ],
    })
  }

  function updateContent(
    bucketId: string,
    idx: number,
    patch: Partial<Bucket['contents'][number]>,
  ) {
    updateBucket(bucketId, {
      contents: pool.buckets
        .find((b) => b.id === bucketId)!
        .contents.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    })
  }

  function removeContent(bucketId: string, idx: number) {
    const bucket = pool.buckets.find((b) => b.id === bucketId)!
    if (bucket.contents.length <= 1) {
      alert(t('pool.confirm.last_item'))
      return
    }
    updateBucket(bucketId, {
      contents: bucket.contents.filter((_, i) => i !== idx),
    })
  }

  function setContentPercent(bucketId: string, idx: number, newPctPercent: number) {
    const bucket = pool.buckets.find((b) => b.id === bucketId)
    if (!bucket) return
    const P = newPctPercent / 100
    if (!(P > 0 && P < 1)) {
      alert(t('pool.percent.invalid'))
      return
    }
    const sumOthers = bucket.contents.reduce(
      (s, c, i) => (i === idx ? s : s + c.weight),
      0,
    )
    if (sumOthers <= 0) {
      alert(t('pool.percent.single_item'))
      return
    }
    const newWeight = (P / (1 - P)) * sumOthers
    updateContent(bucketId, idx, { weight: newWeight })
  }

  function addContent(bucketId: string) {
    const bucket = pool.buckets.find((b) => b.id === bucketId)!
    let n = bucket.contents.length + 1
    while (bucket.contents.some((c) => c.resId === `new-item-${bucketId}-${n}`)) n++
    const newResId = `new-item-${bucketId}-${n}`
    if (pool.items?.some((i) => i.resId === newResId)) {
      updateBucket(bucketId, {
        contents: [...bucket.contents, { resId: newResId, weight: 1, minCount: 1 }],
      })
    } else {
      commit({
        ...pool,
        buckets: pool.buckets.map((b) =>
          b.id === bucketId
            ? { ...b, contents: [...b.contents, { resId: newResId, weight: 1, minCount: 1 }] }
            : b,
        ),
        items: [...(pool.items ?? []), { resId: newResId, name: newResId, isFeatured: false }],
      })
    }
  }

  function updateRule(idx: number, next: RuleSpec) {
    commit({ ...pool, rules: pool.rules.map((r, i) => (i === idx ? next : r)) })
  }

  function removeRule(idx: number) {
    if (!confirm(t('pool.confirm.delete_rule'))) return
    commit({ ...pool, rules: pool.rules.filter((_, i) => i !== idx) })
  }

  function addCyclicPity() {
    const newRule: RuleSpec = {
      type: 'cyclic-pity',
      params: { period: 10, bucketId: pool.buckets[0]?.id ?? '' },
    }
    commit({ ...pool, rules: [...pool.rules, newRule] })
  }

  const itemMeta = useMemo(
    () => new Map(pool.items?.map((i) => [i.resId, i]) ?? []),
    [pool.items],
  )

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <h2 className="text-lg font-semibold mb-1">{pool.name}</h2>
      <p className="text-xs text-zinc-400 mb-3">{pool.description}</p>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-zinc-500 text-xs border-b border-zinc-800">
            <th className="text-left py-1.5 font-normal w-6"></th>
            <th className="text-left py-1.5 font-normal">{t('pool.col.bucket')}</th>
            <th className="text-left py-1.5 font-normal">{t('pool.col.name')}</th>
            <th className="text-right py-1.5 font-normal">{t('pool.col.weight')}</th>
            <th className="text-right py-1.5 font-normal">{t('pool.col.base_prob')}</th>
            <th className="text-right py-1.5 font-normal">{t('pool.col.items')}</th>
            <th className="w-6"></th>
          </tr>
        </thead>
        <tbody>
          {pool.buckets.map((b) => {
            const isOpen = expanded[b.id]
            return (
              <Fragment key={b.id}>
                <tr className="border-b border-zinc-800/50 group">
                  <td className="py-1.5">
                    <button
                      onClick={() => setExpanded((e) => ({ ...e, [b.id]: !e[b.id] }))}
                      className="text-zinc-500 hover:text-zinc-200 text-xs w-5"
                      title={isOpen ? t('pool.tooltip.collapse') : t('pool.tooltip.expand')}
                    >
                      {isOpen ? '▼' : '▶'}
                    </button>
                  </td>
                  <td className="py-1.5">
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-2 align-middle"
                      style={{ backgroundColor: b.color ?? '#888' }}
                    />
                    <span className="font-mono text-zinc-300">{b.id}</span>
                  </td>
                  <td className="py-1.5 text-zinc-200">{b.name}</td>
                  <td className="py-1.5 text-right">
                    <EditableNumber
                      value={b.weight}
                      min={0.0001}
                      onChange={(v) => updateBucket(b.id, { weight: v })}
                      variant="highlight"
                      widthClass="w-20"
                      title={t('pool.tooltip.bucket_weight')}
                    />
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-zinc-400">
                    {((b.weight / total) * 100).toFixed(3)}%
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-zinc-500">{b.contents.length}</td>
                  <td className="py-1.5 text-right">
                    <button
                      onClick={() => removeBucket(b.id)}
                      className="opacity-0 group-hover:opacity-100 text-rose-400/70 hover:text-rose-300 text-xs px-1 transition"
                      title={t('pool.tooltip.delete_bucket')}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
                {isOpen && (
                  <tr key={`${b.id}-content`} className="border-b border-zinc-800/50">
                    <td colSpan={7} className="py-2 px-2 bg-zinc-950/40">
                      <div className="text-[10px] text-zinc-500 mb-1.5 flex items-center justify-between">
                        <span>{t('pool.contents.header', { name: b.name ?? b.id })}</span>
                        <button
                          onClick={() => addContent(b.id)}
                          className="text-sky-400 hover:text-sky-300 text-[11px]"
                        >
                          {t('pool.contents.add_item')}
                        </button>
                      </div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-zinc-600">
                            <th className="text-left py-1 font-normal">{t('pool.contents.col.resId')}</th>
                            <th className="text-left py-1 font-normal">{t('pool.contents.col.name')}</th>
                            <th className="text-right py-1 font-normal">{t('pool.contents.col.weight')}</th>
                            <th className="text-right py-1 font-normal" title={t('pool.tooltip.edit_percent')}>
                              {t('pool.contents.col.percent')}
                            </th>
                            <th className="w-6"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const sumW = b.contents.reduce((s, c) => s + c.weight, 0)
                            return b.contents.map((c, i) => (
                              <tr key={`${b.id}-${i}`} className="group/inner">
                                <td className="py-0.5 font-mono text-zinc-400">{c.resId}</td>
                                <td className="py-0.5 text-zinc-300">
                                  {itemMeta.get(c.resId)?.name ?? '—'}
                                </td>
                                <td className="py-0.5 text-right">
                                  <EditableNumber
                                    value={c.weight}
                                    min={0.0001}
                                    onChange={(v) => updateContent(b.id, i, { weight: v })}
                                    widthClass="w-20"
                                    format={(v) => (v >= 1 ? v.toFixed(0) : v.toFixed(4))}
                                    title={t('pool.tooltip.edit_weight')}
                                  />
                                </td>
                                <td className="py-0.5 text-right">
                                  <EditableNumber
                                    value={(c.weight / sumW) * 100}
                                    min={0.0001}
                                    max={99.9999}
                                    onChange={(pct) => setContentPercent(b.id, i, pct)}
                                    widthClass="w-20"
                                    format={(v) => `${v.toFixed(v < 0.01 ? 4 : 2)}%`}
                                    title={t('pool.tooltip.edit_percent')}
                                    variant="highlight"
                                  />
                                </td>
                                <td className="py-0.5 text-right">
                                  <button
                                    onClick={() => removeContent(b.id, i)}
                                    className="opacity-0 group-hover/inner:opacity-100 text-rose-400/70 hover:text-rose-300 px-1 transition"
                                    title={t('pool.tooltip.delete_item')}
                                  >
                                    ✕
                                  </button>
                                </td>
                              </tr>
                            ))
                          })()}
                        </tbody>
                      </table>
                      <p className="text-[10px] text-zinc-700 mt-1.5 leading-relaxed">
                        {t('pool.contents.help')}
                      </p>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
          <tr>
            <td colSpan={7} className="pt-2">
              <button
                onClick={addBucket}
                className="text-xs text-sky-400 hover:text-sky-300 transition"
              >
                {t('pool.add_bucket')}
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="mt-3 pt-3 border-t border-zinc-800">
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-xs text-zinc-400">{t('pool.rules.header')}</span>
          <button
            onClick={addCyclicPity}
            className="text-xs text-sky-400 hover:text-sky-300 transition"
          >
            {t('pool.rules.add_cyclic')}
          </button>
        </div>
        {pool.rules.length === 0 && (
          <div className="text-xs text-zinc-600 italic">{t('pool.rules.empty')}</div>
        )}
        <div className="space-y-1">
          {pool.rules.map((r, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-xs group/rule py-0.5"
            >
              {r.type === 'cyclic-pity' ? (
                <>
                  <span className="text-zinc-400">{t('pool.rules.cyclic_label')}</span>
                  <EditableNumber
                    value={r.params.period}
                    min={1}
                    max={1000}
                    integer
                    variant="highlight"
                    widthClass="w-14"
                    onChange={(v) =>
                      updateRule(i, {
                        type: 'cyclic-pity',
                        params: { ...r.params, period: v },
                      })
                    }
                  />
                  <span className="text-zinc-400">{t('pool.rules.cyclic_force')}</span>
                  <select
                    value={r.params.bucketId}
                    onChange={(e) =>
                      updateRule(i, {
                        type: 'cyclic-pity',
                        params: { ...r.params, bucketId: e.target.value },
                      })
                    }
                    className="bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-xs text-zinc-200"
                  >
                    {pool.buckets.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.id} {b.name ? `(${b.name})` : ''}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <span className="text-zinc-400">
                  {r.type} · {t('pool.rules.script_label', { n: r.params.script.length })}
                </span>
              )}
              <button
                onClick={() => removeRule(i)}
                className="ml-auto opacity-0 group-hover/rule:opacity-100 text-rose-400/70 hover:text-rose-300 px-1 transition"
                title={t('pool.tooltip.delete_rule')}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
