/**
 * The four A-Identity ASP tools sold on OKX.AI, each a THIN wrapper over logic the
 * backend already runs live — no new trust claims, no mocks:
 *
 *   verify_agent      → on-chain ERC-8004 resolve (erc8004.ts) + KYA (readValidation)
 *   reputation_score  → the deterministic 0-1000 scorer (reputation.ts / platform repOf)
 *   risk_check        → NEW ALLOW/WARN/DENY composition over those signals (./risk.ts)
 *   agent_passport    → aggregation of all of the above into one passport JSON
 *
 * An `agentId` may be a platform agent id, an ERC-8004 token id ("#849980" / "849980"),
 * an owner address, or a CAIP-10 id. We resolve platform state first (richest signals),
 * then fall back to a live on-chain read, and cross-link the two when both exist.
 */
import { createIdentityProvider } from '../erc8004.js'
import { readValidation } from '../arc-contracts.js'
import { computeAgentReputation, type ReputationResult } from '../reputation.js'
import { listPlatformAgents, agentReputation, type PlatformAgent } from '../platform.js'
import { assessRisk, type RiskSignals, type TxContext } from './risk.js'

const DAY_MS = 86_400_000

type Bundle = {
  agentId: string
  platform: PlatformAgent | null
  /** Live on-chain ERC-8004 identity, or null if unresolved. */
  identity: Awaited<ReturnType<ReturnType<typeof createIdentityProvider>['resolve']>>
  /** ERC-8004 token id (bigint) if we know one, for on-chain KYA / reputation anchoring. */
  tokenId: bigint | null
  /** On-chain KYA validation summary (from the ValidationRegistry), if a token id is known. */
  validation: Awaited<ReturnType<typeof readValidation>> | null
  reputation: ReputationResult & { basis: string }
  onchainVerified: boolean
  kyaVerified: boolean
  kyaStatus: 'verified' | 'unverified' | 'unknown'
  tenureDays: number
}

const isAddress = (s: string) => /^0x[0-9a-fA-F]{40}$/.test(s)
const asTokenId = (s: string): bigint | null => {
  const m = s.trim().match(/^#?(\d+)$/)
  return m ? BigInt(m[1]) : null
}

/** Resolve every real signal we have for an agent, from platform state + the chain. */
async function gather(agentId: string): Promise<Bundle> {
  const q = agentId.trim()
  const agents = listPlatformAgents()
  const platform =
    agents.find((a) => a.id === q) ??
    agents.find((a) => a.onchainAgentId && (a.onchainAgentId === q || `#${a.onchainAgentId}` === q)) ??
    (isAddress(q) ? agents.find((a) => a.walletAddress?.toLowerCase() === q.toLowerCase()) : undefined) ??
    null

  // On-chain resolve. Prefer the platform agent's known token id; else the raw query.
  const onchainQuery = platform?.onchainAgentId ?? q
  const provider = createIdentityProvider()
  let identity: Bundle['identity'] = null
  try {
    identity = await provider.resolve(onchainQuery)
  } catch {
    identity = null
  }

  const tokenId =
    (platform?.onchainAgentId ? asTokenId(platform.onchainAgentId) : null) ??
    (identity ? BigInt(identity.tokenId) : asTokenId(q))

  // On-chain KYA validation summary (real ValidationRegistry read), when a token id is known.
  let validation: Bundle['validation'] = null
  if (tokenId !== null) {
    try {
      validation = await readValidation(tokenId)
    } catch {
      validation = null
    }
  }

  const onchainVerified = Boolean(identity) || platform?.onchain === 'registered'

  // KYA: platform state is authoritative when present; else fall back to the on-chain
  // validation summary; else unknown.
  let kyaStatus: Bundle['kyaStatus'] = 'unknown'
  if (platform) kyaStatus = platform.kya
  else if (validation && Number((validation as { kyaCount?: number }).kyaCount ?? 0) > 0) kyaStatus = 'verified'
  const kyaVerified = kyaStatus === 'verified'

  // Tenure from the richest available timestamp.
  const createdAt = platform?.createdAt ?? identity?.registeredAt ?? null
  const tenureDays = createdAt
    ? Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / DAY_MS))
    : 0

  // Reputation: platform scorer when we have platform state (real settlement history);
  // else compute from the on-chain signals we can actually see (identity + tenure).
  let reputation: Bundle['reputation']
  if (platform) {
    const r = agentReputation(platform.id)
    if ('error' in r) {
      reputation = { ...computeAgentReputation({ settledCount: 0, rejected: 0, onchainRegistered: onchainVerified, createdAt: createdAt ?? new Date() }), basis: 'onchain-identity+tenure' }
    } else {
      reputation = { score: r.score, breakdown: r.breakdown, settledOnchain: r.settledOnchain, settledUsd: r.settledUsd, basis: 'platform-settlements+identity+tenure' }
    }
  } else {
    reputation = {
      ...computeAgentReputation({ settledCount: 0, rejected: 0, onchainRegistered: onchainVerified, createdAt: createdAt ?? new Date() }),
      basis: onchainVerified ? 'onchain-identity+tenure (no platform settlement history)' : 'no verifiable signals',
    }
  }

  return { agentId: q, platform, identity, tokenId, validation, reputation, onchainVerified, kyaVerified, kyaStatus, tenureDays }
}

