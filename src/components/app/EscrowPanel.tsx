import { useState } from 'react'
import { Boxes, CheckCircle2, ExternalLink, Loader2, ArrowRight } from 'lucide-react'
import { apiFetch } from '../../lib/api'
import { authHeaders } from '../../store/auth'

type Step = { step: string; txHash: string; explorerUrl: string }
type Result =
  | { executed: false; reason: string; lifecycle: string[] }
  | { executed: true; jobId: string; budgetUsd: number; steps: Step[]; status: string; failedAt?: string; reason?: string }

const LIFECYCLE = ['createJob', 'setBudget', 'approve(USDC)', 'fund', 'submit', 'complete']

/**
 * One-click ERC-8183 escrow demo: an agent hires an agent, USDC is escrowed on Arc
 * and released on delivery. Hits POST /api/arc/job-demo, which runs the full
 * create → setBudget → approve → fund → submit → complete lifecycle (6 real txs).
 */
export default function EscrowPanel() {
  const [budget, setBudget] = useState('0.02')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const res = await apiFetch('/api/arc/job-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ budgetUsd: Number(budget) || 0.02 }),
        timeoutMs: 150_000, // 6 real on-chain txs back-to-back
      })
      if (res.status === 401 || res.status === 403) {
        setError('Sign in with a wallet or email link to run a real escrow job (guests are read-only).')
        return
      }
      setResult((await res.json()) as Result)
    } catch {
      setError('Could not run the escrow job (the backend may be waking up, try again).')
    } finally {
      setBusy(false)
    }
  }

  const settled = result?.executed && result.status === 'Completed' && !result.failedAt

  return (
    <div className="mt-8 rounded-2xl border border-ink/10 bg-white p-6">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#7342E2]/10 text-[#7342E2]">
          <Boxes size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-ink">Agent-to-agent escrow (ERC-8183)</h3>
          <p className="mt-0.5 text-sm text-ink/55">
            One click runs the full on-chain job: an agent hires an agent, USDC is held in escrow on
            Arc and released on delivery: create → fund → submit → complete, all real txs.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="text-xs font-semibold text-ink/50">Budget</label>
        <div className="flex items-center gap-1 rounded-xl border border-ink/10 bg-cream/40 px-3 py-2">
          <span className="text-sm text-ink/50">$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            className="w-20 bg-transparent text-sm outline-none"
          />
          <span className="text-xs font-semibold text-[#2775CA]">USDC</span>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-50"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
          {busy ? 'Running lifecycle' : 'Run escrow job'}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-ink/70">{error}</div>
      )}

      {result && result.executed === false && (
        <div className="mt-4 rounded-xl border border-ink/10 bg-cream/40 p-3 text-sm text-ink/70">
          Prepared (no signer configured on the server): {result.reason}
        </div>
      )}

      {result && result.executed && (
        <div className="mt-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-ink/60">
              Job <span className="font-mono font-semibold text-ink">#{result.jobId}</span> · ${result.budgetUsd} USDC
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                settled ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}
            >
              {settled && <CheckCircle2 size={12} />}
              {result.status}
            </span>
          </div>

          <ol className="mt-3 flex flex-col gap-1.5">
            {LIFECYCLE.map((name) => {
              const s = result.steps.find((x) => x.step === name)
              const failedHere = result.failedAt === name
              return (
                <li
                  key={name}
                  className="flex items-center gap-3 rounded-lg border border-ink/8 bg-cream/40 px-3 py-2 text-sm"
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      s ? 'bg-emerald-500' : failedHere ? 'bg-red-500' : 'bg-ink/20'
                    }`}
                  />
                  <span className="font-mono text-xs text-ink/70">{name}</span>
                  <span className="ml-auto">
                    {s ? (
                      <a
                        href={s.explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-accent hover:underline"
                      >
                        tx <ExternalLink size={9} />
                      </a>
                    ) : failedHere ? (
                      <span className="text-[11px] font-semibold text-red-500">reverted</span>
                    ) : (
                      <span className="text-[11px] text-ink/30">-</span>
                    )}
                  </span>
                </li>
              )
            })}
          </ol>
          {result.failedAt && (
            <p className="mt-2 text-xs text-red-600">Reverted at {result.failedAt}: {result.reason}</p>
          )}
        </div>
      )}
    </div>
  )
}
