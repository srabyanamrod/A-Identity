/**
 * Circle Arc chain configuration and helpers.
 *
 * Arc is an EVM-compatible chain where gas is paid in USDC (not a volatile native
 * token), with deterministic sub-second finality. Mainnet is not public yet, so we
 * target Arc Testnet. Source: https://docs.arc.io/arc-chain and /references/rpc-endpoints
 *
 * Dual USDC interface: the native balance uses 18 decimals while the ERC-20
 * interface uses 6 decimals; both share the same underlying balance.
 */

export const ARC_TESTNET = {
  id: 5042002,
  caip2: 'eip155:5042002',
  name: 'Arc Testnet',
  network: 'arc-testnet',
  nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 18 },
  rpc: {
    http: 'https://rpc.testnet.arc.network',
    ws: 'wss://rpc.testnet.arc.network',
  },
  blockExplorer: 'https://testnet.arcscan.app',
  /** Native USDC uses 18 decimals; the ERC-20 interface uses 6. Same balance. */
  nativeDecimals: 18,
  erc20Decimals: 6,
  finality: 'Deterministic, sub-second (~0.48s block time)',
  gasToken: 'USDC',
  testnet: true,
} as const

/**
 * Lazily build a viem Chain object for Arc Testnet. Lazy so the chain config can
 * be imported without pulling viem into modules that do not need it.
 */
export async function getArcViemChain(): Promise<any> {
  // Variable specifier so typecheck does not require viem to be installed.
  const viemPkg = 'viem'
  const { defineChain } = (await import(/* @vite-ignore */ viemPkg)) as any
  return defineChain({
    id: ARC_TESTNET.id,
    name: ARC_TESTNET.name,
    nativeCurrency: ARC_TESTNET.nativeCurrency,
    rpcUrls: {
      default: { http: [ARC_TESTNET.rpc.http], webSocket: [ARC_TESTNET.rpc.ws] },
    },
    blockExplorers: {
      default: { name: 'Arcscan', url: ARC_TESTNET.blockExplorer },
    },
    testnet: true,
  })
}

/** Explorer link for an address on Arc Testnet. */
export function arcAddressUrl(address: string): string {
  return `${ARC_TESTNET.blockExplorer}/address/${address}`
}
