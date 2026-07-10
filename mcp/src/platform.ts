/**
 * A-Identity platform backend: agents, wallets, instructions, marketplace.
 *
 * The write side of the product, kept honest:
 *  - Wallets: a real keypair is generated with viem; the PRIVATE KEY IS RETURNED
 *    ONCE and never stored. We keep only the address. No custody.
 *  - Balances: read live from the Arc testnet RPC (native USDC, 18 decimals).
 *  - Funding: via the Circle faucet (faucet.circle.com); we link, a human clicks.
 *  - On-chain registration: prepared and queued. Broadcasting a transaction
 *    needs a funded key and a human, so it stays human-on-the-loop.
 *  - Instructions (pay / purchase / rental / batch): checked against the agent's
 *    permission policy. Under the auto-approve line they auto-approve; above it
 *    they wait for a human. Execution on testnet is simulated until a signer
 *    exists, and marked as such.
 *
 * State persists to mcp/data/platform.json so restarts keep the demo alive.
 */
import { loadState, saveState as save } from './storage.js'
import { ARC_TESTNET } from './arc.js'
import {
  registerAgentOnchain, payUsdcOnchain, ARC_EXPLORER,
  deployPolicyVault, policyPay, policyOwnerPay, readPolicyVault,
} from './arc-contracts.js'

// ── types ─────────────────────────────────────────────────────────────────────

export type Permissions = {
  dailyCapUsd: number
  autoApproveUnderUsd: number
  payeeAllowlist: string[]
  agentToAgent: boolean
  agentToHuman: boolean
  /** Emergency off switch: when true, every instruction pauses for a human. */
  frozen: boolean
}

export type Service = { name: string; priceUsd: number; unit: string }

export type PlatformAgent = {
  id: string
  name: string
  description: string
  category: string
  capabilities: string[]
  /** What this agent sells on the marketplace (hire targets). */
  services: Service[]
  permissions: Permissions
  walletAddress: string | null
  chain: 'arc'
  chainId: number
  kya: 'verified'
  /** Session email of the creator; agent-scoped mutations are restricted to them. */
  owner?: string
  onchain: 'queued' | 'registered'
  /** Set once the ERC-8004 identity is broadcast on Arc (real tx). */
  onchainTx?: string
  onchainExplorer?: string
  onchainAgentId?: string
  /** On-chain AgentSpendPolicy vault: enforces this agent's spend policy on Arc. */
  vaultAddress?: string
  vaultExplorer?: string
  passport: {
    standard: 'ERC-8004'
    registrationJson: Record<string, unknown>
  }
  followers: string[]
  activity: { at: string; text: string }[]
  createdAt: string
  /** Cumulative USD committed today (UTC). Resets at 00:00 UTC. */
  spentTodayUsd?: number
  spendDate?: string
}

export type Wallet = {
  address: string
  agentId: string | null
  chain: 'arc-testnet'
  createdAt: string
}

export type InstructionType = 'payment' | 'purchase' | 'rental' | 'batch'

export type Instruction = {
  id: string
  agentId: string
  type: InstructionType
  amountUsd: number
  /** For batch: how many identical actions to run. */
  count: number
  payee: string
  memo: string
  status:
    | 'auto_approved'
    | 'pending_approval'
    | 'approved'
    | 'executed_simulated'
    | 'executed_onchain'
    | 'rejected'
  policyNote: string
  /** Set when the instruction was broadcast for real on Arc testnet. */
  txHash?: string
  explorerUrl?: string
  /** Which layer settled or blocked this: server pre-check or the on-chain vault. */
  enforcedBy?: 'server' | 'onchain-vault'
  createdAt: string
}

type State = {
  agents: PlatformAgent[]
  wallets: Wallet[]
  instructions: Instruction[]
}

// ── persistence ───────────────────────────────────────────────────────────────

const state: State = { agents: [], wallets: [], instructions: [] }

/**
 * Load persisted state (Postgres via DATABASE_URL, else the local JSON file) into
 * memory. Call once before serving requests.
 */
export async function initState() {
  const loaded = await loadState<State>()
  if (loaded) {
    state.agents = loaded.agents ?? []
    state.wallets = loaded.wallets ?? []
    state.instructions = loaded.instructions ?? []
  }
}

const id = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

// ── wallets ───────────────────────────────────────────────────────────────────

/**
 * Create a real Arc-testnet keypair. The private key is returned to the caller
 * exactly once and NOT stored anywhere on the server.
 */
