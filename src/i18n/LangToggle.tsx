import { useLang } from './store'
import { useT } from './store'

export function LangToggle() {
  const [lang, toggle] = useLang()
  const t = useT()
  return (
    <button
      onClick={toggle}
      title={t('lang.toggle.title')}
      className="text-xs text-zinc-400 hover:text-zinc-100 px-2 py-1 rounded border border-zinc-700/50 hover:border-zinc-500 transition"
    >
      {lang === 'en' ? '中文' : 'EN'}
    </button>
  )
}
