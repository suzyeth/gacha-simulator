import type { RuleRegistry } from './rule'
import { cyclicPity } from './cyclic-pity'
import { firstDrawScript } from './first-draw-script'

/** Default rule registry — all built-in rules for XM-style pools. */
export const defaultRegistry: RuleRegistry = {
  'cyclic-pity': cyclicPity,
  'first-draw-script': firstDrawScript,
}
