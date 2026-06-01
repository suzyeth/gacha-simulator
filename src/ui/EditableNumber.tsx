import { useEffect, useRef, useState } from 'react'

interface Props {
  value: number
  onChange: (next: number) => void
  /** Inclusive lower bound (defaults to 0). */
  min?: number
  /** Inclusive upper bound. */
  max?: number
  /** Display formatter — applied to non-editing display only. */
  format?: (n: number) => string
  /** Width hint (Tailwind class) — default w-16. */
  widthClass?: string
  /** Visual style: number input or single-cell value. */
  variant?: 'plain' | 'highlight'
  /** Set true for integer-only inputs. */
  integer?: boolean
  step?: number
  title?: string
}

/**
 * Inline-editable number. Click value → input opens. Enter / blur commits
 * if changed and valid. Escape reverts.
 */
export function EditableNumber({
  value,
  onChange,
  min = 0,
  max,
  format = (n) => String(n),
  widthClass = 'w-16',
  variant = 'plain',
  integer = false,
  step,
  title,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))
  const inputRef = useRef<HTMLInputElement>(null)

  // Keep draft synced to the incoming value while not editing. Render-phase
  // state adjust (tracking prev value/editing) instead of an effect.
  const [prevValue, setPrevValue] = useState(value)
  const [prevEditing, setPrevEditing] = useState(editing)
  if (value !== prevValue || editing !== prevEditing) {
    setPrevValue(value)
    setPrevEditing(editing)
    if (!editing) setDraft(String(value))
  }

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  function commit() {
    const n = integer ? Math.trunc(Number(draft)) : Number(draft)
    if (!Number.isFinite(n)) {
      setDraft(String(value))
      setEditing(false)
      return
    }
    if (n < min || (max != null && n > max)) {
      setDraft(String(value))
      setEditing(false)
      return
    }
    if (n !== value) onChange(n)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        value={draft}
        min={min}
        max={max}
        step={step ?? (integer ? 1 : undefined)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') {
            setDraft(String(value))
            setEditing(false)
          }
        }}
        className={`${widthClass} bg-zinc-800 border border-sky-600/50 rounded px-1.5 py-0.5 text-sm text-zinc-100 tabular-nums text-right focus:outline-none focus:border-sky-400`}
      />
    )
  }

  const display = format(value)
  const bg =
    variant === 'highlight'
      ? 'bg-sky-950/40 hover:bg-sky-900/40'
      : 'hover:bg-zinc-800'
  return (
    <button
      onClick={() => setEditing(true)}
      title={title ?? '点击编辑'}
      className={`${widthClass} text-right rounded px-1.5 py-0.5 text-sm text-zinc-200 tabular-nums cursor-pointer transition ${bg}`}
    >
      {display}
    </button>
  )
}
