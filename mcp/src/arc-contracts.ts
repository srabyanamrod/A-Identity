/**
 * Real Arc testnet contracts: ERC-8004 (agent identity/reputation/validation)
 * and ERC-8183 (agentic-commerce job escrow). Addresses and function signatures
 * are verbatim from docs.arc.io tutorials.
 *
 * Reads run live with no key. Writes are env-gated behind ARC_SIGNER_KEY and stay
 * human-on-the-loop: nothing broadcasts unless a key is present and the caller
 * explicitly asks to execute. Gas is paid in USDC (~0.006 USDC per tx).
 */
import { AgentSpendPolicyAbi, AgentSpendPolicyBytecode } from './contracts/AgentSpendPolicy.js'

export const ARC_RPC = 'https://rpc.testnet.arc.network'
export const ARC_EXPLORER = 'https://testnet.arcscan.app'

/**
 * Arc testnet RPC endpoints, primary first. We build a viem `fallback` transport over
 * these so a single flaky endpoint (the "RPC Request failed" the escrow demo hit) rolls
 * over to the next one instead of failing the whole on-chain call. Override the primary
 * with ARC_RPC_URL if needed.
 */
export const ARC_RPCS: string[] = [
  process.env.ARC_RPC_URL || ARC_RPC,
  'https://rpc.blockdaemon.testnet.arc.network',
  'https://rpc.drpc.testnet.arc.network',
  'https://rpc.quicknode.testnet.arc.network',
].filter((v, i, a) => v && a.indexOf(v) === i)

/** Deployed on Arc Testnet (docs.arc.io). */
export const CONTRACTS = {
  identityRegistry: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
  reputationRegistry: '0x8004B663056A597Dffe9eCcC1965A193B7388713',
  validationRegistry: '0x8004Cb1BF31DAf7788923b405b754f57acEB4272',
  agenticCommerce: '0x0747EEf0706327138c69792bF28Cd525089e4583',
  usdc: '0x3600000000000000000000000000000000000000',
} as const

// ── ABIs (minimal, verbatim signatures) ───────────────────────────────────────

const IDENTITY_ABI = [
  { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'totalSupply', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'tokenURI', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'ownerOf', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'register', stateMutability: 'nonpayable', inputs: [{ name: 'metadataURI', type: 'string' }], outputs: [{ type: 'uint256' }] },
  { type: 'event', name: 'Transfer', inputs: [
    { name: 'from', type: 'address', indexed: true },
    { name: 'to', type: 'address', indexed: true },
    { name: 'tokenId', type: 'uint256', indexed: true },
  ] },
] as const

const ERC20_ABI = [
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
] as const

const COMMERCE_ABI = [
  { type: 'function', name: 'createJob', stateMutability: 'nonpayable', inputs: [
    { name: 'provider', type: 'address' },
    { name: 'evaluator', type: 'address' },
    { name: 'expiredAt', type: 'uint256' },
    { name: 'description', type: 'string' },
    { name: 'hook', type: 'address' },
  ], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'setBudget', stateMutability: 'nonpayable', inputs: [
    { name: 'jobId', type: 'uint256' }, { name: 'amount', type: 'uint256' }, { name: 'optParams', type: 'bytes' },
  ], outputs: [] },
  { type: 'function', name: 'fund', stateMutability: 'nonpayable', inputs: [
    { name: 'jobId', type: 'uint256' }, { name: 'optParams', type: 'bytes' },
  ], outputs: [] },
  { type: 'function', name: 'submit', stateMutability: 'nonpayable', inputs: [
    { name: 'jobId', type: 'uint256' }, { name: 'deliverable', type: 'bytes32' }, { name: 'optParams', type: 'bytes' },
  ], outputs: [] },
  { type: 'function', name: 'complete', stateMutability: 'nonpayable', inputs: [
    { name: 'jobId', type: 'uint256' }, { name: 'reason', type: 'bytes32' }, { name: 'optParams', type: 'bytes' },
  ], outputs: [] },
  { type: 'function', name: 'getJob', stateMutability: 'view', inputs: [{ name: 'jobId', type: 'uint256' }], outputs: [
    { type: 'tuple', components: [
      { name: 'id', type: 'uint256' }, { name: 'client', type: 'address' }, { name: 'provider', type: 'address' },
      { name: 'evaluator', type: 'address' }, { name: 'description', type: 'string' }, { name: 'budget', type: 'uint256' },
      { name: 'expiredAt', type: 'uint256' }, { name: 'status', type: 'uint8' }, { name: 'hook', type: 'address' },
    ] },
  ] },
  { type: 'event', name: 'JobCreated', inputs: [
    { name: 'jobId', type: 'uint256', indexed: true }, { name: 'client', type: 'address', indexed: true },
    { name: 'provider', type: 'address', indexed: true }, { name: 'evaluator', type: 'address', indexed: false },
    { name: 'expiredAt', type: 'uint256', indexed: false }, { name: 'hook', type: 'address', indexed: false },
  ] },
] as const

