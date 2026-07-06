/**
 * Mock, read-only data for the A-Identity MCP server.
 *
 * Multi-chain: Ethereum mainnet, Base, Arbitrum One (EVM, ERC-8004 native),
 * plus Stellar and Algorand (non-EVM, identity bridged via native standards).
 * Real chain adapters drop in via RpcIdentityProvider (see erc8004.ts).
 */

export type ChainName = 'arc' | 'ethereum' | 'base' | 'arbitrum' | 'stellar' | 'algorand'

export type AgentIdentity = {
  agentId: string
  tokenId: number
  owner: string
  registrationUri: string
  domain: string
  valid: boolean
  registeredAt: string
  chain: ChainName
}

export type AgentActionHistory = {
  agentId: string
  settledActions: number
  disputes: number
  registeredAt: string
}

export const AGENTS: AgentIdentity[] = [
  // Arc Testnet (eip155:5042002) - ERC-8004 native, gas in USDC, App Kit unified balance
  { agentId: 'eip155:5042002:8004/10', tokenId: 10, owner: '0xARC0000000000000000000000000000000000010', registrationUri: 'https://agents.a-identity.dev/10/registration.json', domain: 'treasury.arc.a-identity.dev', valid: true, registeredAt: '2026-06-10', chain: 'arc' },
  // Ethereum mainnet (eip155:1) - ERC-8004 native
  { agentId: 'eip155:1:8004/1', tokenId: 1, owner: '0xA11CE00000000000000000000000000000000001', registrationUri: 'https://agents.a-identity.dev/1/registration.json', domain: 'research.a-identity.dev', valid: true, registeredAt: '2026-02-03', chain: 'ethereum' },
  { agentId: 'eip155:1:8004/2', tokenId: 2, owner: '0xB0B0000000000000000000000000000000000002', registrationUri: 'https://agents.a-identity.dev/2/registration.json', domain: 'payments.a-identity.dev', valid: true, registeredAt: '2026-03-19', chain: 'ethereum' },
  { agentId: 'eip155:1:8004/3', tokenId: 3, owner: '0xCA1F000000000000000000000000000000000003', registrationUri: 'https://agents.a-identity.dev/3/registration.json', domain: 'scraper.example.com', valid: false, registeredAt: '2026-05-28', chain: 'ethereum' },
  // Base (eip155:8453) - ERC-8004 native
  { agentId: 'eip155:8453:8004/4', tokenId: 4, owner: '0xBASE0000000000000000000000000000000004', registrationUri: 'https://agents.a-identity.dev/4/registration.json', domain: 'defi.base.a-identity.dev', valid: true, registeredAt: '2026-04-10', chain: 'base' },
  { agentId: 'eip155:8453:8004/5', tokenId: 5, owner: '0xBASE0000000000000000000000000000000005', registrationUri: 'https://agents.a-identity.dev/5/registration.json', domain: 'yield.base.a-identity.dev', valid: true, registeredAt: '2026-05-01', chain: 'base' },
  // Arbitrum One (eip155:42161) - ERC-8004 native
  { agentId: 'eip155:42161:8004/6', tokenId: 6, owner: '0xARB10000000000000000000000000000000006', registrationUri: 'https://agents.a-identity.dev/6/registration.json', domain: 'arb-trading.a-identity.dev', valid: true, registeredAt: '2026-05-15', chain: 'arbitrum' },
  { agentId: 'eip155:42161:8004/7', tokenId: 7, owner: '0xARB10000000000000000000000000000000007', registrationUri: 'https://agents.a-identity.dev/7/registration.json', domain: 'gm.a-identity.dev', valid: true, registeredAt: '2026-06-01', chain: 'arbitrum' },
  // Stellar (stellar:pubnet) - identity bridged (Soroban registry + SEP-10)
  { agentId: 'stellar:pubnet:aid/8', tokenId: 8, owner: 'GADERESEARCHAGENTSTELLARPUBLICKEY00000000000000000008', registrationUri: 'https://agents.a-identity.dev/8/registration.json', domain: 'fx.stellar.a-identity.dev', valid: true, registeredAt: '2026-05-22', chain: 'stellar' },
  // Algorand (algorand:mainnet) - identity bridged (did:algo + ARC registry)
  { agentId: 'algorand:mainnet:aid/9', tokenId: 9, owner: 'ALGOAGENT7XV4ABCDEFGHIJKLMNOPQRSTUVWXYZ234567ALGORAND9', registrationUri: 'https://agents.a-identity.dev/9/registration.json', domain: 'pay.algo.a-identity.dev', valid: true, registeredAt: '2026-06-05', chain: 'algorand' },
]

