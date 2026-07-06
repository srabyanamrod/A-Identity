/**
 * Real Arc testnet contracts: ERC-8004 (agent identity/reputation/validation)
 * and ERC-8183 (agentic-commerce job escrow). Addresses and function signatures
 * are verbatim from docs.arc.io tutorials.
 *
 * Reads run live with no key. Writes are env-gated behind ARC_SIGNER_KEY and stay
 * human-on-the-loop: nothing broadcasts unless a key is present and the caller
 * explicitly asks to execute. Gas is paid in USDC (~0.006 USDC per tx).
 */

export const ARC_RPC = 'https://rpc.testnet.arc.network'
export const ARC_EXPLORER = 'https://testnet.arcscan.app'

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
] as const

// ── clients ────────────────────────────────────────────────────────────────────

async function publicClient() {
  const { createPublicClient, http } = await import('viem')
  return createPublicClient({ transport: http(ARC_RPC, { timeout: 8000, retryCount: 1 }) })
}

/** Present only when ARC_SIGNER_KEY is set. Human-on-the-loop lives one level up. */
async function walletClient(env: NodeJS.ProcessEnv) {
  const key = env.ARC_SIGNER_KEY
  if (!key) return null
  const { createWalletClient, http, defineChain } = await import('viem')
  const { privateKeyToAccount } = await import('viem/accounts')
  const chain = defineChain({
    id: 5042002,
    name: 'Arc Testnet',
    nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 18 },
    rpcUrls: { default: { http: [ARC_RPC] } },
  })
  const account = privateKeyToAccount(key as `0x${string}`)
  return { client: createWalletClient({ account, chain, transport: http(ARC_RPC) }), account }
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
    const [name, symbol, supply] = await Promise.allSettled([
      client.readContract({ address: CONTRACTS.identityRegistry, abi: IDENTITY_ABI, functionName: 'name' }),
      client.readContract({ address: CONTRACTS.identityRegistry, abi: IDENTITY_ABI, functionName: 'symbol' }),
      client.readContract({ address: CONTRACTS.identityRegistry, abi: IDENTITY_ABI, functionName: 'totalSupply' }),
    ])
    out.identity = {
      address: CONTRACTS.identityRegistry,
      name: name.status === 'fulfilled' ? name.value : null,
      symbol: symbol.status === 'fulfilled' ? symbol.value : null,
      registeredAgents: supply.status === 'fulfilled' ? (supply.value as bigint).toString() : null,
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
