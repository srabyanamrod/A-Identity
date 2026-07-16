/**
 * Arc on-chain binding — now a THIN layer over the generic multichain engine.
 *
 * Arc is just "the first descriptor the adapter serves": the real logic (identity
 * register, ERC-8183 escrow, USDC settlement, the AgentSpendPolicy vault, ERC-8004
 * KYA attestation) lives in `chains/evm/adapter.ts` and is driven by the Arc descriptor
 * in `chains/registry.ts`. This file keeps the exact same public API every other module
 * imports, so nothing downstream changed; adding another EVM chain is now a registry
 * entry, not a copy of this file. See ../../MULTICHAIN-STRATEGY.md.
 *
 * Reads run live with no key. Writes stay env-gated behind ARC_SIGNER_KEY and
 * human-on-the-loop: nothing broadcasts unless a key is present and the caller
 * explicitly asks to execute. Gas is paid in USDC (~0.006 USDC per tx).
 */
import { ARC_CHAIN, createEvmAdapter, resolveRpcUrls } from './chains/index.js'

/** The Arc adapter — the same engine any EVM chain uses, bound to the Arc descriptor. */
const arc = createEvmAdapter(ARC_CHAIN)

// ── config (derived from the single source of truth in chains/registry.ts) ────────

/** Arc primary RPC (not env-overridden). */
export const ARC_RPC: string = ARC_CHAIN.rpcUrls[0]
/** Arc block explorer base URL. */
export const ARC_EXPLORER: string = ARC_CHAIN.explorer as string
/** Every Arc RPC, primary first (env-overridable via ARC_RPC_URL), for a fallback transport. */
export const ARC_RPCS: string[] = resolveRpcUrls(ARC_CHAIN, process.env)

/** Deployed on Arc Testnet (docs.arc.io). Typed as addresses for viem call sites. */
export const CONTRACTS = {
  identityRegistry: ARC_CHAIN.contracts.identityRegistry as `0x${string}`,
  reputationRegistry: ARC_CHAIN.contracts.reputationRegistry as `0x${string}`,
  validationRegistry: ARC_CHAIN.contracts.validationRegistry as `0x${string}`,
  agenticCommerce: ARC_CHAIN.contracts.agenticCommerce as `0x${string}`,
  usdc: ARC_CHAIN.contracts.usdc as `0x${string}`,
} as const

// ── public API (unchanged signatures, delegating to the Arc adapter) ──────────────

/** Read the real ERC-8004 registry and ERC-8183 commerce contracts, live. */
export const readArcContracts = () => arc.readContracts()

/**
 * Register an agent on the real ERC-8004 IdentityRegistry. Without a signer key it
 * returns the exact prepared call; with one, it broadcasts and returns the tx hash
 * plus the minted agent id (parsed from the Transfer event).
 */
export const registerAgentOnchain = (metadataUri: string, env: NodeJS.ProcessEnv = process.env) =>
  arc.registerAgent(metadataUri, env)

/** Create an ERC-8183 job (escrow-based agentic commerce). Prepared without a key. */
export const createJobOnchain = (
  input: { provider: string; evaluator: string; description: string; expiresInHours?: number },
  env: NodeJS.ProcessEnv = process.env,
) => arc.createJob(input, env)

/** Run the FULL ERC-8183 escrow lifecycle in one shot (6 real txs). Prepared without a key. */
export const runEscrowJobDemo = (
  input: { budgetUsd?: number; description?: string } = {},
  env: NodeJS.ProcessEnv = process.env,
) => arc.runEscrowDemo(input, env)

/** Settle a payment in real USDC on Arc (ERC-20 transfer). Prepared without a key. */
export const payUsdcOnchain = (to: string, amountUsd: number, env: NodeJS.ProcessEnv = process.env) =>
  arc.payUsdc(to, amountUsd, env)

/** Deploy an AgentSpendPolicy vault for an agent (owner=human, operator=agent signer). */
export const deployPolicyVault = (
  input: { owner?: string; operator?: string; dailyCapUsd: number; autoApproveUsd: number },
  env: NodeJS.ProcessEnv = process.env,
) => arc.deployVault(input, env)

/** Agent-initiated payment, enforced on-chain. Reverts (with reason) if a gate fails. */
export const policyPay = (vault: string, to: string, amountUsd: number, env: NodeJS.ProcessEnv = process.env) =>
  arc.policyPay(vault, to, amountUsd, env)

/** Owner settles a human-approved payment (bypasses ceiling/allowlist/freeze). */
export const policyOwnerPay = (vault: string, to: string, amountUsd: number, env: NodeJS.ProcessEnv = process.env) =>
  arc.policyOwnerPay(vault, to, amountUsd, env)

/** Owner updates the on-chain policy (cap, auto-approve ceiling, allowlist flag). */
export const policySetPolicy = (
  vault: string,
  input: { dailyCapUsd: number; autoApproveUsd: number; allowlistEnabled: boolean },
  env: NodeJS.ProcessEnv = process.env,
) => arc.policySetPolicy(vault, input, env)

/** Owner freezes/unfreezes all agent spending. */
export const policySetFrozen = (vault: string, frozen: boolean, env: NodeJS.ProcessEnv = process.env) =>
  arc.policySetFrozen(vault, frozen, env)

/** Owner adds/removes a payee from the on-chain allowlist. */
export const policySetAllowed = (vault: string, payee: string, ok: boolean, env: NodeJS.ProcessEnv = process.env) =>
  arc.policySetAllowed(vault, payee, ok, env)

/** Owner withdraws USDC from the vault. */
export const policyWithdraw = (vault: string, to: string, amountUsd: number, env: NodeJS.ProcessEnv = process.env) =>
  arc.policyWithdraw(vault, to, amountUsd, env)

/** Read the live on-chain policy + balance of a vault (no key needed). */
export const readPolicyVault = (vault: string) => arc.readVault(vault)

/**
 * Attest an agent's KYA result on the ERC-8004 ValidationRegistry (two real txs).
 * Prepared without a key. Requires our signer to own the ERC-8004 agentId.
 */
export const recordValidationOnchain = (agentId: bigint, requestUri: string, env: NodeJS.ProcessEnv = process.env) =>
  arc.recordValidation(agentId, requestUri, env)

/** Read an agent's on-chain KYA validation summary (no key needed). */
export const readValidation = (agentId: bigint, env: NodeJS.ProcessEnv = process.env) =>
  arc.readValidation(agentId, env)