/** ERC-8183 job status enum → label. */
const JOB_STATUS = ['Open', 'Funded', 'Submitted', 'Completed', 'Rejected', 'Expired'] as const

// ── clients ────────────────────────────────────────────────────────────────────

/** A fallback transport over every Arc RPC, so one flaky endpoint rolls to the next
 *  instead of failing the call. Each endpoint retries a couple of times on its own. */
async function arcTransport() {
  const { http, fallback } = await import('viem')
  return fallback(
    ARC_RPCS.map((url) => http(url, { timeout: 8000, retryCount: 2, retryDelay: 400 })),
    { rank: false },
  )
}

async function publicClient() {
  const { createPublicClient } = await import('viem')
  return createPublicClient({ transport: await arcTransport() })
}

/** Present only when ARC_SIGNER_KEY is set. Human-on-the-loop lives one level up. */
async function walletClient(env: NodeJS.ProcessEnv) {
  const key = env.ARC_SIGNER_KEY
  if (!key) return null
  const { createWalletClient, defineChain } = await import('viem')
  const { privateKeyToAccount } = await import('viem/accounts')
  const chain = defineChain({
    id: 5042002,
    name: 'Arc Testnet',
    nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 18 },
    rpcUrls: { default: { http: ARC_RPCS } },
  })
  const account = privateKeyToAccount(key as `0x${string}`)
  return { client: createWalletClient({ account, chain, transport: await arcTransport() }), account }
}

const tx = (h: string) => `${ARC_EXPLORER}/tx/${h}`

// ── live reads (no key) ─────────────────────────────────────────────────────────

/** Read the real ERC-8004 registry and ERC-8183 commerce contracts, live. */
export async function readArcContracts() {
  const out = {
    network: 'arc-testnet',
    chainId: 5042002,
    contracts: CONTRACTS,
    explorer: ARC_EXPLORER,
    identity: {} as Record<string, unknown>,
    usdc: {} as Record<string, unknown>,
    reachable: false,
    checkedAt: new Date().toISOString(),
  }
  try {
    const client = await publicClient()
    // This registry is not enumerable (totalSupply reverts) and token ids are
    // non-sequential, so we don't report a registered-agents count from the
    // contract — better to omit it than to surface a silently-null field.
    const [name, symbol] = await Promise.allSettled([
      client.readContract({ address: CONTRACTS.identityRegistry, abi: IDENTITY_ABI, functionName: 'name' }),
      client.readContract({ address: CONTRACTS.identityRegistry, abi: IDENTITY_ABI, functionName: 'symbol' }),
    ])
    out.identity = {
      address: CONTRACTS.identityRegistry,
      name: name.status === 'fulfilled' ? name.value : null,
      symbol: symbol.status === 'fulfilled' ? symbol.value : null,
    }
    const [usym, udec] = await Promise.allSettled([
      client.readContract({ address: CONTRACTS.usdc, abi: ERC20_ABI, functionName: 'symbol' }),
      client.readContract({ address: CONTRACTS.usdc, abi: ERC20_ABI, functionName: 'decimals' }),
    ])
    out.usdc = {
      address: CONTRACTS.usdc,
      symbol: usym.status === 'fulfilled' ? usym.value : 'USDC',
      decimals: udec.status === 'fulfilled' ? (udec.value as number) : null,
    }
    out.reachable = true
    return out
  } catch (err) {
    return { ...out, note: err instanceof Error ? err.message : String(err) }
  }
}

// ── writes (env-gated, human-on-the-loop) ────────────────────────────────────────

type Prepared = { executed: false; contract: string; function: string; args: unknown[]; reason: string }
type Executed = { executed: true; txHash: string; explorerUrl: string; agentId?: string }