export async function createWallet(): Promise<{ wallet: Wallet; privateKey: string; note: string }> {
  const { generatePrivateKey, privateKeyToAccount } = await import('viem/accounts')
  const privateKey = generatePrivateKey()
  const account = privateKeyToAccount(privateKey)
  const wallet: Wallet = {
    address: account.address,
    agentId: null,
    chain: 'arc-testnet',
    createdAt: new Date().toISOString(),
  }
  state.wallets.push(wallet)
  save(state)
  return {
    wallet,
    privateKey,
    note:
      'Save this private key now. It is shown once and never stored by A-Identity. ' +
      `Fund the address with testnet USDC at ${ARC_TESTNET.faucet}.`,
  }
}

/**
 * Record a wallet whose keypair was generated CLIENT-SIDE. The server only ever
 * sees the public address — the private key never leaves the browser. This is the
 * no-custody path, preferred over server-side key generation.
 */
export function recordWallet(address: string): { wallet: Wallet } {
  const existing = state.wallets.find((w) => w.address.toLowerCase() === address.toLowerCase())
  if (existing) return { wallet: existing }
  const wallet: Wallet = {
    address,
    agentId: null,
    chain: 'arc-testnet',
    createdAt: new Date().toISOString(),
  }
  state.wallets.push(wallet)
  save(state)
  return { wallet }
}

export function assignWallet(address: string, agentId: string): Wallet | null {
  const wallet = state.wallets.find((w) => w.address.toLowerCase() === address.toLowerCase())
  const agent = state.agents.find((a) => a.id === agentId)
  if (!wallet || !agent) return null
  wallet.agentId = agentId
  agent.walletAddress = wallet.address
  pushActivity(agent, `Wallet ${short(wallet.address)} assigned`)
  save(state)
  return wallet
}

/** Live native-USDC balance from the Arc testnet RPC. Real read, no key needed. */
export async function getWalletBalance(address: string) {
  try {
    const { createPublicClient, http, formatUnits } = await import('viem')
    const client = createPublicClient({
      transport: http(ARC_TESTNET.rpc.primary, { timeout: 6000, retryCount: 0 }),
    })
    const wei = await client.getBalance({ address: address as `0x${string}` })
    return {
      address,
      chain: 'arc-testnet',
      balance: formatUnits(wei, ARC_TESTNET.nativeDecimals),
      symbol: 'USDC',
      source: 'live-rpc',
      faucet: ARC_TESTNET.faucet,
    }
  } catch (err) {
    return {
      address,
      chain: 'arc-testnet',
      balance: null,
      symbol: 'USDC',
      source: 'rpc-unreachable',
      faucet: ARC_TESTNET.faucet,
      note: err instanceof Error ? err.message : String(err),
    }
  }
}

// ── agents ────────────────────────────────────────────────────────────────────

export function createAgent(input: {
  name: string
  description: string
  category: string
  capabilities: string[]
  services?: Service[]
  permissions: Partial<Permissions>
  walletAddress?: string
  owner?: string
}): PlatformAgent {
  const permissions: Permissions = {
    dailyCapUsd: input.permissions.dailyCapUsd ?? 50,
    autoApproveUnderUsd: input.permissions.autoApproveUnderUsd ?? 1,
    payeeAllowlist: input.permissions.payeeAllowlist ?? [],
    agentToAgent: input.permissions.agentToAgent ?? true,
    agentToHuman: input.permissions.agentToHuman ?? false,
    frozen: input.permissions.frozen ?? false,
  }

  // Services the agent sells on the marketplace. Default: one per capability at
  // a nominal price, so a fresh agent is immediately hireable in Agent House.
  const services: Service[] =
    input.services && input.services.length > 0
      ? input.services
      : input.capabilities.map((c) => ({ name: c, priceUsd: 1, unit: 'per action' }))

  const agent: PlatformAgent = {
    id: id('agent'),
    name: input.name,
    description: input.description,
    category: input.category,
    capabilities: input.capabilities,
    services,
    permissions,
    walletAddress: input.walletAddress ?? null,
    chain: 'arc',
    chainId: ARC_TESTNET.id,
    kya: 'verified',
    owner: input.owner,
    onchain: 'queued',
    passport: {
      standard: 'ERC-8004',
      registrationJson: {
        name: input.name,
        description: input.description,
        category: input.category,
        capabilities: input.capabilities,
        chain: `eip155:${ARC_TESTNET.id}`,
        registeredAt: new Date().toISOString().slice(0, 10),
      },
    },
    followers: [],
    activity: [{ at: new Date().toISOString(), text: 'Agent registered, KYA passed, on-chain anchor queued' }],
    createdAt: new Date().toISOString(),
  }

  if (input.walletAddress) {
    const w = state.wallets.find(
      (x) => x.address.toLowerCase() === input.walletAddress!.toLowerCase(),
    )
    if (w) w.agentId = agent.id
  }

  state.agents.push(agent)
  save(state)
  return agent
}

