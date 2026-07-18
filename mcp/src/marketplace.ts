/**
 * Marketplace task domain: the PURE logic for a hired-agent task's lifecycle.
 *
 * A-Identity is pivoting to a trusted agent marketplace: a client hires a verified
 * worker agent, USDC is locked in escrow, the agent delivers, and the escrow releases
 * (or refunds on dispute/expiry). The escrow itself is the existing on-chain ERC-8183
 * AgenticCommerce job (see arc-contracts.ts runEscrowJobDemo / rejectJobOnchain /
 * claimJobRefundOnchain / readJobOnchain) - a marketplace Task is an off-chain record
 * bound to an on-chain job id.
 *
 * This module holds NO state and does NO I/O: only the state machine, input
 * normalization, and review aggregation, so it is unit-testable in isolation and the
 * tested logic is the same logic platform.ts runs (mirrors the reputation.ts pattern).
 */

// ── types ─────────────────────────────────────────────────────────────────────

/**
 * A task's lifecycle. Maps onto the ERC-8183 escrow states where it settles on-chain:
 *  - open       : posted as an open task; no worker committed yet (no escrow)
 *  - assigned   : a worker agent is chosen; escrow not funded yet
 *  - funded     : the client's USDC is locked in the on-chain escrow (job funded)
 *  - delivered  : the worker submitted a deliverable (job submitted)
 *  - released   : approved; escrow released to the worker (job completed) - TERMINAL
 *  - disputed   : the client/verifier rejected the deliverable; awaiting resolution
 *  - refunded   : escrow returned to the client (dispute reject or expiry) - TERMINAL
 *  - cancelled  : abandoned before any funds moved - TERMINAL
 */
export type TaskStatus =
  | 'open'
  | 'assigned'
  | 'funded'
  | 'delivered'
  | 'released'
  | 'disputed'
  | 'refunded'
  | 'cancelled'

/** A client's review of a completed task. Written once, on release. */
export type Review = {
  /** The client identity (session subject / wallet) that wrote it. */
  by: string
  /** 1..5 stars. */
  rating: number
  text: string
  at: string
}

export type Task = {
  id: string
  /** The client (session subject) who hired. */
  client: string
  /** The worker agent hired for the task (platform agent id). */
  agentId: string
  /** The service being bought (matches one of the agent's PlatformAgent.services). */
  service: string
  priceUsd: number
  description: string
  status: TaskStatus
  /** What the worker submitted (a URI or short text reference), set on delivery. */
  deliverable?: string
  /** The client's review, set on release. */
  review?: Review
  /** ERC-8183 on-chain job id this task's escrow is bound to (set once funded). */
  jobId?: string
  /** Escrow funding tx + release/refund txs, for the on-chain audit trail on arcscan. */
  escrowTx?: string
  escrowExplorer?: string
  releaseTx?: string
  refundTx?: string
  /** How the escrow settled once terminal: a real on-chain ERC-8183 lifecycle, or a
   *  simulation (no signer key). Honest by design: 'onchain' is set ONLY with a real tx. */
  settlement?: 'onchain' | 'simulated'
  createdAt: string
  /** When the escrow expiry-refund becomes claimable (client safety net). */
  deadlineAt?: string
  updatedAt: string
}

// ── state machine ───────────────────────────────────────────────────────────────

/** Allowed forward transitions. Anything not listed is rejected (fail closed). */
export const TASK_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  open: ['assigned', 'cancelled'],
  assigned: ['funded', 'cancelled'],
  funded: ['delivered', 'disputed', 'refunded'],
  delivered: ['released', 'disputed', 'refunded'],
  disputed: ['released', 'refunded'],
  released: [],
  refunded: [],
  cancelled: [],
}

const TERMINAL: ReadonlySet<TaskStatus> = new Set(['released', 'refunded', 'cancelled'])

/** True once a task can never change again (paid, refunded, or abandoned). */
export function isTerminal(status: TaskStatus): boolean {
  return TERMINAL.has(status)
}

/** Whether `to` is a legal next status from `from`. */
export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TASK_TRANSITIONS[from]?.includes(to) ?? false
}

/**
 * The status a funded task moves to when its escrow settles, given the on-chain outcome.
 * 'complete' -> released (worker paid); 'refund' -> refunded (client made whole). Keeps
 * the app-layer task status in lockstep with the ERC-8183 escrow outcome.
 */
export function statusForEscrowOutcome(outcome: 'complete' | 'refund'): TaskStatus {
  return outcome === 'complete' ? 'released' : 'refunded'
}

// ── input normalization (defense in depth; the HTTP layer validates too) ──────────

/** Upper bound on a single task's price, matching the demo-spend caps elsewhere. */
export const MAX_TASK_PRICE_USD = 1000
/** Default and max escrow deadline (client can reclaim after this if undelivered). */
export const DEFAULT_DEADLINE_HOURS = 72
export const MAX_DEADLINE_HOURS = 24 * 30 // 30 days

