import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createUnifiedBalanceProvider,
  type ActionResult,
  type UnifiedBalance,
} from '../lib/unified-balance'

type State = {
  loading: boolean
  balance: UnifiedBalance | null
  error: string | null
}

/**
 * Loads the agent's Unified Balance (Circle App Kit / Gateway). Works after
 * login with the mock provider; switches to the real App Kit provider when a
 * wallet adapter is supplied and VITE_ARC_APPKIT=1.
 */
export function useUnifiedBalance(walletClient?: unknown) {
  const provider = useMemo(() => createUnifiedBalanceProvider(walletClient), [walletClient])
  const [state, setState] = useState<State>({ loading: true, balance: null, error: null })

  const load = useCallback(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true }))
    provider
      .getBalance()
      .then((balance) => {
        if (!cancelled) setState({ loading: false, balance, error: null })
      })
      .catch((e) => {
        if (!cancelled)
          setState({ loading: false, balance: null, error: e instanceof Error ? e.message : String(e) })
      })
    return () => {
      cancelled = true
    }
  }, [provider])

  useEffect(() => load(), [load])

  const deposit = useCallback(
    (args: { chain: string; amount: number }): Promise<ActionResult> => provider.deposit(args),
    [provider],
  )

  const spend = useCallback(
    (args: { amount: number; toChain: string; recipient: string }): Promise<ActionResult> =>
      provider.spend(args),
    [provider],
  )

  return { ...state, source: provider.kind, reload: load, deposit, spend }
}
