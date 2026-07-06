/**
 * Circle Arc integration (read-only). Arc is an EVM chain where gas is paid in
 * USDC, with sub-second deterministic finality. We connect to the public Arc
 * testnet RPC with viem and read live chain state. No keys, no funds, no writes.
 *
 * Grounded in docs.arc.io:
 *   - references/connect-to-arc  (chainId, RPC, native USDC 18 decimals, faucet)
 *   - tutorials/deploy-on-arc    (Foundry, gas paid in USDC)
 *   - app-kit                    (@circle-fin/app-kit unified balance)
 */

export const ARC_TESTNET = {
  id: 5042002,
  caip2: 'eip155:5042002',
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 18 },
  rpc: {
    primary: 'https://rpc.testnet.arc.network',
    ws: 'wss://rpc.testnet.arc.network',
    alternates: [
      'https://rpc.blockdaemon.testnet.arc.network',
      'https://rpc.drpc.testnet.arc.network',
      'https://rpc.quicknode.testnet.arc.network',
    ],
  },
  explorer: 'https://testnet.arcscan.app',
  faucet: 'https://faucet.circle.com',
  gasToken: 'USDC',
  /** Native USDC uses 18 decimals; the ERC-20 interface uses 6. Same balance. */
  nativeDecimals: 18,
  erc20Decimals: 6,
  finality: 'deterministic, sub-second',
} as const

export type ArcStatus = {
  chain: 'arc-testnet'
  online: boolean
  chainId: number | null
  blockNumber: string | null
  rpc: string
  explorer: string
  faucet: string
  gasToken: string
  nativeDecimals: number
  checkedAt: string
  note?: string
}

/**
 * Read live Arc testnet state over JSON-RPC via viem. Degrades gracefully: if the
 * RPC is unreachable, returns online:false with the static config still attached.
 */
export async function getArcStatus(rpcUrl: string = ARC_TESTNET.rpc.primary): Promise<ArcStatus> {
  const base: ArcStatus = {
    chain: 'arc-testnet',
    online: false,
    chainId: null,
    blockNumber: null,
    rpc: rpcUrl,
    explorer: ARC_TESTNET.explorer,
    faucet: ARC_TESTNET.faucet,
    gasToken: ARC_TESTNET.gasToken,
    nativeDecimals: ARC_TESTNET.nativeDecimals,
    checkedAt: new Date().toISOString(),
  }

  try {
    const { createPublicClient, http } = await import('viem')
    const client = createPublicClient({
      transport: http(rpcUrl, { timeout: 5000, retryCount: 0 }),
    })
    const [chainId, blockNumber] = await Promise.all([
      client.getChainId(),
      client.getBlockNumber(),
    ])
    return {
      ...base,
      online: true,
      chainId: Number(chainId),
      blockNumber: blockNumber.toString(),
    }
  } catch (err) {
    return {
      ...base,
      note:
        'Arc testnet RPC not reachable from here. Config is correct; the chain may be in a quiet or restricted window. ' +
        (err instanceof Error ? err.message : String(err)),
    }
  }
}
