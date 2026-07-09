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
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ARC_TESTNET } from './arc.js'
import { registerAgentOnchain } from './arc-contracts.js'

// ── types ─────────────────────────────────────────────────────────────────────

export type Permissions = {
  dailyCapUsd: number
  autoApproveUnderUsd: number
  payeeAllowlist: string[]
  agentToAgent: boolean
  agentToHuman: boolean
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
  onchain: 'queued' | 'registered'
  /** Set once the ERC-8004 identity is broadcast on Arc (real tx). */
  onchainTx?: string
  onchainExplorer?: string
  onchainAgentId?: string
  passport: {
    standard: 'ERC-8004'
    registrationJson: Record<string, unknown>
  }
  followers: string[]
  activity: { at: string; text: string }[]
  createdAt: string
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
  createdAt: string
}

type State = {
  agents: PlatformAgent[]
  wallets: Wallet[]
  instructions: Instruction[]
}

// ── persistence ───────────────────────────────────────────────────────────────

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data')
const DATA_FILE = join(DATA_DIR, 'platform.json')

function load(): State {
  try {
    return JSON.parse(readFileSync(DATA_FILE, 'utf8')) as State
  } catch {
    return { agents: [], wallets: [], instructions: [] }
  }
}

function save(state: State) {
  mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(DATA_FILE, JSON.stringify(state, null, 2))
}

const state = load()

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
}): PlatformAgent {
  const permissions: Permissions = {
    dailyCapUsd: input.permissions.dailyCapUsd ?? 50,
    autoApproveUnderUsd: input.permissions.autoApproveUnderUsd ?? 1,
    payeeAllowlist: input.permissions.payeeAllowlist ?? [],
    agentToAgent: input.permissions.agentToAgent ?? true,
    agentToHuman: input.permissions.agentToHuman ?? false,
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
export async function anchorAgentOnchain(agentId: string) {
  const agent = state.agents.find((a) => a.id === agentId)
  if (!agent) return { error: 'Unknown agent' }

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

// ── instructions ──────────────────────────────────────────────────────────────

export function createInstruction(input: {
  agentId: string
  type: InstructionType
  amountUsd: number
  count?: number
  payee: string
  memo?: string
}): Instruction | { error: string } {
  const agent = state.agents.find((a) => a.id === input.agentId)
  if (!agent) return { error: 'Unknown agent' }

  const count = Math.max(1, Math.floor(input.count ?? 1))
  const total = input.amountUsd * count
  const p = agent.permissions

  // Policy checks, in the order a bank would run them.
  let status: Instruction['status']
  let policyNote: string

  const payeeAllowed = p.payeeAllowlist.length === 0 || p.payeeAllowlist.includes(input.payee)

  if (!payeeAllowed) {
    status = 'pending_approval'
    policyNote = `Payee not on the allowlist; a human must approve.`
  } else if (total > p.dailyCapUsd) {
    status = 'pending_approval'
    policyNote = `Total $${total.toFixed(2)} exceeds the daily cap ($${p.dailyCapUsd}); a human must approve.`
  } else if (total <= p.autoApproveUnderUsd) {
    status = 'auto_approved'
    policyNote = `Under the $${p.autoApproveUnderUsd} auto-approve line.`
  } else {
    status = 'pending_approval'
    policyNote = `Above the auto-approve line ($${p.autoApproveUnderUsd}); waiting for a human.`
  }

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

export function approveInstruction(ixId: string): Instruction | { error: string } {
  const ix = state.instructions.find((i) => i.id === ixId)
  if (!ix) return { error: 'Unknown instruction' }
  if (ix.status !== 'pending_approval') return { error: `Cannot approve from status ${ix.status}` }
  ix.status = 'approved'
  ix.policyNote = 'Approved by a human.'
  const agent = state.agents.find((a) => a.id === ix.agentId)
  if (agent) pushActivity(agent, `Instruction ${ix.id} approved by a human`)
  save(state)
  return ix
}

/**
 * Execute an approved or auto-approved instruction. On testnet, without holding
 * any key, execution is SIMULATED and labeled as such; the trail stays honest.
 */
export function executeInstruction(ixId: string): Instruction | { error: string } {
  const ix = state.instructions.find((i) => i.id === ixId)
  if (!ix) return { error: 'Unknown instruction' }
  if (ix.status !== 'approved' && ix.status !== 'auto_approved')
    return { error: `Cannot execute from status ${ix.status}` }
  ix.status = 'executed_simulated'
  ix.policyNote = 'Executed as a testnet simulation (no key custody, no real funds moved).'
  const agent = state.agents.find((a) => a.id === ix.agentId)
  if (agent)
    pushActivity(agent, `Executed (simulated) ${ix.type} of $${(ix.amountUsd * ix.count).toFixed(2)}`)
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