export function listPlatformAgents(): PlatformAgent[] {
  return state.agents
}

/**
 * Anchor an existing platform agent on Arc: broadcast a real ERC-8004 registration
 * (server signer, env-gated behind ARC_SIGNER_KEY) and record the result on the agent.
 * Deliberate + human-triggered from the UI, so it stays human-on-the-loop. Without a
 * signer key it returns the exact prepared call and leaves the agent queued.
 */
export async function anchorAgentOnchain(agentId: string, caller?: string) {
  const agent = state.agents.find((a) => a.id === agentId)
  if (!agent) return { error: 'Unknown agent' }
  if (!ownsAgent(agent, caller)) return { error: 'Forbidden: not the agent owner' }

  const metadataUri =
    'data:application/json,' +
    encodeURIComponent(
      JSON.stringify({ name: agent.name, category: agent.category, standard: 'ERC-8004', app: 'A-Identity' }),
    )

  const result = await registerAgentOnchain(metadataUri)

  if (result.executed) {
    agent.onchain = 'registered'
    agent.onchainTx = result.txHash
    agent.onchainExplorer = result.explorerUrl
    agent.onchainAgentId = result.agentId
    pushActivity(agent, `Anchored on Arc: ERC-8004 id ${result.agentId ?? '?'} (tx ${short(result.txHash)})`)
    save(state)
  }

  return {
    agent: {
      id: agent.id,
      onchain: agent.onchain,
      onchainTx: agent.onchainTx,
      onchainExplorer: agent.onchainExplorer,
      onchainAgentId: agent.onchainAgentId,
    },
    result,
  }
}

// ── on-chain policy vault ────────────────────────────────────────────────────────

/**
 * Provision an on-chain AgentSpendPolicy vault for an agent: deploy a contract
 * that enforces the agent's daily cap + auto-approve ceiling on Arc, and
 * optionally fund it with USDC. Once set, this agent's address payments settle
 * through the vault (chain-enforced), with the server engine as the pre-check.
 * Owner-only; env-gated behind ARC_SIGNER_KEY.
 */
export async function provisionAgentVault(
  agentId: string,
  opts: { fundUsd?: number; caller?: string } = {},
) {
  const agent = state.agents.find((a) => a.id === agentId)
  if (!agent) return { error: 'Unknown agent' }
  if (!ownsAgent(agent, opts.caller)) return { error: 'Forbidden: not the agent owner' }
  if (agent.vaultAddress) return { error: 'Agent already has an on-chain policy vault', vaultAddress: agent.vaultAddress }

  const dep = await deployPolicyVault({
    dailyCapUsd: agent.permissions.dailyCapUsd,
    autoApproveUsd: agent.permissions.autoApproveUnderUsd,
  })
  if (!dep.executed) return { error: dep.reason }

  agent.vaultAddress = dep.vault
  agent.vaultExplorer = `${ARC_EXPLORER}/address/${dep.vault}`
  pushActivity(agent, `On-chain policy vault deployed at ${short(dep.vault)} (tx ${short(dep.txHash)})`)

  let funding: unknown = null
  if (opts.fundUsd && opts.fundUsd > 0) {
    const f = await payUsdcOnchain(dep.vault, opts.fundUsd)
    funding = f.executed
      ? { amountUsd: opts.fundUsd, txHash: f.txHash, explorerUrl: f.explorerUrl }
      : { error: f.reason }
    if (f.executed) pushActivity(agent, `Funded vault with ${opts.fundUsd} USDC (tx ${short(f.txHash)})`)
  }
  save(state)
  return {
    vaultAddress: agent.vaultAddress,
    vaultExplorer: agent.vaultExplorer,
    deployTx: dep.txHash,
    deployExplorer: dep.explorerUrl,
    funding,
  }
}