/**
 * Coerce a client-supplied price into a safe, finite USDC amount in [0, MAX]. A non-finite
 * or negative price would corrupt escrow funding and reputation math, so it is clamped to 0
 * (an invalid task the caller must reject), never passed through.
 */
export function normalizePriceUsd(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return 0
  return Math.min(MAX_TASK_PRICE_USD, v)
}

/** Clamp a deadline (hours) into (0, MAX], defaulting when unset/invalid. */
export function normalizeDeadlineHours(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return DEFAULT_DEADLINE_HOURS
  return Math.min(MAX_DEADLINE_HOURS, Math.ceil(v))
}

/** Clamp a star rating to an integer in [1, 5]. */
export function sanitizeRating(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 1
  return Math.min(5, Math.max(1, Math.round(v)))
}

/**
 * Compute the escrow deadline (an ISO string) from a start time and a duration, purely
 * (deterministic in its inputs, so it is testable without mocking the clock).
 */
export function deadlineFrom(startIso: string, hours: number): string {
  const start = new Date(startIso).getTime()
  const ms = Number.isFinite(start) ? start : 0
  return new Date(ms + normalizeDeadlineHours(hours) * 3600 * 1000).toISOString()
}

// ── review aggregation (feeds catalog ratings) ────────────────────────────────────

/**
 * Aggregate a service's reviews into an average rating + count. Empty -> { average: 0,
 * count: 0 } so an unrated service reads as "no reviews yet", never NaN. The average is
 * rounded to one decimal for display.
 */
export function aggregateRating(reviews: readonly Review[]): { average: number; count: number } {
  const valid = reviews.filter((r) => Number.isFinite(r.rating))
  if (valid.length === 0) return { average: 0, count: 0 }
  const sum = valid.reduce((s, r) => s + sanitizeRating(r.rating), 0)
  return { average: Math.round((sum / valid.length) * 10) / 10, count: valid.length }
}

// ── display helpers ──────────────────────────────────────────────────────────────

/** Human-facing label for a status (UI + activity log). */
export function statusLabel(status: TaskStatus): string {
  const labels: Record<TaskStatus, string> = {
    open: 'Open',
    assigned: 'Assigned',
    funded: 'Funded (escrow locked)',
    delivered: 'Delivered',
    released: 'Released (paid)',
    disputed: 'Disputed',
    refunded: 'Refunded',
    cancelled: 'Cancelled',
  }
  return labels[status]
}

// ── AMP "Discover": per-agent manifest ────────────────────────────────────────────
//
// The discovery primitive of the AMP layer (Discover -> Authorize -> Execute -> Settle):
// a self-describing manifest an external project reads to find and hire an agent. Pure:
// it formats an agent record + its reputation into the manifest, so it is unit-testable.

/** The minimal agent shape the manifest needs (a subset of PlatformAgent). */
export type ManifestAgent = {
  id: string
  onchainAgentId?: string
  chainId: number
  name: string
  description: string
  category: string
  capabilities: string[]
  walletAddress: string | null
  kya: 'verified' | 'unverified'
  onchain: 'queued' | 'registered'
  endpoint?: string
  services: { name: string; priceUsd: number; unit: string }[]
}

/**
 * Build an agent's public manifest (AMP Discover). Includes its ERC-8004 identity (CAIP-10
 * when anchored), services, reputation, and how to hire it. `hireable` is true only for a
 * KYA-verified agent (the trusted-marketplace rule), so the manifest never invites a hire the
 * server would reject. Relative URLs by default (baseUrl=''), so it works behind any host.
 */
export function buildAgentManifest(agent: ManifestAgent, reputationScore: number, baseUrl = '') {
  const hireable = agent.kya === 'verified'
  return {
    protocol: 'a-identity/amp',
    version: '1',
    agent: {
      id: agent.id,
      erc8004: agent.onchainAgentId ? `eip155:${agent.chainId}:8004/${agent.onchainAgentId}` : null,
      name: agent.name,
      description: agent.description,
      category: agent.category,
      capabilities: agent.capabilities,
      wallet: agent.walletAddress,
      kya: agent.kya,
      onchain: agent.onchain,
      reputation: reputationScore,
      endpoint: agent.endpoint ?? null,
      hireable,
    },
    services: agent.services.map((s) => ({ name: s.name, priceUsd: s.priceUsd, unit: s.unit })),
    amp: {
      discover: `${baseUrl}/api/v1/agents/manifest?agentId=${agent.id}`,
      authorize: 'permissions: daily cap + auto-approve line + human-on-the-loop for large payments',
      execute: 'x402 / nanopayments per call; ERC-8183 escrow for tasks',
      settle: `USDC on Arc (eip155:${agent.chainId}), sub-second finality`,
    },
    hire: hireable
      ? { method: 'POST', endpoint: `${baseUrl}/api/marketplace/hire`, body: { agentId: agent.id, service: '<service name>', priceUsd: '<amount>' } }
      : null,
  }
}