// ── the four tools ────────────────────────────────────────────────────────────────

/** verify_agent — ERC-8004 identity + KYA status for an agent. */
export async function verifyAgent(agentId: string) {
  const b = await gather(agentId)
  return {
    tool: 'verify_agent',
    agentId: b.agentId,
    verified: b.onchainVerified,
    kya_status: b.kyaStatus,
    identity: b.identity
      ? {
          tokenId: b.identity.tokenId,
          owner: b.identity.owner,
          chain: b.identity.chain,
          registrationUri: b.identity.registrationUri,
          domain: b.identity.domain || null,
          valid: b.identity.valid,
          registeredAt: b.identity.registeredAt,
        }
      : null,
    kya_onchain: b.validation ?? null,
    platform: b.platform ? { id: b.platform.id, name: b.platform.name, onchain: b.platform.onchain, kya: b.platform.kya } : null,
    source: b.platform && b.identity ? 'platform+onchain' : b.identity ? 'onchain' : b.platform ? 'platform' : 'none',
    checkedAt: new Date().toISOString(),
  }
}

/** reputation_score — deterministic 0-1000 reputation from real signals. */
export async function reputationScore(agentId: string) {
  const b = await gather(agentId)
  return {
    tool: 'reputation_score',
    agentId: b.agentId,
    name: b.platform?.name ?? null,
    score: b.reputation.score,
    breakdown: b.reputation.breakdown,
    settledOnchain: b.reputation.settledOnchain,
    settledUsd: b.reputation.settledUsd,
    basis: b.reputation.basis,
    computedAt: new Date().toISOString(),
  }
}

/** risk_check — pre-transaction ALLOW/WARN/DENY over an agent's trust signals. */
export async function riskCheck(agentId: string, txContext: TxContext | null = null) {
  const b = await gather(agentId)
  const signals: RiskSignals = {
    onchainVerified: b.onchainVerified,
    kyaVerified: b.kyaVerified,
    reputationScore: b.reputation.score,
    tenureDays: b.tenureDays,
  }
  const r = assessRisk(signals, txContext)
  return {
    tool: 'risk_check',
    agentId: b.agentId,
    decision: r.decision,
    risk: r.risk,
    reasons: r.reasons,
    signals: r.signals,
    checkedAt: new Date().toISOString(),
  }
}

/** agent_passport — the full identity + reputation + validation + risk passport. */
export async function agentPassport(agentId: string) {
  const b = await gather(agentId)
  const risk = assessRisk(
    { onchainVerified: b.onchainVerified, kyaVerified: b.kyaVerified, reputationScore: b.reputation.score, tenureDays: b.tenureDays },
    null,
  )
  return {
    tool: 'agent_passport',
    agentId: b.agentId,
    name: b.platform?.name ?? null,
    standard: 'ERC-8004',
    identity: b.identity
      ? { tokenId: b.identity.tokenId, owner: b.identity.owner, chain: b.identity.chain, registrationUri: b.identity.registrationUri, domain: b.identity.domain || null, valid: b.identity.valid, registeredAt: b.identity.registeredAt }
      : null,
    verified: b.onchainVerified,
    kya: { status: b.kyaStatus, onchain: b.validation ?? null },
    reputation: { score: b.reputation.score, breakdown: b.reputation.breakdown, settledOnchain: b.reputation.settledOnchain, settledUsd: b.reputation.settledUsd, basis: b.reputation.basis },
    risk: { decision: risk.decision, level: risk.risk, reasons: risk.reasons },
    platform: b.platform
      ? {
          id: b.platform.id,
          category: b.platform.category,
          capabilities: b.platform.capabilities,
          services: b.platform.services,
          walletAddress: b.platform.walletAddress,
          onchain: b.platform.onchain,
          onchainAgentId: b.platform.onchainAgentId ?? null,
          onchainExplorer: b.platform.onchainExplorer ?? null,
          followers: b.platform.followers.length,
        }
      : null,
    tenureDays: b.tenureDays,
    issuedAt: new Date().toISOString(),
  }
}

export type { TxContext }
