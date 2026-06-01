/// <reference lib="webworker" />

import { adaptToEngine } from '../engine/adapter'
import { createInitialState, pullMany } from '../engine/simulator'
import { multiTrialUntilTarget } from '../engine/scenarios'
import { defaultRegistry } from '../engine/rules/registry'
import type { PoolSchema } from '../engine/schema'
import type { PoolState, PullResult } from '../engine/types'

export interface ContinuousRequest {
  mode: 'continuous'
  pool: PoolSchema
  state: PoolState | null
  count: number
}

export interface TargetRequest {
  mode: 'target'
  pool: PoolSchema
  targetResId: string
  trials: number
  maxPulls: number
}

export type SimRequest = ContinuousRequest | TargetRequest

export interface ContinuousResponse {
  mode: 'continuous'
  results: PullResult[]
  state: PoolState
  elapsedMs: number
}

export interface TargetResponse {
  mode: 'target'
  trials: Array<{ pullsToTarget: number; succeeded: boolean }>
  elapsedMs: number
}

export interface ErrorResponse {
  mode: 'error'
  message: string
  requestMode: SimRequest['mode']
}

export type SimResponse = ContinuousResponse | TargetResponse | ErrorResponse

self.onmessage = (e: MessageEvent<SimRequest>) => {
  const req = e.data
  const t0 = performance.now()
  const post = (p: SimResponse) => (self as unknown as Worker).postMessage(p)

  // 任何引擎错误都要回传 — 否则主线程的 isRunning 永远卡在 true。
  try {
    if (req.mode === 'continuous') {
      const enginePool = adaptToEngine(req.pool)
      const startState = req.state ?? createInitialState(enginePool)
      const out = pullMany(req.count, {
        pool: enginePool,
        state: startState,
        rng: Math.random,
        registry: defaultRegistry,
      })
      post({
        mode: 'continuous',
        results: out.results,
        state: out.state,
        elapsedMs: performance.now() - t0,
      })
      return
    }

    if (req.mode === 'target') {
      const enginePool = adaptToEngine(req.pool)
      const trials = multiTrialUntilTarget({
        pool: enginePool,
        targetResId: req.targetResId,
        trials: req.trials,
        maxPulls: req.maxPulls,
        rng: Math.random,
        registry: defaultRegistry,
      })
      post({ mode: 'target', trials, elapsedMs: performance.now() - t0 })
      return
    }
  } catch (err) {
    post({
      mode: 'error',
      message: err instanceof Error ? err.message : String(err),
      requestMode: req.mode,
    })
  }
}
