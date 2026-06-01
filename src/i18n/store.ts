import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  translations,
  format,
  type Lang,
  type TranslationKey,
} from './translations'

interface I18nState {
  lang: Lang
  setLang: (l: Lang) => void
  toggle: () => void
}

function detectInitialLang(): Lang {
  // 强制中文默认 — UI 以中国数值策划为主要用户
  return 'zh'
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set, get) => ({
      lang: detectInitialLang(),
      setLang: (l) => set({ lang: l }),
      toggle: () => set({ lang: get().lang === 'en' ? 'zh' : 'en' }),
    }),
    {
      name: 'gacha-sim-i18n',
      // v2: 强制默认中文 — 让首次访问的旧用户拿到 zh
      version: 2,
      migrate: (persisted: unknown, fromVersion: number) => {
        if (fromVersion < 2 && persisted && typeof persisted === 'object') {
          // 强制切到 zh 一次,之后用户切换会被尊重并持久化
          return { ...(persisted as object), lang: 'zh' } as I18nState
        }
        return persisted as I18nState
      },
    },
  ),
)

/**
 * Hook returning a translator bound to the current language.
 *
 *   const t = useT()
 *   <h1>{t('app.title')}</h1>
 *   <span>{t('config.msg.switched', { name: 'foo' })}</span>
 */
export function useT() {
  const lang = useI18nStore((s) => s.lang)
  return (key: TranslationKey, vars?: Record<string, string | number>): string => {
    const template = translations[lang][key] ?? translations.en[key] ?? key
    return format(template, vars)
  }
}

export function useLang(): [Lang, () => void] {
  const lang = useI18nStore((s) => s.lang)
  const toggle = useI18nStore((s) => s.toggle)
  return [lang, toggle]
}
