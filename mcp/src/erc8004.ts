/**
 * ERC-8004 identity resolution — REAL on-chain reads via viem, no mocks.
 *
 * The default provider reads Circle Arc's deployed ERC-8004 IdentityRegistry
 * (0x8004A818…, the same contract the rest of the app writes to). Resolving an
 * agent id or token id does a live `ownerOf` + `tokenURI` read. Extra EVM chains
 * (Ethereum / Base / Arbitrum) are added when their RPC + registry env vars are set.
 * Read-only — no keys, no funds, no writes.
 *
 * Optional env vars to add more chains:
 *   A_IDENTITY_RPC_URL / ERC8004_IDENTITY_REGISTRY   (Ethereum mainnet)
 *   BASE_RPC_URL / BASE_ERC8004_REGISTRY             (Base)
 *   ARB_RPC_URL / ARB_ERC8004_REGISTRY               (Arbitrum One)
 */
import type { AgentIdentity } from './data.js'
import { ARC_RPC, CONTRACTS } from './arc-contracts.js'

export interface IdentityProvider {
  resolve(query: string): Promise<AgentIdentity | null>
  readonly kind: 'rpc'
}

// ── Minimal ERC-721 ABI for on-chain reads ────────────────────────────────────
// ERC-8004 extends ERC-721: ownerOf + tokenURI are sufficient for identity reads.
const ERC721_ABI = [
  {
    name: 'ownerOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'tokenURI',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

type ChainClient = {
  chainId: number
  chainName: string
  rpcUrl: string
  registry: `0x${string}`
  caipPrefix: string
}

/**
 * Real on-chain ERC-8004 reads using viem.
 * Multi-chain: one client per chain, routed by CAIP-10 prefix or token id.
 */
export class RpcIdentityProvider implements IdentityProvider {
  readonly kind = 'rpc' as const
  private clients: ChainClient[]

  constructor(clients: ChainClient[]) {
    this.clients = clients
  }

  async resolve(query: string): Promise<AgentIdentity | null> {
    // Lazy import viem so the mock path never loads it.
    const { createPublicClient, http, isAddress } = await import('viem')

    const q = query.trim()

    // Detect CAIP-10 format: eip155:chainId:8004/tokenId
    const caipMatch = q.match(/^eip155:(\d+):8004\/(\d+)$/i)
    if (caipMatch) {
      const chainId = Number(caipMatch[1])
      const tokenId = BigInt(caipMatch[2])
      const client = this.clients.find((c) => c.chainId === chainId)
      if (!client) return null
      return this._readToken(createPublicClient, http, client, tokenId)
    }

    // Token id: "#3" or "3"
    const tokenMatch = q.match(/^#?(\d+)$/)
    if (tokenMatch) {
      const tokenId = BigInt(tokenMatch[1])
      // Try all chains, return first match
      for (const client of this.clients) {
        const result = await this._readToken(createPublicClient, http, client, tokenId)
        if (result) return result
      }
      return null
    }

    // Owner address: resolve first token owned
    if (isAddress(q)) {
      for (const client of this.clients) {
        const result = await this._readByOwner(createPublicClient, http, client, q)
        if (result) return result
      }
      return null
    }

    // Domain lookups aren't resolvable on-chain in ERC-8004 v0.1 (no reverse index),
    // so we don't fabricate one — resolve by agent id, token id, or owner address.
    return null
  }

  private async _readToken(
    createPublicClient: typeof import('viem').createPublicClient,
    httpTransport: typeof import('viem').http,
    chain: ChainClient,
    tokenId: bigint,
  ): Promise<AgentIdentity | null> {
    try {
      const client = createPublicClient({ transport: httpTransport(chain.rpcUrl) })
      const [owner, tokenUri] = await Promise.all([
        client.readContract({
          address: chain.registry,
          abi: ERC721_ABI,
          functionName: 'ownerOf',
          args: [tokenId],
        }) as Promise<`0x${string}`>,
        client.readContract({
          address: chain.registry,
          abi: ERC721_ABI,
          functionName: 'tokenURI',
          args: [tokenId],
        }) as Promise<string>,
      ])

      // Fetch registration JSON from tokenURI (display metadata only).
      let domain = ''
      let registeredAt = new Date().toISOString().slice(0, 10)
      // `valid` is NOT self-attestable: the tokenURI JSON is hosted by the agent itself,
      // so reading `valid` from it lets any agent mark itself verified (and an unreachable
      // URI would default it to `true`). Authoritative verification comes from the on-chain
      // ERC-8004 ValidationRegistry (readValidation), surfaced separately by callers.
      const valid = false
      if (isSafePublicHttpUrl(tokenUri)) {
        try {
          // redirect:'error' so a public URL can't 30x us into an internal target.
          const reg = await fetch(tokenUri, { signal: AbortSignal.timeout(4000), redirect: 'error' })
          if (reg.ok) {
            const data = (await reg.json()) as Partial<AgentIdentity>
            domain = data.domain ?? ''
            registeredAt = data.registeredAt ?? registeredAt
          }
        } catch {
          // tokenURI not reachable - use on-chain data only
        }
      }

      return {
        agentId: `${chain.caipPrefix}:8004/${tokenId}`,
        tokenId: Number(tokenId),
        owner,
        registrationUri: tokenUri,
        domain,
        valid,
        registeredAt,
        chain: chain.chainName as AgentIdentity['chain'],
      }
    } catch {
      return null
    }
  }

  private async _readByOwner(
    createPublicClient: typeof import('viem').createPublicClient,
    httpTransport: typeof import('viem').http,
    chain: ChainClient,
    address: `0x${string}`,
  ): Promise<AgentIdentity | null> {
    try {
      const client = createPublicClient({ transport: httpTransport(chain.rpcUrl) })
      const balance = await client.readContract({
        address: chain.registry,
        abi: ERC721_ABI,
        functionName: 'balanceOf',
        args: [address],
      }) as bigint
      if (balance === 0n) return null
      // ERC-721 enumerable not guaranteed; try token IDs 1-200 heuristically
      const total = await client.readContract({
        address: chain.registry,
        abi: ERC721_ABI,
        functionName: 'totalSupply',
        args: [],
      }) as bigint
      const limit = Number(total < 200n ? total : 200n)
      for (let i = 1; i <= limit; i++) {
        try {
          const owner = await client.readContract({
            address: chain.registry,
            abi: ERC721_ABI,
            functionName: 'ownerOf',
            args: [BigInt(i)],
          }) as `0x${string}`
          if (owner.toLowerCase() === address.toLowerCase()) {
            return this._readToken(createPublicClient, httpTransport, chain, BigInt(i))
          }
        } catch { /* token may not exist */ }
      }
      return null
    } catch {
      return null
    }
  }
}

function toAddress(val: string): `0x${string}` {
  if (!/^0x[0-9a-fA-F]{40}$/.test(val)) throw new Error(`Invalid address: ${val}`)
  return val as `0x${string}`
}

/**
 * SSRF guard for the agent-controlled tokenURI. The URI is set by whoever registered the
 * agent, and we fetch it server-side — so it must not be allowed to point at loopback, a
 * private range, or cloud metadata (169.254.169.254). Best-effort literal-host filtering
 * (no DNS): blocks the obvious internal targets; callers also fetch with redirect:'error'.
 */
export function isSafePublicHttpUrl(raw: string): boolean {
  let u: URL
  try { u = new URL(raw) } catch { return false }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
  // Strip IPv6 brackets so `[::1]` normalizes to `::1` for the checks below.
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return false
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (m) {
    const a = Number(m[1]), b = Number(m[2])
    if (a === 0 || a === 10 || a === 127) return false
    if (a === 169 && b === 254) return false // link-local incl. the metadata endpoint
    if (a === 192 && b === 168) return false
    if (a === 172 && b >= 16 && b <= 31) return false
    if (a === 100 && b >= 64 && b <= 127) return false // CGNAT
  }
  if (host.includes(':')) {
    if (host === '::1' || host.startsWith('fe80') || host.startsWith('fc') || host.startsWith('fd')) return false
  }
  return true
}

export function createIdentityProvider(env: NodeJS.ProcessEnv = process.env): IdentityProvider {
  // Circle Arc is always on: its ERC-8004 IdentityRegistry is deployed and known,
  // so identity resolution is real out of the box — no env vars required.
  const clients: ChainClient[] = [
    {
      chainId: 5042002,
      chainName: 'arc',
      rpcUrl: ARC_RPC,
      registry: CONTRACTS.identityRegistry as `0x${string}`,
      caipPrefix: 'eip155:5042002',
    },
  ]

  if (env.A_IDENTITY_RPC_URL && env.ERC8004_IDENTITY_REGISTRY) {
    clients.push({
      chainId: 1,
      chainName: 'ethereum',
      rpcUrl: env.A_IDENTITY_RPC_URL,
      registry: toAddress(env.ERC8004_IDENTITY_REGISTRY),
      caipPrefix: 'eip155:1',
    })
  }

  if (env.BASE_RPC_URL && env.BASE_ERC8004_REGISTRY) {
    clients.push({
      chainId: 8453,
      chainName: 'base',
      rpcUrl: env.BASE_RPC_URL,
      registry: toAddress(env.BASE_ERC8004_REGISTRY),
      caipPrefix: 'eip155:8453',
    })
  }

  if (env.ARB_RPC_URL && env.ARB_ERC8004_REGISTRY) {
    clients.push({
      chainId: 42161,
      chainName: 'arbitrum',
      rpcUrl: env.ARB_RPC_URL,
      registry: toAddress(env.ARB_ERC8004_REGISTRY),
      caipPrefix: 'eip155:42161',
    })
  }

  return new RpcIdentityProvider(clients)
}
