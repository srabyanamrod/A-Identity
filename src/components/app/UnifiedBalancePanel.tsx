import { useState } from 'react'
import {
  ArrowDownToLine,
  Layers,
  RefreshCw,
  Send,
  ShieldQuestion,
  Sparkles,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { useUnifiedBalance } from '../../hooks/useUnifiedBalance'
import { ARC_TESTNET } from '../../lib/arc'
import type { ActionResult } from '../../lib/unified-balance'

/**
 * Unified Balance panel (Circle App Kit / Gateway). Shows the chain-abstracted
 * USDC balance and where it came from, with deposit and spend flows that stay
 * human-on-the-loop. Renders and works immediately after login.
 */
export default function UnifiedBalancePanel() {
  const { loading, balance, error, source, reload, deposit, spend } = useUnifiedBalance()
  const [flow, setFlow] = useState<null | 'deposit' | 'spend'>(null)
  const [result, setResult] = useState<ActionResult | null>(null)

  const isAppKit = source === 'appkit'

  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent/10 text-accent">
            <Layers size={18} />
          </div>
          <div>
            <h3 className="font-semibold text-ink">Unified balance</h3>
            <p className="text-xs text-ink/50">One USDC balance, spendable across chains</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              isAppKit ? 'bg-emerald-100 text-emerald-700' : 'bg-ink/8 text-ink/55'
            }`}
          >
            {isAppKit ? <Wifi size={11} /> : <WifiOff size={11} />}
            {isAppKit ? 'App Kit live' : 'Preview'}
          </span>
          <button
            type="button"
            onClick={() => reload()}
            className="grid h-7 w-7 place-items-center rounded-lg text-ink/40 transition-colors hover:bg-ink/5"
            aria-label="Refresh balance"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Balance hero */}
      <div
        className="mt-4 overflow-hidden rounded-xl p-5 text-white"
        style={{ background: 'linear-gradient(135deg, #2775CA 0%, #1A4F8C 100%)' }}
      >
        <div className="flex items-center gap-1.5 text-xs font-semibold opacity-80">
          <Sparkles size={13} />
          Powered by Circle App Kit + Gateway
        </div>
        <div className="mt-2 text-3xl font-bold tracking-tight">
          {loading ? (
            <span className="opacity-50">...</span>
          ) : balance ? (
            <>
              ${balance.total.toFixed(2)} <span className="text-lg font-semibold opacity-70">USDC</span>
            </>
          ) : (
            <span className="opacity-50">unavailable</span>
          )}
        </div>
        {balance && (
          <div className="mt-1 text-xs opacity-70">
            Instantly spendable on{' '}
            {balance.spendableOn.map((c, i) => (
              <span key={c.id} className="font-semibold">
                {c.label}
                {i < balance.spendableOn.length - 1 ? ', ' : ''}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Per-chain breakdown */}
      {balance && (
        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold text-ink/45">Deposited from</div>
          <div className="flex flex-col gap-2">
            {balance.chains.map((c) => {
              const pct = balance.total > 0 ? Math.round((c.amount / balance.total) * 100) : 0
              return (
                <div key={c.chain} className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                  <span className="w-24 shrink-0 text-sm font-medium text-ink/70">{c.label}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/8">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.color }} />
                  </div>
                  <span className="w-16 shrink-0 text-right text-sm font-semibold text-ink">
                    {c.amount.toFixed(2)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-xs text-red-500">Could not load balance: {error}</p>}

      {/* Actions */}
      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={() => { setFlow('deposit'); setResult(null) }}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
        >
          <ArrowDownToLine size={15} />
          Deposit
        </button>
        <button
          type="button"
          onClick={() => { setFlow('spend'); setResult(null) }}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-ink/15 px-4 py-2.5 text-sm font-semibold text-ink/80 transition-colors hover:bg-ink/5"
        >
          <Send size={15} />
          Spend
        </button>
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-ink/40">
        <span className="font-mono">{ARC_TESTNET.name}</span>
        <span>-</span>
        <span>gas paid in {ARC_TESTNET.gasToken}</span>
        <span>-</span>
        <span>chainId {ARC_TESTNET.id}</span>
      </div>

      {/* Flow modal */}
      {flow && (
        <UnifiedFlowModal
          mode={flow}
          spendableOn={balance?.spendableOn ?? []}
          onClose={() => setFlow(null)}
          onSubmit={async (args) => {
            const r =
              flow === 'deposit'
                ? await deposit({ chain: args.chain, amount: args.amount })
                : await spend({ amount: args.amount, toChain: args.chain, recipient: args.recipient })
            setResult(r)
          }}
          result={result}
        />
      )}
    </div>
  )
}

function UnifiedFlowModal({
  mode,
  spendableOn,
  onClose,
  onSubmit,
  result,
}: {
  mode: 'deposit' | 'spend'
  spendableOn: { id: string; label: string; color: string }[]
  onClose: () => void
  onSubmit: (args: { chain: string; amount: number; recipient: string }) => Promise<void>
  result: ActionResult | null
}) {
  const chains = spendableOn.length ? spendableOn : [{ id: 'arc', label: 'Arc', color: '#2775CA' }]
  const [chain, setChain] = useState(chains[0].id)
  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const input =
    'w-full rounded-xl border border-ink/10 bg-cream/40 px-3 py-2.5 text-sm outline-none transition-colors focus:border-accent'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-ink/10 bg-white p-6 shadow-xl">
        <h3 className="font-semibold text-ink">
          {mode === 'deposit' ? 'Deposit to unified balance' : 'Spend from unified balance'}
        </h3>
        <p className="mt-1 text-sm text-ink/55">
          {mode === 'deposit'
            ? 'Move USDC from a chain into your chain-abstracted Gateway balance.'
            : 'Spend your unified USDC on any supported chain, in one step.'}
        </p>

        <div className="mt-5 flex flex-col gap-3">
          <label className="text-xs font-semibold text-ink/50">
            {mode === 'deposit' ? 'From chain' : 'To chain'}
          </label>
          <select className={input} value={chain} onChange={(e) => setChain(e.target.value)}>
            {chains.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>

          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Amount in USDC (e.g. 25.00)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={input}
          />

          {mode === 'spend' && (
            <input
              type="text"
              placeholder="Recipient address (0x...)"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className={input}
            />
          )}
        </div>

        {/* Human-on-the-loop gate result */}
        {result && (
          <div
            className={`mt-4 flex items-start gap-2 rounded-xl p-3 text-sm ${
              result.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-accent/[0.06] text-ink/70'
            }`}
          >
            <ShieldQuestion size={16} className="mt-0.5 shrink-0 text-accent" />
            <span>{result.ok ? `Submitted (ref ${result.reference})` : result.reason}</span>
          </div>
        )}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-ink/15 py-2.5 text-sm font-semibold text-ink/70 transition-colors hover:bg-ink/5"
          >
            Close
          </button>
          <button
            type="button"
            disabled={submitting || !amount}
            onClick={async () => {
              setSubmitting(true)
              await onSubmit({ chain, amount: Number(amount), recipient })
              setSubmitting(false)
            }}
            className="flex-1 rounded-full bg-accent py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-50"
          >
            {submitting ? 'Preparing...' : mode === 'deposit' ? 'Prepare deposit' : 'Prepare spend'}
          </button>
        </div>
      </div>
    </div>
  )
}
