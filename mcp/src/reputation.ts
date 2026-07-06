/**
 * Deterministic reputation engine.
 *
 * The same action history + reference date always yields the same score, so
 * the result can later be anchored on-chain (e.g. a hash in the ERC-8004
 * Reputation Registry) and independently recomputed by anyone.
 *
 * Score (0-1000) = settlement + validation + tenure.
 */
import type { AgentActionHistory } from './data.js'

export type Reputation = {
  agentId: string
  score: number
  settledActions: number
  disputes: number
  lastUpdated: string
  breakdown: {
    settlement: number
    validation: number
    tenure: number
  }
}

const DAY_MS = 86_400_000

/** Pure, deterministic. `asOf` defaults to now but is injectable for tests. */
export function computeReputation(
  history: AgentActionHistory,
  asOf: Date = new Date(),
): Reputation {
  const { agentId, settledActions, disputes, registeredAt } = history
  const total = settledActions + disputes

  // Settlement: volume with diminishing returns, capped at 600.
  const settlement = Math.round(600 * (1 - Math.exp(-settledActions / 800)))

  // Validation: share of clean (undisputed) actions, capped at 240.
  const cleanRatio = total === 0 ? 0 : settledActions / total
  const validation = Math.round(240 * cleanRatio)

  // Tenure: ~1 point per 2 days on the registry, capped at 160.
  const days = Math.max(0, Math.floor((asOf.getTime() - new Date(registeredAt).getTime()) / DAY_MS))
  const tenure = Math.min(160, Math.round(days / 2))

  const score = Math.max(0, Math.min(1000, settlement + validation + tenure))

  return {
    agentId,
    score,
    settledActions,
    disputes,
    lastUpdated: asOf.toISOString().slice(0, 10),
    breakdown: { settlement, validation, tenure },
  }
}
