import { useState } from 'react'
import { Bot, CheckCircle2, Loader2, Hand, Coins } from 'lucide-react'
import { MCP_BASE } from '../../lib/mcpBase'
import { authHeaders } from '../../store/auth'

type Payment = { n: number; amountUsd: number; cumulativeUsd: number; ok: boolean; transaction?: string; reason?: string }
type Result =
  | { executed: false; reason: string }
  | {
      executed: true
      service: string
      treasury: string
      feeBps: number
      budgetUsd: number
      amountUsd: number
      payments: Payment[]
      settledCount: number
      volumeUsd: number
      stoppedReason: 'budget-reached' | 'max-calls' | 'settlement-error'
      pausedForHuman: boolean
      protocolFee: { accruedUsd: number; settled: boolean; transaction?: string; note?: string }
    }

/**
 * Autonomous agent run. A human sets a budget once; the agent then pays a service on
 * its OWN, a burst of real gasless nanopayments (pay-per-inference / streaming),
 * and stops itself when the next payment would breach the budget (bounded authority,
 * live). Each settlement accrues a protocol fee routed to the treasury. Hits
 * POST /api/arc/agent-run.
 */
export default function AutopilotPanel() {
  const [budget, setBudget] = useState('0.02')
  const [amount, setAmount] = useState('0.005')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch(`${MCP_BASE}/api/arc/agent-run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ amountUsd: Number(amount) || 0.005, budgetUsd: Number(budget) || 0.02, maxCalls: 6 }),
        signal: AbortSignal.timeout(180000),
      })
      if (res.status === 401 || res.status === 403) {
        setError('Sign in with a wallet or email link to run the agent (guests are read-only).')
        return
      }
      setResult((await res.json()) as Result)
    } catch {
      setError('Could not run the agent (the backend may be waking up, try again).')
    } finally {
      setBusy(false)
    }
  }

  const short = (a?: string) => (a ? `${a.slice(0, 6)}...${a.slice(-4)}` : '-')

  return (
    <div className="mt-8 rounded-2xl border-2 border-accent/30 bg-accent/[0.03] p-6">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">
          <Bot size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-ink">Autonomous agent run</h3>
          <p className="mt-0.5 text-sm text-ink/55">
            Set a budget once, then the agent runs <b>on its own</b>: a burst of real gasless
            nanopayments to a service (pay-per-inference), stopping <b>itself</b> the moment the
            next payment would breach your budget. A protocol fee is routed to the treasury on each run.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <Field label="Budget (agent stops itself here)" value={budget} onChange={setBudget} step="0.005" />
        <Field label="Per call" value={amount} onChange={setAmount} step="0.001" />
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-50"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Bot size={15} />}
          {busy ? 'Agent running' : 'Run the agent'}
        </button>
      </div>

      {error && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-ink/70">{error}</div>}

      {result && result.executed === false && (
        <div className="mt-4 rounded-xl border border-ink/10 bg-cream/40 p-3 text-sm text-ink/70">
          Prepared (no signer configured on the server): {result.reason}
        </div>
      )}

      {result && result.executed && (
        <div className="mt-4 space-y-2 text-sm">
          <div className="text-xs font-semibold text-ink/45">
            Agent paid {short(result.service)} autonomously · {result.settledCount} payments · volume{' '}
            {result.volumeUsd} USDC
          </div>
          {result.payments.map((p) => (
            <div
              key={p.n}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                p.ok ? 'border-emerald-200 bg-emerald-50/60' : 'border-red-200 bg-red-50/60'
              }`}
            >
              {p.ok ? (
                <CheckCircle2 size={13} className="shrink-0 text-emerald-500" />
              ) : (
                <span className="shrink-0 text-red-500">✕</span>
              )}
              <span className="text-ink/75">
                Payment #{p.n}: ${p.amountUsd.toFixed(3)}
              </span>
              <span className="text-xs text-ink/45">cumulative ${p.cumulativeUsd.toFixed(3)}</span>
              {p.transaction && <span className="ml-auto font-mono text-[10px] text-ink/40">batch {p.transaction.slice(0, 8)}...</span>}
              {p.reason && <span className="ml-auto text-[11px] text-red-600">{p.reason}</span>}
            </div>
          ))}

          {result.pausedForHuman && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50/70 px-3 py-2 text-amber-800">
              <Hand size={14} className="shrink-0" />
              <span>
                <b>Bounded authority:</b> the agent hit your ${result.budgetUsd} budget and stopped itself.
                Further spend now needs a human.
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 rounded-lg border border-[#2775CA]/25 bg-[#2775CA]/[0.05] px-3 py-2 text-ink/75">
            <Coins size={14} className="shrink-0 text-[#2775CA]" />
            <span>
              Protocol fee <b>{result.protocolFee.accruedUsd} USDC</b> ({result.feeBps} bps) →{' '}
              {short(result.treasury)}
              {result.protocolFee.settled ? ', settled' : result.protocolFee.note ? `, ${result.protocolFee.note}` : ''}
            </span>
            {result.protocolFee.settled && result.protocolFee.transaction && (
              <span className="ml-auto font-mono text-[10px] text-ink/40">batch {result.protocolFee.transaction.slice(0, 8)}...</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, step }: { label: string; value: string; onChange: (v: string) => void; step: string }) {
  return (
    <div>
      <label className="text-xs font-semibold text-ink/50">{label}</label>
      <div className="mt-1 flex items-center gap-1 rounded-xl border border-ink/10 bg-white px-3 py-2">
        <span className="text-sm text-ink/50">$</span>
        <input
          type="number"
          min="0"
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-20 bg-transparent text-sm outline-none"
        />
        <span className="text-xs font-semibold text-accent">USDC</span>
      </div>
    </div>
  )
}
