/**
 * Deterministic reputation engine — the SINGLE scorer, used in production.
 *
 * `platform.ts` `repOf` gathers an agent's real signals (on-chain settlements, rejections,
 * on-chain identity, tenure) and calls `computeAgentReputation` here. This module holds the
 * pure math so it can be unit-tested independently and independently recomputed by anyone
 * from the same signals (the score can later be anchored on-chain, e.g. a hash in the
 * ERC-8004 Reputation Registry).
 *
 * Historical note: an earlier version of this file scored from a mock `AgentActionHistory`
 * with different constants and was never wired into the running backend — so the tested
 * scorer and the production scorer had drifted apart. They are now the same function.
 *
 * Score (0-1000) = settlement(0-600, incl. a +60 on-chain-identity credit) + validation(0-240) + tenure(0-160).
 */

const DAY_MS = 86_400_000

/** The real, verifiable signals an agent's score is computed from. */
export type ReputationSignals = {
  /** Count of instructions that settled on-chain (status executed_onchain). */
  settledCount: number
  /** Count of instructions that were rejected. */
  rejected: number
  /** True once the agent holds a verified on-chain ERC-8004 identity. */
  onchainRegistered: boolean
  /** When the agent was created (for tenure). ISO string, ms, or Date. */
  createdAt: string | number | Date
  /** Total USD settled on-chain (carried through for display; not part of the score). */
  settledUsd?: number
}

export type ReputationResult = {
  score: number
  breakdown: { settlement: number; validation: number; tenure: number }
  settledOnchain: number
  settledUsd: number
}

/**
 * Pure, deterministic reputation from real signals. `asOf` defaults to now but is
 * injectable for tests. This is exactly the math `platform.ts` runs in production.
 */
export function computeAgentReputation(s: ReputationSignals, asOf: Date = new Date()): ReputationResult {
  const total = s.settledCount + s.rejected
  // Settlement: on-chain settlements with diminishing returns, plus a credit for holding
  // a verified on-chain identity. Capped at 600.
  const idBonus = s.onchainRegistered ? 60 : 0
  const settlement = Math.min(600, Math.round(600 * (1 - Math.exp(-s.settledCount / 6))) + idBonus)
  // Validation: share of clean (settled vs rejected) actions. Capped at 240.
  const validation = total === 0 ? 0 : Math.round(240 * (s.settledCount / total))
  // Tenure: ~1 point per 2 days since creation. Capped at 160. An unparseable/absent
  // createdAt contributes 0 tenure (never NaN) — a NaN score would otherwise slip past
  // every downstream risk comparison (`NaN < threshold` is always false).
  const createdMs = new Date(s.createdAt).getTime()
  const days = Number.isFinite(createdMs) ? Math.max(0, Math.floor((asOf.getTime() - createdMs) / DAY_MS)) : 0
  const tenure = Math.min(160, Math.round(days / 2))
  const score = Math.max(0, Math.min(1000, settlement + validation + tenure))
  return { score, breakdown: { settlement, validation, tenure }, settledOnchain: s.settledCount, settledUsd: s.settledUsd ?? 0 }
}
