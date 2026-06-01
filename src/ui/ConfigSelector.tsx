import { useRef, useState } from 'react'
import {
  useConfigStore,
  DEFAULT_CONFIG_ID,
} from '../store/config-store'
import { useSimStore } from '../store/sim-store'
import { importXlsxFiles } from '../importers/xlsx-adapter'
import { useT } from '../i18n/store'

/**
 * Top-bar config switcher: dropdown + rename / duplicate / delete /
 * export / import / reset-default. Switching configs resets simulation
 * state (pity counters etc. don't make sense across different rule sets).
 */
export function ConfigSelector() {
  const t = useT()
  const configs = useConfigStore((s) => s.configs)
  const activeId = useConfigStore((s) => s.activeId)
  const setActive = useConfigStore((s) => s.setActive)
  const duplicate = useConfigStore((s) => s.duplicateActive)
  const del = useConfigStore((s) => s.deleteConfig)
  const rename = useConfigStore((s) => s.renameConfig)
  const importCfg = useConfigStore((s) => s.importConfig)
  const resetDefault = useConfigStore((s) => s.resetDefault)
  const resetSim = useSimStore((s) => s.reset)

  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [feedback, setFeedback] = useState<{
    kind: 'ok' | 'warn' | 'err'
    text: string
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const xlsxInputRef = useRef<HTMLInputElement>(null)
  const [isImporting, setIsImporting] = useState(false)

  const active = configs[activeId]
  const isDefault = activeId === DEFAULT_CONFIG_ID
  const entries = Object.entries(configs)

  function flash(kind: 'ok' | 'warn' | 'err', text: string, ms = 3500) {
    setFeedback({ kind, text })
    setTimeout(() => setFeedback(null), ms)
  }

  function handleSwitch(id: string) {
    if (id === activeId) return
    setActive(id)
    resetSim()
    flash('ok', t('config.msg.switched', { name: configs[id]?.name ?? id }))
  }

  function handleDup() {
    duplicate()
    resetSim()
    flash('ok', t('config.msg.duplicated'))
  }

  function handleDel() {
    if (isDefault) return
    const name = active.name
    if (!confirm(t('config.confirm.delete', { name }))) return
    del(activeId)
    resetSim()
    flash('ok', t('config.msg.deleted', { name }))
  }

  function startRename() {
    setEditName(active.name)
    setEditing(true)
  }

  function saveRename() {
    if (editName.trim()) rename(activeId, editName.trim())
    setEditing(false)
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify(active, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${active.name.replace(/[^\w一-龥-]+/g, '_')}.json`
    a.click()
    URL.revokeObjectURL(url)
    flash('ok', t('config.msg.exported'))
  }

  async function handleImportFile(file: File) {
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const result = importCfg(parsed)
      if (!result.id) {
        flash('err', t('config.msg.import_failed', { msg: result.issues[0] ?? 'schema mismatch' }))
        return
      }
      resetSim()
      if (result.issues.length > 0) {
        flash('warn', t('config.msg.imported_with_warnings', { n: result.issues.length }))
         
        console.warn('Config import warnings:', result.issues)
      } else {
        flash('ok', t('config.msg.imported'))
      }
    } catch (e) {
      flash('err', t('config.msg.parse_failed', { msg: (e as Error).message }))
    }
  }

  async function handleImportXlsx(files: File[]) {
    if (files.length === 0) return
    setIsImporting(true)
    try {
      const result = await importXlsxFiles(files)
      const errors = result.issues.filter((i) => i.severity === 'error')
      const warnings = result.issues.filter((i) => i.severity === 'warning')
       
      console.group('xlsx import')
       
      console.log('Sheets:', result.sheets.map((s) => ({
        file: s.fileName,
        sheet: s.sheetName,
        role: s.role,
        fields: s.fields,
        rows: s.dataRows.length,
      })))
       
      console.log('Issues:', result.issues)
       
      console.groupEnd()

      if (!result.pool) {
        flash('err', t('config.msg.xlsx_failed', { msg: errors[0]?.message ?? '?' }), 6000)
        return
      }
      const stored = importCfg(result.pool)
      if (!stored.id) {
        flash('err', t('config.msg.import_failed', { msg: stored.issues[0] ?? '?' }), 6000)
        return
      }
      resetSim()
      const s = `${result.sheets.length} sheet`
      if (errors.length > 0 || warnings.length > 0) {
        flash('warn', t('config.msg.xlsx_imported_warn', { s, n: errors.length + warnings.length }), 5000)
      } else {
        flash('ok', t('config.msg.xlsx_imported', { s }))
      }
    } catch (e) {
      flash('err', t('config.msg.xlsx_failed', { msg: (e as Error).message }), 6000)
    } finally {
      setIsImporting(false)
    }
  }

  function handleReset() {
    if (!confirm(t('config.confirm.reset'))) return
    resetDefault()
    if (activeId === DEFAULT_CONFIG_ID) resetSim()
    flash('ok', t('config.msg.reset_ok'))
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2 flex-wrap justify-end">
        {editing ? (
          <input
            autoFocus
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={saveRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveRename()
              if (e.key === 'Escape') setEditing(false)
            }}
            className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-sm w-56"
          />
        ) : (
          <select
            value={activeId}
            onChange={(e) => handleSwitch(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm min-w-[14rem]"
            title={t('config.tip.dropdown', { id: activeId })}
          >
            {entries.map(([id, cfg]) => (
              <option key={id} value={id}>
                {cfg.name}
                {id === DEFAULT_CONFIG_ID ? ` ${t('config.default_suffix')}` : ''}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={startRename}
          className="text-xs text-zinc-400 hover:text-zinc-100 px-2 py-1 transition"
          title={t('config.tip.rename')}
        >
          {t('config.rename')}
        </button>
        <button
          onClick={handleDup}
          className="text-xs text-zinc-400 hover:text-zinc-100 px-2 py-1 transition"
          title={t('config.tip.duplicate')}
        >
          {t('config.duplicate')}
        </button>
        <button
          onClick={handleExport}
          className="text-xs text-zinc-400 hover:text-zinc-100 px-2 py-1 transition"
          title={t('config.tip.export')}
        >
          {t('config.export')}
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="text-xs text-zinc-400 hover:text-zinc-100 px-2 py-1 transition"
          title={t('config.tip.import_json')}
        >
          {t('config.import_json')}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleImportFile(f)
            e.target.value = '' // allow re-import of same file
          }}
        />
        <button
          onClick={() => xlsxInputRef.current?.click()}
          disabled={isImporting}
          className="text-xs text-sky-400 hover:text-sky-200 disabled:opacity-50 px-2 py-1 transition"
          title={t('config.tip.import_xlsx')}
        >
          {isImporting ? t('config.import_xlsx_running') : t('config.import_xlsx')}
        </button>
        <input
          ref={xlsxInputRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            if (files.length > 0) handleImportXlsx(files)
            e.target.value = ''
          }}
        />
        <button
          onClick={handleDel}
          disabled={isDefault}
          className="text-xs text-rose-400 hover:text-rose-200 disabled:text-zinc-700 disabled:cursor-not-allowed px-2 py-1 transition"
          title={isDefault ? t('config.tip.delete_default') : t('config.tip.delete')}
        >
          {t('config.delete')}
        </button>
        {isDefault && (
          <button
            onClick={handleReset}
            className="text-xs text-amber-500/70 hover:text-amber-300 px-2 py-1 transition"
            title={t('config.tip.reset_default')}
          >
            {t('config.reset_default')}
          </button>
        )}
      </div>
      {feedback && (
        <div
          className={`text-[11px] tabular-nums ${
            feedback.kind === 'ok'
              ? 'text-emerald-400'
              : feedback.kind === 'warn'
                ? 'text-amber-300'
                : 'text-rose-400'
          }`}
        >
          {feedback.text}
        </div>
      )}
    </div>
  )
}