const HISTORY: Record<string, AgentActionHistory> = {
  'eip155:5042002:8004/10': { agentId: 'eip155:5042002:8004/10', settledActions: 320, disputes: 0, registeredAt: '2026-06-10' },
  'eip155:1:8004/1':      { agentId: 'eip155:1:8004/1',      settledActions: 1894, disputes: 2, registeredAt: '2026-02-03' },
  'eip155:1:8004/2':      { agentId: 'eip155:1:8004/2',      settledActions: 980,  disputes: 5, registeredAt: '2026-03-19' },
  'eip155:1:8004/3':      { agentId: 'eip155:1:8004/3',      settledActions: 12,   disputes: 4, registeredAt: '2026-05-28' },
  'eip155:8453:8004/4':   { agentId: 'eip155:8453:8004/4',   settledActions: 541,  disputes: 1, registeredAt: '2026-04-10' },
  'eip155:8453:8004/5':   { agentId: 'eip155:8453:8004/5',   settledActions: 287,  disputes: 0, registeredAt: '2026-05-01' },
  'eip155:42161:8004/6':  { agentId: 'eip155:42161:8004/6',  settledActions: 198,  disputes: 1, registeredAt: '2026-05-15' },
  'eip155:42161:8004/7':  { agentId: 'eip155:42161:8004/7',  settledActions: 74,   disputes: 0, registeredAt: '2026-06-01' },
  'stellar:pubnet:aid/8':  { agentId: 'stellar:pubnet:aid/8',  settledActions: 412, disputes: 1, registeredAt: '2026-05-22' },
  'algorand:mainnet:aid/9': { agentId: 'algorand:mainnet:aid/9', settledActions: 156, disputes: 0, registeredAt: '2026-06-05' },
}

export function resolveAgent(query: string): AgentIdentity | null {
  const q = query.trim().toLowerCase()
  return (
    AGENTS.find(
      (a) =>
        a.agentId.toLowerCase() === q ||
        `#${a.tokenId}` === q ||
        String(a.tokenId) === q ||
        a.owner.toLowerCase() === q ||
        a.domain.toLowerCase() === q,
    ) ?? null
  )
}

export function getHistory(agentId: string): AgentActionHistory | null {
  const agent = resolveAgent(agentId)
  if (!agent) return null
  return HISTORY[agent.agentId] ?? null
}

export function listAgents(chain?: string): AgentIdentity[] {
  if (!chain) return AGENTS
  const chainKey = chain.toLowerCase()
  return AGENTS.filter((a) => a.chain === chainKey)
}

export const CHAIN_CONFIG = [
  {
    id: 'arc', name: 'Circle Arc (Testnet)', shortName: 'Arc', chainId: 5042002 as number | null,
    evmCompatible: true, color: '#2775CA',
    identity: 'ERC-8004', erc8004Native: true, x402: true,
    role: 'Primary payment rail: gas in USDC, sub-second finality, App Kit unified balance.',
    status: 'preview', agentCount: AGENTS.filter((a) => a.chain === 'arc').length,
  },
  {
    id: 'base', name: 'Base', shortName: 'Base', chainId: 8453,
    evmCompatible: true, color: '#0052FF',
    identity: 'ERC-8004', erc8004Native: true, x402: true,
    role: 'EVM fallback: ERC-8004 compatible, Coinbase ecosystem, low fees.',
    status: 'preview', agentCount: AGENTS.filter((a) => a.chain === 'base').length,
  },
  {
    id: 'arbitrum', name: 'Arbitrum One', shortName: 'Arbitrum', chainId: 42161,
    evmCompatible: true, color: '#28A0F0',
    identity: 'ERC-8004', erc8004Native: true, x402: true,
    role: 'DeFi gateway: large protocol ecosystem, USDC via Circle, ERC-8004 compatible.',
    status: 'preview', agentCount: AGENTS.filter((a) => a.chain === 'arbitrum').length,
  },
  {
    id: 'stellar', name: 'Stellar', shortName: 'Stellar', chainId: null,
    evmCompatible: false, color: '#C79A1E',
    identity: 'Soroban registry + SEP-10', erc8004Native: false, x402: true,
    role: 'Fast, low-cost settlement: USDC + EURC native (Circle), Soroban contracts.',
    status: 'planned', agentCount: AGENTS.filter((a) => a.chain === 'stellar').length,
  },
  {
    id: 'algorand', name: 'Algorand', shortName: 'Algorand', chainId: null,
    evmCompatible: false, color: '#1A1A1A',
    identity: 'did:algo + ARC registry', erc8004Native: false, x402: true,
    role: 'Instant finality: USDC native (Circle), W3C did:algo, ARC smart contracts.',
    status: 'planned', agentCount: AGENTS.filter((a) => a.chain === 'algorand').length,
  },
]

export function listCapabilities() {
  return {
    name: 'A-Identity',
    version: '0.2.0',
    status: 'preview',
    capabilities: {
      identity: {
        standard: 'ERC-8004',
        evmChains: ['ethereum-mainnet', 'base', 'arbitrum-one', 'arc'],
        nonEvmChains: [
          { chain: 'stellar', standard: 'Soroban registry + SEP-10', note: 'ERC-8004 passport bridged from EVM' },
          { chain: 'algorand', standard: 'did:algo + ARC registry', note: 'ERC-8004 passport bridged from EVM' },
        ],
        status: 'preview',
      },
      payments: {
        standard: 'x402',
        settlement: 'USDC',
        also_supported: ['USDT', 'PYUSD', 'EURC'],
        rails: ['arc', 'base', 'arbitrum', 'stellar', 'algorand'],
        wallets: 'circle-agent-wallets',
        status: 'planned',
      },
      connectivity: {
        standard: 'model-context-protocol',
        paidTools: 'x402-mcp',
        status: 'preview',
      },
      reputation: { model: 'deterministic', range: [0, 1000], crossChain: true, status: 'preview' },
    },
    humanOversight:
      'Actions that hold a key, deploy a contract, or move value require explicit human approval.',
  }
}