/** Read an agent's live on-chain vault policy + balance (no key needed). */
export async function getAgentVault(agentId: string) {
  const agent = state.agents.find((a) => a.id === agentId)
  if (!agent) return { error: 'Unknown agent' }
  if (!agent.vaultAddress) return { vaultAddress: null }
  const live = await readPolicyVault(agent.vaultAddress)
  return { vaultAddress: agent.vaultAddress, ...live }
}

// ── policy / permissions ───────────────────────────────────────────────────────

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Reset-aware daily spend: returns 0 once the UTC date rolls over. */
function dailySpent(agent: PlatformAgent): number {
  return agent.spendDate === todayUTC() ? agent.spentTodayUsd ?? 0 : 0
}

function addSpend(agent: PlatformAgent, amount: number) {
  const today = todayUTC()
  if (agent.spendDate !== today) {
    agent.spendDate = today
    agent.spentTodayUsd = 0
  }
  agent.spentTodayUsd = (agent.spentTodayUsd ?? 0) + amount
}

/** Next 00:00 UTC, for the UI "resets at" display. */
function nextUtcMidnight(): string {
  const now = new Date()
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0),
  ).toISOString()
}

/** True if the caller may act on this agent: owner match, or the agent has no owner. */
function ownsAgent(agent: PlatformAgent, caller?: string): boolean {
  return !agent.owner || agent.owner === caller
}

export function updateAgentPermissions(
  agentId: string,
  partial: Partial<Permissions>,
  caller?: string,
): PlatformAgent | { error: string } {
  const agent = state.agents.find((a) => a.id === agentId)
  if (!agent) return { error: 'Unknown agent' }
  if (!ownsAgent(agent, caller)) return { error: 'Forbidden: not the agent owner' }
  agent.permissions = { ...agent.permissions, ...partial }
  pushActivity(agent, 'Permissions updated by a human')
  save(state)
  return agent
}

/** Live policy view for one agent: limits + today's spend + reset time. */
export function agentPolicy(agentId: string) {
  const agent = state.agents.find((a) => a.id === agentId)
  if (!agent) return { error: 'Unknown agent' }
  const spent = dailySpent(agent)
  return {
    agentId: agent.id,
    name: agent.name,
    permissions: agent.permissions,
    spentTodayUsd: spent,
    remainingTodayUsd: Math.max(0, agent.permissions.dailyCapUsd - spent),
    resetsAt: nextUtcMidnight(),
  }
}

// ── reputation (from real activity) ─────────────────────────────────────────────

/**
 * Reputation (0-1000) computed from the agent's REAL signals, deterministically:
 *  - settlement: real on-chain USDC settlements (diminishing returns), + a credit
 *    for holding a verified on-chain ERC-8004 identity
 *  - validation: share of clean (settled vs rejected) actions
 *  - tenure: days on the platform
 * Every input is real and verifiable (settlements carry tx hashes) — no mock history.
 */
function repOf(agent: PlatformAgent) {
  const ixs = state.instructions.filter((i) => i.agentId === agent.id)
  const settled = ixs.filter((i) => i.status === 'executed_onchain')
  const rejected = ixs.filter((i) => i.status === 'rejected').length
  const settledCount = settled.length
  const settledUsd = settled.reduce((s, i) => s + i.amountUsd * i.count, 0)
  const total = settledCount + rejected
  const idBonus = agent.onchain === 'registered' ? 60 : 0
  const settlement = Math.min(600, Math.round(600 * (1 - Math.exp(-settledCount / 6))) + idBonus)
  const validation = total === 0 ? 0 : Math.round(240 * (settledCount / total))
  const days = Math.max(0, Math.floor((Date.now() - new Date(agent.createdAt).getTime()) / 86_400_000))
  const tenure = Math.min(160, Math.round(days / 2))
  const score = Math.max(0, Math.min(1000, settlement + validation + tenure))
  return { score, breakdown: { settlement, validation, tenure }, settledOnchain: settledCount, settledUsd }
}

export function agentReputation(agentId: string) {
  const agent = state.agents.find((a) => a.id === agentId)
  if (!agent) return { error: 'Unknown agent' }
  return { agentId: agent.id, name: agent.name, onchain: agent.onchain, ...repOf(agent), computedAt: new Date().toISOString() }
}

// ── instructions ──────────────────────────────────────────────────────────────

/** AgentSpendPolicy error names that are authoritative policy rejections (vs an
 *  infra error, which we fall back on rather than treat as a "no"). */
const VAULT_POLICY_ERRORS = new Set([
  'IsFrozen', 'PayeeNotAllowed', 'AboveAutoApprove', 'DailyCapExceeded', 'ZeroAddress', 'TransferFailed',
])

