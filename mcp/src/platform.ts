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
import { randomBytes } from 'node:crypto'
import {
  registerAgentOnchain, payUsdcOnchain, ARC_EXPLORER,
  deployPolicyVault, policyPay, policyOwnerPay, readPolicyVault,
  policySetPolicy, policySetFrozen, policySetAllowed,
  recordValidationOnchain, readValidation,
} from './arc-contracts.js'
import { createAgentWallet, circlePay, readCircleWallet } from './circle-agent.js'
import { previewTreasury, startAutoYield, type TreasuryPreview, type TreasuryExecution } from './treasury.js'

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
  /** KYA (Know Your Agent): 'verified' ONLY after the agent proves control of its
   *  wallet by signing a challenge. New agents start 'unverified'. */
  kya: 'unverified' | 'verified'
  /** How KYA was proven (the wallet-control signature). */
  kyaProof?: { address: string; at: string; method: 'wallet-signature' }
  /** Set once the KYA result is attested on the ERC-8004 ValidationRegistry (real tx). */
  kyaOnchainTx?: string
  kyaOnchainExplorer?: string
  kyaRequestHash?: string
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
  /** The human owner the vault was deployed with (freeze/override/withdraw). Distinct
   *  from the operator so the on-chain owner≠operator separation is real. */
  vaultOwner?: string
  /** The operator (agent signer) that calls pay(); the server signer in this demo. */
  vaultOperator?: string
  /** Circle Agent Wallet (Developer-Controlled, ARC-TESTNET): Circle's hosted
   *  policy engine screens this wallet's transfers at the wallet layer. */
  circleWalletId?: string
  circleWalletAddress?: string
  circleWalletExplorer?: string
  /** Owner-authorized auto-yield: idle balance above capUsd is earmarked for USYC
   *  (Circle's yield-bearing token). Off by default; the owner turns it on. */
  treasury?: { autoYieldEnabled: boolean; capUsd: number; authorizedAt?: string }
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
  /** Which layer settled or blocked this: our server pre-check, Circle's hosted
   *  policy engine (Agent Wallet), or the trustless on-chain vault. */
  enforcedBy?: 'server' | 'circle-agent-stack' | 'onchain-vault'
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
    kya: 'unverified',
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
    activity: [{ at: new Date().toISOString(), text: 'Agent registered; KYA pending (prove wallet control), on-chain anchor queued' }],
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

// ── KYA (Know Your Agent): prove wallet control ──────────────────────────────────

/**
 * Ephemeral KYA challenges, keyed by agentId. In-memory + a short TTL, so a challenge
 * can't be signed forever and stale entries can't accumulate. This is correct for the
 * single backend instance we deploy; a horizontally-scaled deploy would move these to
 * shared storage (a challenge issued by instance A must be verifiable by instance B).
 */
const KYA_CHALLENGE_TTL_MS = 10 * 60 * 1000
const kyaChallenges = new Map<string, { nonce: string; exp: number }>()

/** Start a KYA challenge: the agent signs this to prove it controls its wallet. */
export function startKyaChallenge(
  agentId: string,
  caller?: string,
): { address: string; message: string } | { error: string } {
  const agent = state.agents.find((a) => a.id === agentId)
  if (!agent) return { error: 'Unknown agent' }
  if (!ownsAgent(agent, caller)) return { error: 'Forbidden: not the agent owner' }
  if (!agent.walletAddress) return { error: 'Agent has no wallet to prove; create or assign one first' }
  const nonce = randomBytes(16).toString('hex')
  kyaChallenges.set(agentId, { nonce, exp: Date.now() + KYA_CHALLENGE_TTL_MS })
  const message = `A-Identity KYA: prove control of ${agent.walletAddress}\nAgent: ${agentId}\nNonce: ${nonce}`
  return { address: agent.walletAddress, message }
}

/**
 * Finish KYA: verify the agent's wallet signed the challenge (viem verifyMessage). On
 * success sets kya='verified' + records the proof, then best-effort attests the result
 * on the real ERC-8004 ValidationRegistry (needs the agent anchored + a signer key; an
 * on-chain failure never undoes the cryptographically-proven 'verified' state).
 */
