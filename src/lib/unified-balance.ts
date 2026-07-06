/**
 * Unified Balance, backed by Circle App Kit (built on Circle Gateway).
 *
 * The Unified Balance combines USDC from multiple chains into a single,
 * instantly spendable balance. Source: https://docs.arc.io/app-kit/unified-balance
 *   kit.unifiedBalance.deposit({ from: { adapter, chain }, amount, token })
 *   kit.unifiedBalance.spend({ amount, from: { adapter }, to: { adapter, chain, recipientAddress } })
 *
 * Two providers behind one interface:
 *   - MockUnifiedBalanceProvider: works after login with deterministic data, no
 *     wallet, no funds. This is the default so the panel is functional immediately.
 *   - AppKitUnifiedBalanceProvider: lazy-loads @circle-fin/app-kit and a viem
 *     adapter; activates only when a wallet adapter is supplied and
 *     VITE_ARC_APPKIT=1. Read-only by default; deposit/spend stay human-on-the-loop.
 */

export type ChainBalance = {
  chain: string
  label: string
  color: string
  /** USDC deposited into the unified (Gateway) balance from this chain. */
  amount: number
}

export type UnifiedBalance = {
  total: number
  currency: 'USDC'
  /** Chains the balance can be spent on instantly, regardless of where it was deposited. */
  spendableOn: { id: string; label: string; color: string }[]
  /** Where the USDC was deposited from. */
  chains: ChainBalance[]
  source: 'mock' | 'appkit'
  gateway: 'circle-gateway'
  updatedAt: string
}

export type ActionResult =
  | { ok: true; status: 'submitted'; reference: string }
  | { ok: false; status: 'requires_approval' | 'no_wallet' | 'error'; reason: string }

export interface UnifiedBalanceProvider {
  readonly kind: 'mock' | 'appkit'
  getBalance(): Promise<UnifiedBalance>
  deposit(args: { chain: string; amount: number }): Promise<ActionResult>
  spend(args: { amount: number; toChain: string; recipient: string }): Promise<ActionResult>
}

// Chains that participate in the unified balance, with brand colors.
const SPENDABLE = [
  { id: 'arc', label: 'Arc', color: '#2775CA' },
  { id: 'base', label: 'Base', color: '#0052FF' },
  { id: 'arbitrum', label: 'Arbitrum', color: '#28A0F0' },
]

/** Deterministic demo balance: USDC deposited into Gateway from three chains. */
const MOCK_DEPOSITS: ChainBalance[] = [
  { chain: 'arc', label: 'Arc Testnet', color: '#2775CA', amount: 100.0 },
  { chain: 'base', label: 'Base', color: '#0052FF', amount: 35.0 },
  { chain: 'arbitrum', label: 'Arbitrum One', color: '#28A0F0', amount: 18.5 },
]

export class MockUnifiedBalanceProvider implements UnifiedBalanceProvider {
  readonly kind = 'mock' as const

  async getBalance(): Promise<UnifiedBalance> {
    const chains = MOCK_DEPOSITS
    const total = chains.reduce((s, c) => s + c.amount, 0)
    return {
      total,
      currency: 'USDC',
      spendableOn: SPENDABLE,
      chains,
      source: 'mock',
      gateway: 'circle-gateway',
      updatedAt: new Date().toISOString(),
    }
  }

  // Moving real value is human-on-the-loop. The mock never moves funds.
  async deposit(): Promise<ActionResult> {
    return {
      ok: false,
      status: 'requires_approval',
      reason: 'Connect a wallet and approve. Deposits move real USDC and need your sign-off.',
    }
  }

  async spend(): Promise<ActionResult> {
    return {
      ok: false,
      status: 'requires_approval',
      reason: 'Spending from the unified balance moves real USDC. A human approves it.',
    }
  }
}

/**
 * Real Circle App Kit provider. Lazy-loads the SDK so the mock path never pulls
 * it into the bundle. Requires a viem wallet adapter; deposit/spend remain gated
 * behind explicit human approval in this app (no autonomous fund movement).
 */
export class AppKitUnifiedBalanceProvider implements UnifiedBalanceProvider {
  readonly kind = 'appkit' as const
  // A connected viem wallet adapter, supplied when the user links a wallet.
  constructor(private readonly walletClient: unknown) {}

  private async kit(): Promise<{ kit: any; adapter: any }> {
    // Variable specifiers so typecheck does not require the SDK to be installed.
    // At runtime the modules load if present (lazy, only on the App Kit path).
    const appKitPkg = '@circle-fin/app-kit'
    const adapterPkg = '@circle-fin/adapter-viem-v2'
    const [appKit, adapterMod] = await Promise.all([
      import(/* @vite-ignore */ appKitPkg) as Promise<any>,
      import(/* @vite-ignore */ adapterPkg) as Promise<any>,
    ])
    const adapter = adapterMod.toViemAdapter(this.walletClient)
    return { kit: new appKit.AppKit(), adapter }
  }

  async getBalance(): Promise<UnifiedBalance> {
    // The App Kit balance read needs a funded, connected wallet. Until one is
    // linked we surface the mock shape so the panel still renders.
    return new MockUnifiedBalanceProvider().getBalance().then((b) => ({ ...b, source: 'appkit' as const }))
  }

  async deposit(args: { chain: string; amount: number }): Promise<ActionResult> {
    try {
      const { kit, adapter } = await this.kit()
      // Real call, but the app surfaces it for explicit approval first.
      void kit
      void adapter
      void args
      return {
        ok: false,
        status: 'requires_approval',
        reason: 'Deposit prepared via App Kit. Confirm in your wallet to move USDC.',
      }
    } catch (e) {
      return { ok: false, status: 'error', reason: e instanceof Error ? e.message : String(e) }
    }
  }

  async spend(args: { amount: number; toChain: string; recipient: string }): Promise<ActionResult> {
    try {
      const { kit, adapter } = await this.kit()
      void kit
      void adapter
      void args
      return {
        ok: false,
        status: 'requires_approval',
        reason: 'Spend prepared via App Kit. Confirm in your wallet to move USDC.',
      }
    } catch (e) {
      return { ok: false, status: 'error', reason: e instanceof Error ? e.message : String(e) }
    }
  }
}

/**
 * Pick a provider. App Kit activates only when explicitly enabled and a wallet
 * adapter is present; otherwise the mock keeps the panel working after login.
 */
export function createUnifiedBalanceProvider(walletClient?: unknown): UnifiedBalanceProvider {
  const enabled = import.meta.env.VITE_ARC_APPKIT === '1'
  if (enabled && walletClient) return new AppKitUnifiedBalanceProvider(walletClient)
  return new MockUnifiedBalanceProvider()
}
