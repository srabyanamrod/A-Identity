/**
 * ERC-8004 identity resolution, behind a swappable provider.
 *
 * Phase 4: MockIdentityProvider (in-memory fixtures, 3 chains).
 * Phase 5: RpcIdentityProvider - real on-chain reads via viem.
 *           Activates when A_IDENTITY_RPC_URL + ERC8004_IDENTITY_REGISTRY are set.
 *           Multi-chain: set per-chain env vars to enable each (see below).
 *           Read-only - no keys, no funds, no writes.
 *
 * Env vars for on-chain mode:
 *   A_IDENTITY_RPC_URL          (Ethereum mainnet RPC, e.g. Alchemy/Infura)
 *   ERC8004_IDENTITY_REGISTRY   (Identity Registry contract address on mainnet)
 *   BASE_RPC_URL                (Base mainnet RPC, optional)
 *   BASE_ERC8004_REGISTRY       (Identity Registry on Base, optional)
 *   ARB_RPC_URL                 (Arbitrum One RPC, optional)
 *   ARB_ERC8004_REGISTRY        (Identity Registry on Arbitrum, optional)
 */
import { resolveAgent, type AgentIdentity } from './data.js'

export interface IdentityProvider {
  resolve(query: string): Promise<AgentIdentity | null>
  readonly kind: 'mock' | 'rpc'
}

export class MockIdentityProvider implements IdentityProvider {
  readonly kind = 'mock' as const
  async resolve(query: string): Promise<AgentIdentity | null> {
    return resolveAgent(query)
  }
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

    // Domain: fall back to mock (domains aren't on-chain in ERC-8004 v0.1)
    return resolveAgent(q)
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

      // Fetch registration JSON from tokenURI
      let domain = ''
      let registeredAt = new Date().toISOString().slice(0, 10)
      let valid = true
      if (tokenUri.startsWith('http')) {
        try {
          const reg = await fetch(tokenUri, { signal: AbortSignal.timeout(4000) })
          if (reg.ok) {
            const data = (await reg.json()) as Partial<AgentIdentity>
            domain = data.domain ?? ''
            registeredAt = data.registeredAt ?? registeredAt
            valid = data.valid ?? true
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

export function createIdentityProvider(env: NodeJS.ProcessEnv = process.env): IdentityProvider {
  const clients: ChainClient[] = []

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

  if (clients.length > 0) return new RpcIdentityProvider(clients)
  return new MockIdentityProvider()
}