export async function verifyKya(
  agentId: string,
  message: string,
  signature: string,
  caller?: string,
): Promise<{ error: string } | { kya: 'verified'; kyaProof: PlatformAgent['kyaProof']; onchain: unknown }> {
  const agent = state.agents.find((a) => a.id === agentId)
  if (!agent) return { error: 'Unknown agent' }
  if (!ownsAgent(agent, caller)) return { error: 'Forbidden: not the agent owner' }
  if (!agent.walletAddress) return { error: 'Agent has no wallet' }
  const challenge = kyaChallenges.get(agentId)
  if (challenge && challenge.exp <= Date.now()) kyaChallenges.delete(agentId)
  const nonce = challenge && challenge.exp > Date.now() ? challenge.nonce : undefined
  if (!nonce || !message.includes(nonce)) return { error: 'Stale or missing challenge; request a new one' }

  const { verifyMessage } = await import('viem')
  let ok = false
  try {
    ok = await verifyMessage({
      address: agent.walletAddress as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    })
  } catch {
    ok = false
  }
  if (!ok) return { error: 'Signature does not match the agent wallet' }

  kyaChallenges.delete(agentId)
  agent.kya = 'verified'
  agent.kyaProof = { address: agent.walletAddress, at: new Date().toISOString(), method: 'wallet-signature' }
  pushActivity(agent, `KYA passed: wallet control proven (${short(agent.walletAddress)})`)

  // Layer B — anchor the KYA result on the ERC-8004 ValidationRegistry (best-effort).
  let onchain: unknown = null
  if (agent.onchainAgentId) {
    const requestUri =
      'data:application/json,' +
      encodeURIComponent(
        JSON.stringify({ kya: 'wallet-signature', agent: agent.id, address: agent.walletAddress, at: agent.kyaProof.at }),
      )
    const r = await recordValidationOnchain(BigInt(agent.onchainAgentId), requestUri)
    if (r.executed) {
      agent.kyaOnchainTx = r.txHash
      agent.kyaOnchainExplorer = r.explorerUrl
      agent.kyaRequestHash = r.requestHash
      pushActivity(agent, `KYA attested on-chain (ERC-8004 ValidationRegistry, tx ${short(r.txHash)})`)
      onchain = { txHash: r.txHash, explorerUrl: r.explorerUrl, requestHash: r.requestHash }
    } else {
      onchain = { prepared: true, reason: r.reason }
    }
  }
  save(state)
  return { kya: 'verified', kyaProof: agent.kyaProof, onchain }
}