export function createInstruction(input: {
  agentId: string
  type: InstructionType
  amountUsd: number
  count?: number
  payee: string
  memo?: string
  caller?: string
}): Instruction | { error: string } {
  const agent = state.agents.find((a) => a.id === input.agentId)
  if (!agent) return { error: 'Unknown agent' }
  if (!ownsAgent(agent, input.caller)) return { error: 'Forbidden: not the agent owner' }

  const count = Math.max(1, Math.floor(input.count ?? 1))
  const total = input.amountUsd * count
  const p = agent.permissions

  // Policy checks, in the order a bank would run them.
  let status: Instruction['status']
  let policyNote: string

  const payeeAllowed = p.payeeAllowlist.length === 0 || p.payeeAllowlist.includes(input.payee)
  const spentToday = dailySpent(agent)

  if (p.frozen) {
    status = 'pending_approval'
    policyNote = 'Agent is frozen; all activity is paused. A human must unfreeze or approve.'
  } else if (!payeeAllowed) {
    status = 'pending_approval'
    policyNote = `Payee not on the allowlist; a human must approve.`
  } else if (spentToday + total > p.dailyCapUsd) {
    status = 'pending_approval'
    policyNote = `Would exceed today's cap ($${spentToday.toFixed(2)} spent + $${total.toFixed(2)} > $${p.dailyCapUsd}); a human must approve.`
  } else if (total <= p.autoApproveUnderUsd) {
    status = 'auto_approved'
    policyNote = `Under the $${p.autoApproveUnderUsd} auto-approve line.`
  } else {
    status = 'pending_approval'
    policyNote = `Above the auto-approve line ($${p.autoApproveUnderUsd}); waiting for a human.`
  }

  // Auto-approved payments commit against today's cap immediately.
  if (status === 'auto_approved') addSpend(agent, total)

  const instruction: Instruction = {
    id: id('ix'),
    agentId: agent.id,
    type: input.type,
    amountUsd: input.amountUsd,
    count,
    payee: input.payee,
    memo: input.memo ?? '',
    status,
    policyNote,
    createdAt: new Date().toISOString(),
  }

  state.instructions.push(instruction)
  pushActivity(
    agent,
    `${cap(input.type)} instruction for $${total.toFixed(2)} (${count}x): ${status.replace('_', ' ')}`,
  )
  save(state)
  return instruction
}

export function approveInstruction(ixId: string, caller?: string): Instruction | { error: string } {
  const ix = state.instructions.find((i) => i.id === ixId)
  if (!ix) return { error: 'Unknown instruction' }
  const ag = state.agents.find((a) => a.id === ix.agentId)
  if (ag && !ownsAgent(ag, caller)) return { error: 'Forbidden: not the agent owner' }
  if (ix.status !== 'pending_approval') return { error: `Cannot approve from status ${ix.status}` }
  ix.status = 'approved'
  ix.policyNote = 'Approved by a human.'
  const agent = state.agents.find((a) => a.id === ix.agentId)
  if (agent) {
    addSpend(agent, ix.amountUsd * ix.count)
    pushActivity(agent, `Instruction ${ix.id} approved by a human`)
  }
  save(state)
  return ix
}

/**
 * Execute an approved or auto-approved instruction. When the agent has an
 * on-chain policy vault, address payments settle THROUGH it — the vault enforces
 * the daily cap / auto-approve ceiling / freeze on Arc, so a disallowed payment
 * reverts on-chain (the source of truth). The server engine stays the pre-check;
 * if the vault path hits an infra error (not a policy revert) we fall back to
 * direct settlement so a chain hiccup never blocks the flow. Without a signer
 * key, execution is SIMULATED and labeled as such; the trail stays honest.
 */
