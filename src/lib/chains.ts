export type ChainId = 'arc' | 'base' | 'arbitrum' | 'stellar' | 'algorand'

export type ChainProtocols = {
  /** x402 HTTP-402 payment support. Settlement is in a stablecoin. */
  payment: { x402: boolean; note?: string }
  /** Identity standard. ERC-8004 is EVM-only; non-EVM chains map to a native equivalent. */
  identity: { standard: string; erc8004Native: boolean; note?: string }
}

export type Chain = {
  id: ChainId
  name: string
  shortName: string
  /** Hex color for UI badges and chips. Kept readable for colored tag text. */
  color: string
  /** EIP-155 chain id. Null for non-EVM chains (Arc, Stellar, Algorand). */
  chainId: number | null
  /** CAIP-2 chain identifier. */
  caip2: string | null
  evmCompatible: boolean
  /** Stablecoins available on this chain. First is the default settlement coin. */
  stablecoins: ('USDC' | 'USDT' | 'PYUSD' | 'EURC' | 'USYC')[]
  rpcUrl: string | null
  explorer: string | null
  role: string
  status: 'active' | 'preview' | 'planned'
  protocols: ChainProtocols
}

export const CHAINS: readonly Chain[] = [
  {
    id: 'arc',
    name: 'Circle Arc (Testnet)',
    shortName: 'Arc',
    color: '#2775CA',
    chainId: 5042002,
    caip2: 'eip155:5042002',
    evmCompatible: true,
    // Circle-native set on Arc: no USDT here. USYC is Circle's tokenized
    // money market fund (yield-bearing collateral).
    stablecoins: ['USDC', 'EURC', 'USYC'],
    rpcUrl: 'https://rpc.testnet.arc.network',
    explorer: 'https://testnet.arcscan.app',
    role: 'Primary payment rail: gas paid in USDC, sub-second finality, Circle App Kit unified balance.',
    // Phase 1: all services run on Arc first. Next in order: Stellar, Avalanche, Solana.
    status: 'active',
    protocols: {
      payment: { x402: true, note: 'Gas in USDC, App Kit (Gateway) unified balance, nanopayments.' },
      identity: { standard: 'ERC-8004', erc8004Native: true },
    },
  },
  {
    id: 'base',
    name: 'Base',
    shortName: 'Base',
    color: '#0052FF',
    chainId: 8453,
    caip2: 'eip155:8453',
    evmCompatible: true,
    stablecoins: ['USDC', 'USDT', 'PYUSD'],
    rpcUrl: 'https://mainnet.base.org',
    explorer: 'https://basescan.org',
    role: 'EVM fallback: ERC-8004 compatible, Coinbase ecosystem, low fees, wide developer reach.',
    status: 'planned',
    protocols: {
      payment: { x402: true, note: 'x402 reference rail (Coinbase).' },
      identity: { standard: 'ERC-8004', erc8004Native: true },
    },
  },
  {
    id: 'arbitrum',
    name: 'Arbitrum One',
    shortName: 'Arbitrum',
    color: '#28A0F0',
    chainId: 42161,
    caip2: 'eip155:42161',
    evmCompatible: true,
    stablecoins: ['USDC', 'USDT'],
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    explorer: 'https://arbiscan.io',
    role: 'DeFi gateway: ERC-8004 compatible, large protocol ecosystem, USDC via Circle.',
    status: 'planned',
    protocols: {
      payment: { x402: true, note: 'x402 over USDC on Arbitrum One.' },
      identity: { standard: 'ERC-8004', erc8004Native: true },
    },
  },
  {
    id: 'stellar',
    name: 'Stellar',
    shortName: 'Stellar',
    color: '#C79A1E',
    chainId: null,
    caip2: 'stellar:pubnet',
    evmCompatible: false,
    stablecoins: ['USDC', 'EURC'],
    rpcUrl: 'https://horizon.stellar.org',
    explorer: 'https://stellar.expert/explorer/public',
    role: 'Fast, low-cost settlement: USDC and EURC native (Circle), Soroban smart contracts.',
    status: 'planned',
    protocols: {
      payment: { x402: true, note: 'x402 settlement in USDC; native Stellar payments under the hood.' },
      identity: {
        standard: 'Soroban registry + SEP-10',
        erc8004Native: false,
        note: 'No native ERC-8004 (EVM-only). Identity via Soroban registry and SEP-10 auth; ERC-8004 passport bridged from EVM.',
      },
    },
  },
  {
    id: 'algorand',
    name: 'Algorand',
    shortName: 'Algorand',
    color: '#1A1A1A',
    chainId: null,
    caip2: 'algorand:mainnet',
    evmCompatible: false,
    stablecoins: ['USDC', 'USDT'],
    rpcUrl: 'https://mainnet-api.algonode.cloud',
    explorer: 'https://allo.info',
    role: 'Instant finality, low fees: USDC native (Circle), did:algo identity, ARC smart contracts.',
    status: 'planned',
    protocols: {
      payment: { x402: true, note: 'x402 settlement in USDC; ASA transfers under the hood.' },
      identity: {
        standard: 'did:algo + ARC registry',
        erc8004Native: false,
        note: 'No native ERC-8004 (EVM-only). Identity via W3C did:algo and an ARC registry; ERC-8004 passport bridged from EVM.',
      },
    },
  },
] as const

export const CHAIN_BY_ID = Object.fromEntries(CHAINS.map((c) => [c.id, c])) as Record<
  ChainId,
  Chain
>
