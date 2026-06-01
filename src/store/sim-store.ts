import { create } from 'zustand'
import type { PoolState, PullResult } from '../engine/types'

interface SimState {
  /** Accumulated results across all runs (state-continuing). */
  results: PullResult[]
  /** Engine PoolState carried between runs (so pity counters persist). */
  engineState: PoolState | null
  isRunning: boolean
  appendRun: (results: PullResult[], finalState: PoolState) => void
  setRunning: (b: boolean) => void
  reset: () => void
}

export const useSimStore = create<SimState>((set) => ({
  results: [],
  engineState: null,
  isRunning: false,
  appendRun: (results, finalState) =>
    set((s) => ({
      results: [...s.results, ...results],
      engineState: finalState,
    })),
  setRunning: (b) => set({ isRunning: b }),
  reset: () => set({ results: [], engineState: null }),
}))