/** Read an agent's KYA status + live on-chain validation (needs the agent anchored). */
export async function getAgentKya(agentId: string) {
  const agent = state.agents.find((a) => a.id === agentId)
  if (!agent) return { error: 'Unknown agent' }
  const base = {
    kya: agent.kya,
    kyaProof: agent.kyaProof ?? null,
    kyaOnchainTx: agent.kyaOnchainTx ?? null,
    kyaOnchainExplorer: agent.kyaOnchainExplorer ?? null,
  }
  if (!agent.onchainAgentId) return { ...base, onchain: null }
  return { ...base, onchain: await readValidation(BigInt(agent.onchainAgentId)) }
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
  opts: { fundUsd?: number; caller?: string; ownerAddress?: string } = {},
) {
  const agent = state.agents.find((a) => a.id === agentId)
  if (!agent) return { error: 'Unknown agent' }
  if (!ownsAgent(agent, opts.caller)) return { error: 'Forbidden: not the agent owner' }
  if (agent.vaultAddress) return { error: 'Agent already has an on-chain policy vault', vaultAddress: agent.vaultAddress }

  // Human owner of the vault = a REAL wallet distinct from the server signer/operator,
  // so freeze/override/withdraw are owner-gated on-chain. Prefer an explicit address,
  // then the caller when they signed in with a wallet (SIWE → subject is a 0x addr),
  // then the agent's own (browser-held) wallet. Falls back to the signer only if none.
  const isAddr = (s?: string): s is string => !!s && /^0x[0-9a-fA-F]{40}$/.test(s)
  const ownerAddress = isAddr(opts.ownerAddress)
    ? opts.ownerAddress
    : isAddr(opts.caller)
      ? opts.caller
      : isAddr(agent.walletAddress ?? undefined)
        ? (agent.walletAddress as string)
        : undefined

  const dep = await deployPolicyVault({
    owner: ownerAddress,
    dailyCapUsd: agent.permissions.dailyCapUsd,
    autoApproveUsd: agent.permissions.autoApproveUnderUsd,
  })
  if (!dep.executed) return { error: dep.reason }

  agent.vaultAddress = dep.vault
  agent.vaultExplorer = `${ARC_EXPLORER}/address/${dep.vault}`
  agent.vaultOwner = dep.owner
  agent.vaultOperator = dep.operator
  const separated = dep.owner.toLowerCase() !== dep.operator.toLowerCase()
  pushActivity(
    agent,
    `On-chain policy vault deployed at ${short(dep.vault)} (tx ${short(dep.txHash)})` +
      (separated ? ` — human owner ${short(dep.owner)}, agent operator ${short(dep.operator)}` : ''),
  )

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
    owner: dep.owner,
    operator: dep.operator,
    ownerOperatorSeparated: separated,
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

export type VaultSyncResult = {
  synced: boolean
  reason?: string
  /** True when the on-chain change is owner-signed and the server can't sign it. */
  ownerGated?: boolean
  txs?: { setPolicy?: string; setFrozen?: string }
  /** The limits we wanted on-chain, so an owner can push them from their own wallet. */
  want?: { dailyCapUsd: number; autoApproveUsd: number; allowlistEnabled: boolean; frozen: boolean }
  note?: string
}

/** USDC micro-units, for exact (float-safe) on-chain vs off-chain comparisons. */
const micro = (n: number) => Math.round(n * 1e6)

/**
 * Push an agent's off-chain permissions onto its on-chain AgentSpendPolicy vault, so a
 * limit changed in the UI actually re-enforces on Arc — not only in the server pre-check.
 * setPolicy / setFrozen / setAllowed are owner-only; the server signer can sign them ONLY
 * when it is the vault owner (owner==operator). With the intended owner≠operator separation
 * the human owner must sign the change from their own wallet, so we say that plainly (and
 * return the target limits) instead of letting the chain-enforced policy silently drift from
 * the UI. Diffs against the live on-chain state first, so a change to off-chain-only fields
 * (e.g. agent-to-human) never spends gas. Best-effort: a failure never undoes the off-chain
 * update that already happened.
 */
async function syncVaultPolicy(agent: PlatformAgent): Promise<VaultSyncResult> {
  const vault = agent.vaultAddress
  if (!vault) return { synced: false, reason: 'Agent has no on-chain vault' }
  const p = agent.permissions
  const want = {
    dailyCapUsd: p.dailyCapUsd,
    autoApproveUsd: p.autoApproveUnderUsd,
    allowlistEnabled: p.payeeAllowlist.length > 0,
    frozen: p.frozen,
  }

  // Only write what actually changed on-chain. A read never needs a key.
  let live: Awaited<ReturnType<typeof readPolicyVault>> | null = null
  try { live = await readPolicyVault(vault) } catch { live = null }
  const policyDrift =
    !live ||
    micro(live.dailyCapUsd) !== micro(want.dailyCapUsd) ||
    micro(live.autoApproveUsd) !== micro(want.autoApproveUsd) ||
    live.allowlistEnabled !== want.allowlistEnabled
  const frozenDrift = !live || live.frozen !== want.frozen
  if (!policyDrift && !frozenDrift) return { synced: true, txs: {}, note: 'On-chain vault already matches these limits.' }

  // Owner-gated on-chain: the server can sign owner calls only when owner==operator.
  const serverIsOwner =
    !agent.vaultOwner || !agent.vaultOperator ||
    agent.vaultOwner.toLowerCase() === agent.vaultOperator.toLowerCase()
  if (!serverIsOwner) {
    return {
      synced: false,
      ownerGated: true,
      want,
      reason:
        'On-chain vault limits are owner-signed and this vault is owned by your own wallet ' +
        '(owner≠operator by design). Re-sign setPolicy from the owner wallet to push these limits ' +
        'on-chain; the server holds only the operator key. Off-chain policy is updated meanwhile.',
    }
  }

  try {
    const txs: { setPolicy?: string; setFrozen?: string } = {}
    if (policyDrift) {
      const sp = await policySetPolicy(vault, {
        dailyCapUsd: want.dailyCapUsd, autoApproveUsd: want.autoApproveUsd, allowlistEnabled: want.allowlistEnabled,
      })
      if (!sp.executed) return { synced: false, reason: `Vault setPolicy failed: ${sp.reason}` }
      txs.setPolicy = sp.txHash
    }
    if (frozenDrift) {
      const sf = await policySetFrozen(vault, want.frozen)
      if (sf.executed) txs.setFrozen = sf.txHash
    }
    // Mirror raw-address allowlist entries onto the vault (adds only; best-effort).
    for (const addr of p.payeeAllowlist.filter((x) => /^0x[0-9a-fA-F]{40}$/.test(x))) {
      await policySetAllowed(vault, addr, true).catch(() => {})
    }
    pushActivity(
      agent,
      `On-chain vault policy synced (cap $${want.dailyCapUsd}, ceiling $${want.autoApproveUsd}${want.frozen ? ', frozen' : ''})`,
    )
    return { synced: true, txs }
  } catch (e) {
    return { synced: false, reason: e instanceof Error ? e.message : String(e) }
  }
}

// ── Circle Agent Wallet (hosted, wallet-layer enforcement) ───────────────────────

/**
 * Provision a Circle Agent Wallet (Developer-Controlled EOA on ARC-TESTNET) for an
 * agent — the second, hosted enforcement layer alongside the on-chain vault. Once set,
 * this agent's address payments can settle THROUGH Circle, whose hosted policy engine
 * screens each transfer at the wallet layer (sanctions / allow-block / freeze). Owner-
 * only; credential-gated behind CIRCLE_API_KEY + CIRCLE_ENTITY_SECRET (no-op without).
 */
export async function provisionCircleWallet(
  agentId: string,
  opts: { fund?: boolean; caller?: string } = {},
) {
  const agent = state.agents.find((a) => a.id === agentId)
  if (!agent) return { error: 'Unknown agent' }
  if (!ownsAgent(agent, opts.caller)) return { error: 'Forbidden: not the agent owner' }
  if (agent.circleWalletId)
    return { error: 'Agent already has a Circle Agent Wallet', circleWalletId: agent.circleWalletId }

  const res = await createAgentWallet(
    { name: agent.name, refId: agent.id, fund: opts.fund ?? true },
    process.env,
  )
  if (!res.provisioned) return { error: res.reason }

  agent.circleWalletId = res.walletId
  agent.circleWalletAddress = res.walletAddress
  agent.circleWalletExplorer = res.explorerUrl
  pushActivity(agent, `Circle Agent Wallet provisioned on Arc: ${short(res.walletAddress)}`)
  save(state)
  return {
    circleWalletId: res.walletId,
    circleWalletAddress: res.walletAddress,
    circleWalletExplorer: res.explorerUrl,
    blockchain: res.blockchain,
    funded: res.funded,
  }
}

/** Read an agent's live Circle Agent Wallet state + balances (needs creds). */
export async function getAgentCircleWallet(agentId: string) {
  const agent = state.agents.find((a) => a.id === agentId)
  if (!agent) return { error: 'Unknown agent' }
  if (!agent.circleWalletId) return { circleWalletId: null }
  const live = await readCircleWallet(agent.circleWalletId)
  return { circleWalletId: agent.circleWalletId, circleWalletAddress: agent.circleWalletAddress, ...live }
}

// ── treasury: idle-balance auto-yield into USYC (Circle's yield-bearing token) ────

/** Default working-capital cap: idle balance above this is what auto-yield would deploy. */
const DEFAULT_YIELD_CAP_USD = 25

/**
 * Live treasury view for an agent: real multi-asset balances (USDC/EURC/USYC) read
 * from Arc, the deployable idle amount above the cap, and the projected USYC earnings
 * the owner reviews before authorizing. Read-only, no key. Uses the saved cap if the
 * owner has one, else the query cap, else the default.
 */
export async function getAgentTreasury(
  agentId: string,
  capUsd?: number,
): Promise<{ error: string } | (TreasuryPreview & { autoYieldEnabled: boolean; authorizedAt?: string })> {
  const agent = state.agents.find((a) => a.id === agentId)
  if (!agent) return { error: 'Unknown agent' }
  // The agent's idle stablecoin lives in its own wallet, or in its Circle Agent Wallet
  // when that's the funded one. Read wherever the balance actually is.
  const address = agent.walletAddress ?? agent.circleWalletAddress
  if (!address) return { error: 'Agent has no wallet yet; create one or provision a Circle wallet first' }
  const cap = capUsd ?? agent.treasury?.capUsd ?? DEFAULT_YIELD_CAP_USD
  const preview = await previewTreasury(address, cap)
  return { ...preview, autoYieldEnabled: agent.treasury?.autoYieldEnabled ?? false, authorizedAt: agent.treasury?.authorizedAt }
}

/**
 * Owner authorizes auto-yield at a working-capital cap: persists the authorization
 * (enabled + cap) and returns the on-chain USYC deployment plan. The USDC->USYC mint is
 * gated on USYC allowlisting (like every other write here); the authorization + cap are
 * real state either way. Owner-only.
 */
export async function startAgentAutoYield(
  agentId: string,
  capUsd: number,
  caller?: string,
): Promise<{ error: string } | { treasury: PlatformAgent['treasury']; execution: TreasuryExecution }> {
  const agent = state.agents.find((a) => a.id === agentId)
  if (!agent) return { error: 'Unknown agent' }
  if (!ownsAgent(agent, caller)) return { error: 'Forbidden: not the agent owner' }
  const address = agent.walletAddress ?? agent.circleWalletAddress
  if (!address) return { error: 'Agent has no wallet yet; create one or provision a Circle wallet first' }
  const cap = Math.max(0, capUsd)

  const execution = await startAutoYield(address, cap)
  agent.treasury = { autoYieldEnabled: true, capUsd: cap, authorizedAt: new Date().toISOString() }
  pushActivity(
    agent,
    `Auto-yield authorized: idle over $${cap} earmarked for USYC` +
      (execution.deployableUsd > 0 ? ` (~$${execution.projection.monthlyUsd}/mo projected on $${execution.deployableUsd})` : ''),
  )
  save(state)
  return { treasury: agent.treasury, execution }
}

/** Owner turns auto-yield off (leaves any USYC position untouched; just stops earmarking). */
export function stopAgentAutoYield(agentId: string, caller?: string): { error: string } | { treasury: PlatformAgent['treasury'] } {
  const agent = state.agents.find((a) => a.id === agentId)
  if (!agent) return { error: 'Unknown agent' }
  if (!ownsAgent(agent, caller)) return { error: 'Forbidden: not the agent owner' }
  agent.treasury = { autoYieldEnabled: false, capUsd: agent.treasury?.capUsd ?? DEFAULT_YIELD_CAP_USD, authorizedAt: agent.treasury?.authorizedAt }
  pushActivity(agent, 'Auto-yield turned off by a human')
  save(state)
  return { treasury: agent.treasury }
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

export async function updateAgentPermissions(
  agentId: string,
  partial: Partial<Permissions>,
  caller?: string,
): Promise<(PlatformAgent & { vaultSync?: VaultSyncResult }) | { error: string }> {
  const agent = state.agents.find((a) => a.id === agentId)
  if (!agent) return { error: 'Unknown agent' }
  if (!ownsAgent(agent, caller)) return { error: 'Forbidden: not the agent owner' }
  agent.permissions = { ...agent.permissions, ...partial }
  pushActivity(agent, 'Permissions updated by a human')

  // If the agent has an on-chain policy vault, push the new limits to it so the
  // chain-enforced policy tracks the UI instead of staying frozen at deploy time.
  const vaultSync = agent.vaultAddress ? await syncVaultPolicy(agent) : undefined
  save(state)
  return vaultSync ? { ...agent, vaultSync } : agent
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
 * Resolve an instruction payee to a real Arc address to settle to, or null.
 *  - a 0x… address → itself
 *  - `agent://<idOrName>` (or a bare agent id/name) → THAT agent's wallet address,
 *    so agent-to-agent payments settle on-chain instead of falling back to simulated.
 */
function resolvePayeeAddress(payee: string): string | null {
  if (/^0x[0-9a-fA-F]{40}$/.test(payee)) return payee
  const key = payee.replace(/^agent:\/\//i, '').trim()
  if (!key) return null
  const target = state.agents.find((a) => a.id === key || a.name.toLowerCase() === key.toLowerCase())
  return target?.walletAddress && /^0x[0-9a-fA-F]{40}$/.test(target.walletAddress) ? target.walletAddress : null
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
  // Where this actually settles on-chain: a 0x… payee, or an agent:// payee
  // resolved to that agent's wallet. null → nothing to send to → simulated.
  const settleTo = resolvePayeeAddress(ix.payee)

  // On-chain policy vault: the chain enforces the policy. Agent-initiated
  // (auto-approved) payments go through pay(); human-approved ones through
  // ownerPay() (override). A policy revert is an authoritative rejection; an
  // infra error falls through to direct settlement below.
  // A human override uses the owner-only ownerPay(), which the SERVER can only sign
  // when the vault owner is the server signer (== operator). When owner is the human's
  // own wallet (the intended separation), the server can't sign as owner, so a human
  // override can't settle through the vault here — it falls through to direct settlement
  // below (an owner-signed ownerPay would come from the human's wallet client-side).
  const serverCanOwnerPay =
    !agent?.vaultOwner || !agent?.vaultOperator || agent.vaultOwner.toLowerCase() === agent.vaultOperator.toLowerCase()
  if (settleTo && agent?.vaultAddress && !(ix.status === 'approved' && !serverCanOwnerPay)) {
    const humanApproved = ix.status === 'approved'
    const res = humanApproved
      ? await policyOwnerPay(agent.vaultAddress, settleTo, total)
      : await policyPay(agent.vaultAddress, settleTo, total)
    if (res.executed) {
      ix.status = 'executed_onchain'
      ix.txHash = res.txHash
      ix.explorerUrl = res.explorerUrl
      ix.enforcedBy = 'onchain-vault'
      ix.policyNote = `Settled ${fmt(total)} USDC through the on-chain policy vault (${humanApproved ? 'human override' : 'agent, within policy'}).`
      pushActivity(agent, `On-chain vault settled ${fmt(total)} USDC to ${short(settleTo)} (tx ${short(res.txHash)})`)
      save(state)
      return ix
    }
    if (res.reverted && VAULT_POLICY_ERRORS.has(res.reason)) {
      ix.status = 'pending_approval'
      ix.enforcedBy = 'onchain-vault'
      ix.policyNote = `On-chain policy vault rejected this (${res.reason}); a human must intervene.`
      pushActivity(agent, `On-chain vault rejected ${fmt(total)} USDC to ${short(settleTo)}: ${res.reason}`)
      save(state)
      return ix
    }
    // Not a policy revert (no key / infra error) — fall through to direct settlement.
  }

  // Circle Agent Wallet: the agent's USDC lives in a Circle-managed wallet whose
  // hosted policy engine screens every transfer at the wallet layer (sanctions /
  // allow-block / freeze). A screening DENY is an authoritative rejection (like a
  // vault revert); no creds / infra / timeout falls through to direct settlement.
  // Vault-first by design: an agent with a vault settles there; this runs when the
  // agent has a Circle wallet (and, as a resilience bonus, if the vault infra-failed).
  if (settleTo && agent?.circleWalletId) {
    const res = await circlePay(agent.circleWalletId, settleTo, total)
    if (res.executed) {
      ix.status = 'executed_onchain'
      ix.txHash = res.txHash
      ix.explorerUrl = res.explorerUrl
      ix.enforcedBy = 'circle-agent-stack'
      ix.policyNote = `Settled ${fmt(total)} USDC through the Circle Agent Wallet (hosted policy screened + approved).`
      pushActivity(agent, `Circle Agent Wallet settled ${fmt(total)} USDC to ${short(settleTo)} (tx ${short(res.txHash)})`)
      save(state)
      return ix
    }
    if (res.rejected) {
      ix.status = 'pending_approval'
      ix.enforcedBy = 'circle-agent-stack'
      ix.policyNote = `Circle's hosted policy rejected this (${res.reason}); a human must intervene.`
      pushActivity(agent, `Circle Agent Wallet rejected ${fmt(total)} USDC to ${short(settleTo)}: ${res.reason}`)
      save(state)
      return ix
    }
    // Not a policy rejection (no creds / infra) — fall through to direct settlement.
  }

  // Direct settlement when we have a resolved Arc address and a signer is configured.
  if (settleTo) {
    const res = await payUsdcOnchain(settleTo, total)
    if (res.executed) {
      ix.status = 'executed_onchain'
      ix.txHash = res.txHash
      ix.explorerUrl = res.explorerUrl
      ix.enforcedBy = 'server'
      ix.policyNote = `Settled ${fmt(total)} USDC on Arc.`
      if (agent) pushActivity(agent, `Settled ${total.toFixed(4)} USDC on Arc to ${short(settleTo)} (tx ${short(res.txHash)})`)
      save(state)
      return ix
    }
    ix.policyNote = 'No signer configured; settlement simulated.'
  }

  ix.status = 'executed_simulated'
  if (!settleTo) ix.policyNote = 'Executed as a testnet simulation (payee has no Arc address to settle to).'
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