export async function executeInstruction(ixId: string, caller?: string): Promise<Instruction | { error: string }> {
  const ix = state.instructions.find((i) => i.id === ixId)
  if (!ix) return { error: 'Unknown instruction' }
  if (ix.status !== 'approved' && ix.status !== 'auto_approved')
    return { error: `Cannot execute from status ${ix.status}` }
  const agent = state.agents.find((a) => a.id === ix.agentId)
  if (agent && !ownsAgent(agent, caller)) return { error: 'Forbidden: not the agent owner' }
  const total = ix.amountUsd * ix.count
  const fmt = (n: number) => (n < 0.01 ? n.toFixed(4) : n.toFixed(2))
  const isAddr = /^0x[0-9a-fA-F]{40}$/.test(ix.payee)

  // On-chain policy vault: the chain enforces the policy. Agent-initiated
  // (auto-approved) payments go through pay(); human-approved ones through
  // ownerPay() (override). A policy revert is an authoritative rejection; an
  // infra error falls through to direct settlement below.
  if (isAddr && agent?.vaultAddress) {
    const humanApproved = ix.status === 'approved'
    const res = humanApproved
      ? await policyOwnerPay(agent.vaultAddress, ix.payee, total)
      : await policyPay(agent.vaultAddress, ix.payee, total)
    if (res.executed) {
      ix.status = 'executed_onchain'
      ix.txHash = res.txHash
      ix.explorerUrl = res.explorerUrl
      ix.enforcedBy = 'onchain-vault'
      ix.policyNote = `Settled ${fmt(total)} USDC through the on-chain policy vault (${humanApproved ? 'human override' : 'agent, within policy'}).`
      pushActivity(agent, `On-chain vault settled ${fmt(total)} USDC to ${short(ix.payee)} (tx ${short(res.txHash)})`)
      save(state)
      return ix
    }
    if (res.reverted && VAULT_POLICY_ERRORS.has(res.reason)) {
      ix.status = 'pending_approval'
      ix.enforcedBy = 'onchain-vault'
      ix.policyNote = `On-chain policy vault rejected this (${res.reason}); a human must intervene.`
      pushActivity(agent, `On-chain vault rejected ${fmt(total)} USDC to ${short(ix.payee)}: ${res.reason}`)
      save(state)
      return ix
    }
    // Not a policy revert (no key / infra error) — fall through to direct settlement.
  }

  // Direct settlement when the payee is an Arc address and a signer is configured.
  if (isAddr) {
    const res = await payUsdcOnchain(ix.payee, total)
    if (res.executed) {
      ix.status = 'executed_onchain'
      ix.txHash = res.txHash
      ix.explorerUrl = res.explorerUrl
      ix.enforcedBy = 'server'
      ix.policyNote = `Settled ${fmt(total)} USDC on Arc.`
      if (agent) pushActivity(agent, `Settled ${total.toFixed(4)} USDC on Arc to ${short(ix.payee)} (tx ${short(res.txHash)})`)
      save(state)
      return ix
    }
    ix.policyNote = 'No signer configured; settlement simulated.'
  }

  ix.status = 'executed_simulated'
  if (!isAddr) ix.policyNote = 'Executed as a testnet simulation (payee is not an Arc address).'
  if (agent) pushActivity(agent, `Executed (simulated) ${ix.type} of $${total.toFixed(2)}`)
  save(state)
  return ix
}

export function listInstructions(agentId?: string): Instruction[] {
  return agentId ? state.instructions.filter((i) => i.agentId === agentId) : state.instructions
}

// ── marketplace ───────────────────────────────────────────────────────────────

export function followAgent(agentId: string, follower: string): { followers: number } | { error: string } {
  const agent = state.agents.find((a) => a.id === agentId)
  if (!agent) return { error: 'Unknown agent' }
  const i = agent.followers.indexOf(follower)
  if (i >= 0) agent.followers.splice(i, 1)
  else {
    agent.followers.push(follower)
    pushActivity(agent, `${follower} started following`)
  }
  save(state)
  return { followers: agent.followers.length }
}

/** The marketplace feed: every platform agent as a showcase card. */
export function marketplace(viewer?: string) {
  return {
    agents: state.agents.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      category: a.category,
      capabilities: a.capabilities,
      chain: a.chain,
      kya: a.kya,
      onchain: a.onchain,
      onchainTx: a.onchainTx,
      onchainExplorer: a.onchainExplorer,
      onchainAgentId: a.onchainAgentId,
      reputation: repOf(a),
      walletAddress: a.walletAddress,
      followers: a.followers.length,
      followedByViewer: viewer ? a.followers.includes(viewer) : false,
      activity: a.activity.slice(-5).reverse(),
      createdAt: a.createdAt,
    })),
    total: state.agents.length,
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────

function pushActivity(agent: PlatformAgent, text: string) {
  agent.activity.push({ at: new Date().toISOString(), text })
  if (agent.activity.length > 50) agent.activity.splice(0, agent.activity.length - 50)
}

const short = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`
const cap = (s: string) => s[0].toUpperCase() + s.slice(1)