/**
 * Register an agent on the real ERC-8004 IdentityRegistry. Without a signer key
 * it returns the exact prepared call; with one, it broadcasts and returns the
 * tx hash plus the minted agent id (parsed from the Transfer event).
 */
export async function registerAgentOnchain(
  metadataUri: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<Prepared | Executed> {
  const signer = await walletClient(env)
  if (!signer) {
    return {
      executed: false,
      contract: CONTRACTS.identityRegistry,
      function: 'register(string metadataURI)',
      args: [metadataUri],
      reason:
        'No ARC_SIGNER_KEY set. Fund a wallet at faucet.circle.com and export ARC_SIGNER_KEY to broadcast this for real. This is the exact call that will be made.',
    }
  }
  const { parseEventLogs } = await import('viem')
  const client = await publicClient()
  const hash = await signer.client.writeContract({
    address: CONTRACTS.identityRegistry,
    abi: IDENTITY_ABI,
    functionName: 'register',
    args: [metadataUri],
  })
  const receipt = await client.waitForTransactionReceipt({ hash })
  const logs = parseEventLogs({ abi: IDENTITY_ABI, eventName: 'Transfer', logs: receipt.logs })
  const agentId = logs[0] ? (logs[0].args as { tokenId: bigint }).tokenId.toString() : undefined
  return { executed: true, txHash: hash, explorerUrl: tx(hash), agentId }
}

/**
 * Create an ERC-8183 job (escrow-based agentic commerce). Prepared without a
 * key; broadcast with one. This is the payment/escrow rail: create -> fund ->
 * submit -> complete, settled in USDC.
 */
export async function createJobOnchain(
  input: { provider: string; evaluator: string; description: string; expiresInHours?: number },
  env: NodeJS.ProcessEnv = process.env,
): Promise<Prepared | Executed> {
  const expiredAt = BigInt(Math.floor(Date.now() / 1000) + (input.expiresInHours ?? 24) * 3600)
  const args = [input.provider, input.evaluator, expiredAt, input.description, '0x0000000000000000000000000000000000000000']
  const signer = await walletClient(env)
  if (!signer) {
    return {
      executed: false,
      contract: CONTRACTS.agenticCommerce,
      function: 'createJob(address provider, address evaluator, uint256 expiredAt, string description, address hook)',
      args: args.map((a) => (typeof a === 'bigint' ? a.toString() : a)),
      reason:
        'No ARC_SIGNER_KEY set. This is the exact ERC-8183 createJob call. Fund a wallet and export the key to broadcast.',
    }
  }
  const client = await publicClient()
  const hash = await signer.client.writeContract({
    address: CONTRACTS.agenticCommerce,
    abi: COMMERCE_ABI,
    functionName: 'createJob',
    args: args as never,
  })
  await client.waitForTransactionReceipt({ hash })
  return { executed: true, txHash: hash, explorerUrl: tx(hash) }
}

/**
 * Run the FULL ERC-8183 escrow lifecycle in one shot, with the server signer acting
 * as client + provider + evaluator (roles are enforced by address; a single testnet
 * key drives them all). Six real txs: createJob → setBudget → approve(USDC) → fund →
 * submit → complete, ending with the job settled (Completed). Env-gated; prepared
 * without a key. Returns the on-chain trail (jobId + a tx per step + final status).
 */
export async function runEscrowJobDemo(
  input: { budgetUsd?: number; description?: string } = {},
  env: NodeJS.ProcessEnv = process.env,
): Promise<
  | { executed: false; reason: string; contract: string; lifecycle: string[] }
  | {
      executed: true
      jobId: string
      budgetUsd: number
      steps: { step: string; txHash: string; explorerUrl: string }[]
      status: string
      failedAt?: string
      reason?: string
    }
> {
  const budgetUsd = input.budgetUsd ?? 0.05
  const description =
    input.description ??
    'A-Identity ERC-8183 escrow demo: an agent hires an agent, USDC is held in escrow, released on delivery.'
  const lifecycle = ['createJob', 'setBudget', 'approve(USDC)', 'fund', 'submit', 'complete']
  const signer = await walletClient(env)
  if (!signer) {
    return {
      executed: false,
      reason: 'No ARC_SIGNER_KEY set. With a funded key this broadcasts the full ERC-8183 escrow lifecycle (6 real txs).',
      contract: CONTRACTS.agenticCommerce,
      lifecycle,
    }
  }
  const { keccak256, toHex, parseEventLogs } = await import('viem')
  const client = await publicClient()
  const me = signer.account.address
  const budget = BigInt(Math.round(budgetUsd * 1e6)) // USDC ERC-20 interface = 6 decimals
  const zero = '0x0000000000000000000000000000000000000000' as const
  const empty = '0x' as const
  const steps: { step: string; txHash: string; explorerUrl: string }[] = []
  const record = async (step: string, hash: `0x${string}`) => {
    await client.waitForTransactionReceipt({ hash })
    steps.push({ step, txHash: hash, explorerUrl: tx(hash) })
  }

  try {
    // 1) createJob — client=provider=evaluator=signer; job opens
    const expiredAt = BigInt(Math.floor(Date.now() / 1000) + 3600)
    const createHash = await signer.client.writeContract({
      address: CONTRACTS.agenticCommerce, abi: COMMERCE_ABI, functionName: 'createJob',
      args: [me, me, expiredAt, description, zero],
    })
    const receipt = await client.waitForTransactionReceipt({ hash: createHash })
    steps.push({ step: 'createJob', txHash: createHash, explorerUrl: tx(createHash) })
    const logs = parseEventLogs({ abi: COMMERCE_ABI, eventName: 'JobCreated', logs: receipt.logs })
    const jobId = (logs[0]?.args as { jobId?: bigint })?.jobId
    if (jobId === undefined)
      return { executed: true, jobId: '?', budgetUsd, steps, status: 'Unknown', failedAt: 'createJob', reason: 'could not parse jobId from JobCreated' }

    // 2) setBudget (provider) — 3) approve USDC (client) — 4) fund → escrow (client)
    await record('setBudget', await signer.client.writeContract({ address: CONTRACTS.agenticCommerce, abi: COMMERCE_ABI, functionName: 'setBudget', args: [jobId, budget, empty] }))
    await record('approve(USDC)', await signer.client.writeContract({ address: CONTRACTS.usdc, abi: ERC20_ABI, functionName: 'approve', args: [CONTRACTS.agenticCommerce, budget] }))
    await record('fund', await signer.client.writeContract({ address: CONTRACTS.agenticCommerce, abi: COMMERCE_ABI, functionName: 'fund', args: [jobId, empty] }))
    // 5) submit (provider delivers) — 6) complete (evaluator approves, USDC settles)
    await record('submit', await signer.client.writeContract({ address: CONTRACTS.agenticCommerce, abi: COMMERCE_ABI, functionName: 'submit', args: [jobId, keccak256(toHex(`a-identity:deliverable:${jobId}`)), empty] }))
    await record('complete', await signer.client.writeContract({ address: CONTRACTS.agenticCommerce, abi: COMMERCE_ABI, functionName: 'complete', args: [jobId, keccak256(toHex(`a-identity:approved:${jobId}`)), empty] }))

    const job = (await client.readContract({ address: CONTRACTS.agenticCommerce, abi: COMMERCE_ABI, functionName: 'getJob', args: [jobId] })) as { status: number }
    return { executed: true, jobId: jobId.toString(), budgetUsd, steps, status: JOB_STATUS[Number(job.status)] ?? String(job.status) }
  } catch (err) {
    return { executed: true, jobId: steps.length ? '(partial)' : '?', budgetUsd, steps, status: 'Reverted', failedAt: lifecycle[steps.length] ?? '?', reason: await revertReason(err) }
  }
}

/**
 * Settle a payment in real USDC on Arc: an ERC-20 transfer from the signer to the
 * payee (USDC is 6 decimals). Prepared without a key; broadcast with one. This is
 * the actual value-moving rail behind an executed instruction.
 */
export async function payUsdcOnchain(
  to: string,
  amountUsd: number,
  env: NodeJS.ProcessEnv = process.env,
): Promise<Prepared | Executed> {
  const amount = BigInt(Math.round(amountUsd * 1e6))
  const signer = await walletClient(env)
  if (!signer) {
    return {
      executed: false,
      contract: CONTRACTS.usdc,
      function: 'transfer(address to, uint256 amount)',
      args: [to, amount.toString()],
      reason: 'No ARC_SIGNER_KEY set. Fund a wallet and export the key to move real USDC.',
    }
  }
  const client = await publicClient()
  const hash = await signer.client.writeContract({
    address: CONTRACTS.usdc,
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [to as `0x${string}`, amount],
  })
  await client.waitForTransactionReceipt({ hash })
  return { executed: true, txHash: hash, explorerUrl: tx(hash) }
}

// ── on-chain spend policy vault (AgentSpendPolicy) ───────────────────────────
//
// A per-agent USDC wallet whose spend policy is enforced by the contract, not by
// our server: an agent `pay()` that breaks the daily cap / auto-approve ceiling /
// allowlist / freeze reverts on Arc, verifiably. The server engine stays as the
// pre-check and fallback; this is the on-chain source of truth. 6-decimal units.

const NO_KEY = 'No ARC_SIGNER_KEY set. Fund a wallet and export the key to broadcast on-chain.'
const usdcUnits = (amountUsd: number) => BigInt(Math.round(amountUsd * 1e6))
const fromUnits = (v: bigint) => Number(v) / 1e6
const addressUrl = (a: string) => `${ARC_EXPLORER}/address/${a}`

type VaultDeployed = { executed: true; vault: string; owner: string; operator: string; txHash: string; explorerUrl: string }
type VaultTx = { executed: true; txHash: string; explorerUrl: string }
type VaultReverted = { executed: false; reverted: true; reason: string }
type VaultNoKey = { executed: false; reverted: false; reason: string }
type VaultResult = VaultTx | VaultReverted | VaultNoKey

/** Decode a viem contract revert into the Solidity error name (e.g. "AboveAutoApprove"). */
async function revertReason(err: unknown): Promise<string> {
  const { BaseError, ContractFunctionRevertedError } = await import('viem')
  if (err instanceof BaseError) {
    const rev = err.walk((e) => e instanceof ContractFunctionRevertedError)
    if (rev instanceof ContractFunctionRevertedError) {
      return rev.data?.errorName ?? rev.reason ?? rev.shortMessage
    }
    return err.shortMessage
  }
  return err instanceof Error ? err.message : String(err)
}

/**
 * Deploy an AgentSpendPolicy vault for an agent. The `operator` (the agent's signer
 * that calls pay()) defaults to the server signer. The human `owner` (who freezes /
 * overrides / withdraws) should be a DIFFERENT address — pass the agent owner's real
 * wallet so the on-chain owner≠operator separation is genuine and verifiable on
 * arcscan. Both fall back to the signer only when nothing is supplied. Returns the
 * deployed vault + the owner/operator it was constructed with.
 */
export async function deployPolicyVault(
  input: { owner?: string; operator?: string; dailyCapUsd: number; autoApproveUsd: number },
  env: NodeJS.ProcessEnv = process.env,
): Promise<VaultDeployed | VaultNoKey> {
  const signer = await walletClient(env)
  if (!signer) return { executed: false, reverted: false, reason: NO_KEY }
  const owner = (input.owner ?? signer.account.address) as `0x${string}`
  const operator = (input.operator ?? signer.account.address) as `0x${string}`
  const client = await publicClient()
  const hash = await signer.client.deployContract({
    abi: AgentSpendPolicyAbi,
    bytecode: AgentSpendPolicyBytecode,
    args: [owner, operator, CONTRACTS.usdc, usdcUnits(input.dailyCapUsd), usdcUnits(input.autoApproveUsd)],
  })
  const receipt = await client.waitForTransactionReceipt({ hash })
  return { executed: true, vault: receipt.contractAddress as string, owner, operator, txHash: hash, explorerUrl: tx(hash) }
}

/** Simulate then broadcast a vault write; on a policy reject, return the on-chain
 * revert reason without spending gas. Shared by pay/ownerPay/setters. */
async function vaultWrite(
  vault: string,
  functionName: string,
  args: readonly unknown[],
  env: NodeJS.ProcessEnv,
): Promise<VaultResult> {
  const signer = await walletClient(env)
  if (!signer) return { executed: false, reverted: false, reason: NO_KEY }
  const client = await publicClient()
  try {
    const { request } = await client.simulateContract({
      address: vault as `0x${string}`,
      abi: AgentSpendPolicyAbi,
      functionName: functionName as never,
      args: args as never,
      account: signer.account,
    })
    const hash = await signer.client.writeContract(request as never)
    await client.waitForTransactionReceipt({ hash })
    return { executed: true, txHash: hash, explorerUrl: tx(hash) }
  } catch (err) {
    return { executed: false, reverted: true, reason: await revertReason(err) }
  }
}

/** Agent-initiated payment, enforced on-chain. Reverts (with reason) if a gate fails. */
export const policyPay = (vault: string, to: string, amountUsd: number, env: NodeJS.ProcessEnv = process.env) =>
  vaultWrite(vault, 'pay', [to as `0x${string}`, usdcUnits(amountUsd)], env)

/** Owner settles a human-approved payment (bypasses ceiling/allowlist/freeze). */
export const policyOwnerPay = (vault: string, to: string, amountUsd: number, env: NodeJS.ProcessEnv = process.env) =>
  vaultWrite(vault, 'ownerPay', [to as `0x${string}`, usdcUnits(amountUsd)], env)

/** Owner updates the on-chain policy (cap, auto-approve ceiling, allowlist flag). */
export const policySetPolicy = (
  vault: string,
  input: { dailyCapUsd: number; autoApproveUsd: number; allowlistEnabled: boolean },
  env: NodeJS.ProcessEnv = process.env,
) => vaultWrite(vault, 'setPolicy', [usdcUnits(input.dailyCapUsd), usdcUnits(input.autoApproveUsd), input.allowlistEnabled], env)

/** Owner freezes/unfreezes all agent spending. */
export const policySetFrozen = (vault: string, frozen: boolean, env: NodeJS.ProcessEnv = process.env) =>
  vaultWrite(vault, 'setFrozen', [frozen], env)

/** Owner adds/removes a payee from the on-chain allowlist. */
export const policySetAllowed = (vault: string, payee: string, ok: boolean, env: NodeJS.ProcessEnv = process.env) =>
  vaultWrite(vault, 'setAllowed', [payee as `0x${string}`, ok], env)

/** Owner withdraws USDC from the vault. */
export const policyWithdraw = (vault: string, to: string, amountUsd: number, env: NodeJS.ProcessEnv = process.env) =>
  vaultWrite(vault, 'withdraw', [to as `0x${string}`, usdcUnits(amountUsd)], env)

/** Read the live on-chain policy + balance of a vault (no key needed). */
export async function readPolicyVault(vault: string) {
  const client = await publicClient()
  const read = (functionName: string, args: readonly unknown[] = []) =>
    client.readContract({ address: vault as `0x${string}`, abi: AgentSpendPolicyAbi, functionName: functionName as never, args: args as never })
  const [owner, operator, dailyCap, autoApproveMax, frozen, allowlistEnabled, spentToday, balance] = await Promise.all([
    read('owner'), read('operator'), read('dailyCap'), read('autoApproveMax'),
    read('frozen'), read('allowlistEnabled'), read('spentToday'), read('balance'),
  ])
  return {
    vault,
    owner: owner as string,
    operator: operator as string,
    dailyCapUsd: fromUnits(dailyCap as bigint),
    autoApproveUsd: fromUnits(autoApproveMax as bigint),
    frozen: frozen as boolean,
    allowlistEnabled: allowlistEnabled as boolean,
    spentTodayUsd: fromUnits(spentToday as bigint),
    balanceUsd: fromUnits(balance as bigint),
    explorer: addressUrl(vault),
  }
}

// ── KYA attestation: ERC-8004 ValidationRegistry ─────────────────────────────────
//
// After an agent proves control of its wallet (off-chain signature), we anchor that
// result on Arc's real ERC-8004 ValidationRegistry: our signer (which owns the agent's
// ERC-8004 id) opens a validationRequest naming itself as validator, then answers it
// with response=100, tag "kya". This is an operator/wallet-proof attestation — publicly
// readable via getValidationStatus/getSummary — NOT independent third-party validation.
// ABI recovered + selector-verified against the live implementation behind the proxy.

const ZERO_HASH = ('0x' + '0'.repeat(64)) as `0x${string}`

const VALIDATION_ABI = [
  { type: 'function', name: 'validationRequest', stateMutability: 'nonpayable', inputs: [
    { name: 'validatorAddress', type: 'address' }, { name: 'agentId', type: 'uint256' },
    { name: 'requestURI', type: 'string' }, { name: 'requestHash', type: 'bytes32' },
  ], outputs: [] },
  { type: 'function', name: 'validationResponse', stateMutability: 'nonpayable', inputs: [
    { name: 'requestHash', type: 'bytes32' }, { name: 'response', type: 'uint8' },
    { name: 'responseURI', type: 'string' }, { name: 'responseHash', type: 'bytes32' }, { name: 'tag', type: 'string' },
  ], outputs: [] },
  { type: 'function', name: 'getValidationStatus', stateMutability: 'view', inputs: [{ name: 'requestHash', type: 'bytes32' }], outputs: [
    { name: 'validatorAddress', type: 'address' }, { name: 'agentId', type: 'uint256' }, { name: 'response', type: 'uint8' },
    { name: 'responseHash', type: 'bytes32' }, { name: 'tag', type: 'string' }, { name: 'lastUpdate', type: 'uint256' },
  ] },
  { type: 'function', name: 'getSummary', stateMutability: 'view', inputs: [
    { name: 'agentId', type: 'uint256' }, { name: 'validatorAddresses', type: 'address[]' }, { name: 'tag', type: 'string' },
  ], outputs: [{ name: 'count', type: 'uint64' }, { name: 'averageResponse', type: 'uint8' }] },
  { type: 'function', name: 'getAgentValidations', stateMutability: 'view', inputs: [{ name: 'agentId', type: 'uint256' }], outputs: [{ name: 'requestHashes', type: 'bytes32[]' }] },
] as const

type ValidationExecuted = { executed: true; txHash: string; explorerUrl: string; requestHash: string }

/**
 * Attest an agent's KYA result on the ERC-8004 ValidationRegistry (two real txs:
 * validationRequest then validationResponse=100, tag "kya"). Prepared without a key.
 * Requires our signer to own the ERC-8004 agentId (i.e. the agent was anchored first).
 */
export async function recordValidationOnchain(
  agentId: bigint,
  requestUri: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<Prepared | ValidationExecuted> {
  const { keccak256, toHex } = await import('viem')
  const requestHash = keccak256(toHex(`kya:${agentId.toString()}:${requestUri}:${Date.now()}`))
  const signer = await walletClient(env)
  if (!signer) {
    return {
      executed: false,
      contract: CONTRACTS.validationRegistry,
      function: 'validationRequest(address,uint256,string,bytes32) + validationResponse(bytes32,uint8,string,bytes32,string)',
      args: [agentId.toString(), requestUri, requestHash],
      reason: 'No ARC_SIGNER_KEY set. This opens + answers an ERC-8004 validation (response=100, tag "kya") for the agent.',
    }
  }
  const client = await publicClient()
  const validator = signer.account.address
  const reqTx = await signer.client.writeContract({
    address: CONTRACTS.validationRegistry, abi: VALIDATION_ABI, functionName: 'validationRequest',
    args: [validator, agentId, requestUri, requestHash],
  })
  await client.waitForTransactionReceipt({ hash: reqTx })
  const respTx = await signer.client.writeContract({
    address: CONTRACTS.validationRegistry, abi: VALIDATION_ABI, functionName: 'validationResponse',
    args: [requestHash, 100, requestUri, ZERO_HASH, 'kya'],
  })
  await client.waitForTransactionReceipt({ hash: respTx })
  return { executed: true, txHash: respTx, explorerUrl: tx(respTx), requestHash }
}

/** Read an agent's on-chain KYA validation summary (no key needed). */
export async function readValidation(agentId: bigint, env: NodeJS.ProcessEnv = process.env) {
  const client = await publicClient()
  try {
    const validator = (await walletClient(env))?.account.address
    const hashes = (await client.readContract({
      address: CONTRACTS.validationRegistry, abi: VALIDATION_ABI, functionName: 'getAgentValidations', args: [agentId],
    })) as readonly string[]
    let kyaCount = 0
    let kyaAverage = 0
    if (validator) {
      const summary = (await client.readContract({
        address: CONTRACTS.validationRegistry, abi: VALIDATION_ABI, functionName: 'getSummary',
        args: [agentId, [validator as `0x${string}`], 'kya'],
      })) as readonly [bigint, number]
      kyaCount = Number(summary[0])
      kyaAverage = Number(summary[1])
    }
    return {
      agentId: agentId.toString(),
      validations: hashes.length,
      kyaCount,
      kyaAverage,
      registry: CONTRACTS.validationRegistry,
      explorer: addressUrl(CONTRACTS.validationRegistry),
    }
  } catch (e) {
    return { agentId: agentId.toString(), error: e instanceof Error ? e.message : String(e) }
  }
}
