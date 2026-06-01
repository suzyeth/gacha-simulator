import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { z } from 'zod'
import { PoolSchema, validatePool } from '../engine/schema'
import { xmTingyuanPool } from '../presets/xm'
import { kaipaoTingyuanPool } from '../presets/kaipao-tingyuan'

type Pool = z.infer<typeof PoolSchema>

const DEFAULT_ID = 'kaipao-tingyuan'
const XM_ID = 'xm-default'
const kaipaoConfig: Pool = PoolSchema.parse(kaipaoTingyuanPool)
const xmConfig: Pool = PoolSchema.parse(xmTingyuanPool)
const defaultConfig: Pool = kaipaoConfig

export interface ConfigState {
  /** All saved configs, keyed by stable ID. */
  configs: Record<string, Pool>
  /** Currently active config (drives every panel's rendering). */
  activeId: string

  setActive: (id: string) => void
  /** Clone the active config into a new one and switch to it. Returns new ID. */
  duplicateActive: () => string
  /** Delete a config. Default config cannot be deleted. */
  deleteConfig: (id: string) => void
  /** Rename a config (does not change ID). */
  renameConfig: (id: string, newName: string) => void
  /** Overwrite a config (used by future editor). */
  updateConfig: (id: string, schema: Pool) => void
  /** Reset XM default to original — only acts on default ID. */
  resetDefault: () => void
  /** Import a config from JSON. Returns ID on success or null on validation failure. */
  importConfig: (json: unknown) => { id: string | null; issues: string[] }
}

function genId(): string {
  return `cfg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set, get) => ({
      configs: { [DEFAULT_ID]: defaultConfig, [XM_ID]: xmConfig },
      activeId: DEFAULT_ID,

      setActive: (id) => {
        if (get().configs[id]) set({ activeId: id })
      },

      duplicateActive: () => {
        const { configs, activeId } = get()
        const source = configs[activeId]
        if (!source) return activeId
        const newId = genId()
        const newCfg: Pool = {
          ...source,
          id: newId,
          name: `${source.name} (副本)`,
        }
        set({ configs: { ...configs, [newId]: newCfg }, activeId: newId })
        return newId
      },

      deleteConfig: (id) => {
        if (id === DEFAULT_ID) return
        set((s) => {
          const next = { ...s.configs }
          delete next[id]
          return {
            configs: next,
            activeId: s.activeId === id ? DEFAULT_ID : s.activeId,
          }
        })
      },

      renameConfig: (id, newName) => {
        const trimmed = newName.trim()
        if (!trimmed) return
        set((s) => {
          if (!s.configs[id]) return s
          return {
            configs: { ...s.configs, [id]: { ...s.configs[id], name: trimmed } },
          }
        })
      },

      updateConfig: (id, schema) => {
        set((s) => {
          if (!s.configs[id]) return s
          return { configs: { ...s.configs, [id]: schema } }
        })
      },

      resetDefault: () => {
        set((s) => ({
          configs: {
            ...s.configs,
            [DEFAULT_ID]: defaultConfig,
            [XM_ID]: xmConfig,
          },
        }))
      },

      importConfig: (json) => {
        const parsed = PoolSchema.safeParse(json)
        if (!parsed.success) {
          return {
            id: null,
            issues: parsed.error.issues.map(
              (i) => `${i.path.join('.') || '(root)'}: ${i.message}`,
            ),
          }
        }
        const pool = parsed.data
        // Surface domain validation as warnings (don't block import)
        const issues = validatePool(pool).map(
          (i) => `[${i.severity}] ${i.path}: ${i.message}`,
        )
        const newId = genId()
        // Replace pool.id with our generated id (don't trust imported id)
        const cfg: Pool = { ...pool, id: newId }
        set((s) => ({
          configs: { ...s.configs, [newId]: cfg },
          activeId: newId,
        }))
        return { id: newId, issues }
      },
    }),
    {
      name: 'gacha-sim-configs',
      // v3: 塔防 preset 物品分类/品质标签调整,刷新内置默认。
      version: 3,
      storage: createJSONStorage(() => localStorage),
      // 迁移:总是用最新的内置 preset 覆盖 DEFAULT_ID / XM_ID(用户自定义方案保留)
      migrate: (persisted: unknown, fromVersion: number) => {
        if (fromVersion < 3 && persisted && typeof persisted === 'object') {
          const s = persisted as Partial<ConfigState>
          const configs = { ...(s.configs ?? {}) }
          configs[DEFAULT_ID] = defaultConfig
          configs[XM_ID] = xmConfig
          const activeId = configs[s.activeId ?? ''] ? s.activeId! : DEFAULT_ID
          return { ...s, configs, activeId } as ConfigState
        }
        return persisted as ConfigState
      },
      // Ensure default configs are always present after rehydration
      onRehydrateStorage: () => (state) => {
        if (!state) return
        if (!state.configs[DEFAULT_ID]) state.configs[DEFAULT_ID] = defaultConfig
        if (!state.configs[XM_ID]) state.configs[XM_ID] = xmConfig
        // v1 → v2: 老用户 activeId 可能指向已经不存在的旧 default ('xm-default')。
        // 如果当前 active 不在 configs 里,切回 kaipao。
        if (!state.configs[state.activeId]) state.activeId = DEFAULT_ID
      },
    },
  ),
)

/** Convenience hook for the currently active config. */
export function useActiveConfig(): Pool {
  return useConfigStore(
    (s) => s.configs[s.activeId] ?? s.configs[DEFAULT_ID] ?? defaultConfig,
  )
}

export const DEFAULT_CONFIG_ID = DEFAULT_ID
