import { useCallback, useEffect, useState } from 'react'
import { ArrowUpRight, CheckCircle2, Clock, ExternalLink, Link2, Send, ShieldQuestion, Wallet } from 'lucide-react'
import { authHeaders } from '../../store/auth'
import X402Panel from '../../components/app/X402Panel'

import { MCP_BASE } from '../../lib/mcpBase'

type Status =
  | 'auto_approved'
  | 'pending_approval'
  | 'approved'
  | 'executed_simulated'
  | 'executed_onchain'
  | 'rejected'

type Instruction = {
  id: string
  agentId: string
  type: string
  amountUsd: number
  count: number
  payee: string
  memo: string
  status: Status
  policyNote: string
  txHash?: string
  explorerUrl?: string
  enforcedBy?: 'server' | 'circle-agent-stack' | 'onchain-vault'
  createdAt: string
}

type Agent = { id: string; name: string }

const short = (a: string) => (a.length > 14 ? `${a.slice(0, 8)}...${a.slice(-4)}` : a)

export default function Settlements() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [agentId, setAgentId] = useState('')
  const [items, setItems] = useState<Instruction[]>([])
  const [amount, setAmount] = useState('0.01')
  const [payee, setPayee] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch(`${MCP_BASE}/api/platform-agents`, { signal: AbortSignal.timeout(6000) })
        const data = (await res.json()) as { agents: Agent[] }
        setAgents(data.agents)
        if (data.agents.length) setAgentId((cur) => cur || data.agents[0].id)
        else setLoading(false)
      } catch {
        setError('Settlements need the MCP server on :3399.')
        setLoading(false)
      }
    })()
  }, [])

  const load = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${MCP_BASE}/api/instructions?agentId=${id}`, { signal: AbortSignal.timeout(6000) })
      const data = (await res.json()) as { instructions: Instruction[] }
      setItems([...data.instructions].reverse())
      setError(null)
    } catch {
      setError('Could not load settlements.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (agentId) load(agentId)
  }, [agentId, load])

  const createPayment = async () => {
    if (!agentId) return
    setBusy('create')
    try {
      await fetch(`${MCP_BASE}/api/instructions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          agentId,
          type: 'payment',
          amountUsd: Number(amount) || 0,
          payee: payee.trim() || 'agent://provider',
        }),
      })
      setPayee('')
      await load(agentId)
    } catch {
      setError('Could not create the payment.')
    } finally {
      setBusy(null)
    }
  }

  const act = async (path: 'approve' | 'execute', id: string) => {
    setBusy(id)
    try {
      await fetch(`${MCP_BASE}/api/instructions/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ id }),
      })
      await load(agentId)
    } catch {
      setError(`Could not ${path} the payment.`)
    } finally {
      setBusy(null)
    }
  }

  const settledOnchain = items.filter((i) => i.status === 'executed_onchain').length

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="text-2xl font-bold tracking-tight">Settlements</h2>
      <p className="mt-1 text-sm text-ink/55">
        Every payment your agent makes runs through the policy engine, then settles in real
        USDC on Arc. Pay a 0x… address or another agent (agent://&lt;agentId&gt;) — both move real
        testnet funds.
      </p>

      {error && (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-ink/70">{error}</div>
      )}

      {!loading && agents.length === 0 && !error && (
        <div className="mt-5 rounded-2xl border border-dashed border-ink/15 bg-white p-8 text-center text-sm text-ink/55">
          No agents yet. Register one in Agent ID first.
        </div>
      )}

      {agents.length > 0 && (
        <>
          {/* New payment */}
          <div className="mt-6 rounded-2xl border border-ink/10 bg-white p-6">
            <h3 className="font-semibold text-ink">New payment</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
              {agents.length > 1 && (
                <select
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  className="rounded-xl border border-ink/10 bg-cream/40 px-3 py-2.5 text-sm outline-none focus:border-accent sm:col-span-2"
                >
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              )}
              <input
                value={payee}
                onChange={(e) => setPayee(e.target.value)}
                placeholder="Payee: 0x… address or agent://<agentId> (both settle for real)"
                className="rounded-xl border border-ink/10 bg-cream/40 px-3 py-2.5 font-mono text-xs outline-none focus:border-accent"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-24 rounded-xl border border-ink/10 bg-cream/40 px-3 py-2.5 text-sm outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={createPayment}
                  disabled={busy === 'create'}
                  className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-50"
                >
                  <Send size={14} />
                  {busy === 'create' ? '...' : 'Pay'}
                </button>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-ink/45">
              USDC. The policy engine decides: auto-approve, or pause for your approval. Small
              amounts (e.g. 0.01) keep the demo wallet alive.
            </p>
          </div>

          {/* Human-on-the-loop */}
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-accent/20 bg-accent/[0.05] p-4">
            <ShieldQuestion size={18} className="mt-0.5 shrink-0 text-accent" />
            <p className="text-sm text-ink/70">
              Payments above your limits pause here for approval. Nothing settles on-chain until
              it is approved and executed. {settledOnchain > 0 && <b>{settledOnchain} settled on Arc.</b>}
            </p>
          </div>

          {/* List */}
          <ul className="mt-4 flex flex-col gap-2.5">
            {items.map((ix) => (
              <li key={ix.id} className="rounded-2xl border border-ink/10 bg-white p-4">
                <div className="flex items-center gap-4">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#7342E2] text-white">
                    <ArrowUpRight size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-mono text-xs text-ink">{short(ix.payee)}</span>
                      <StatusPill status={ix.status} />
                      {ix.enforcedBy === 'onchain-vault' && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#7342E2]/10 px-2 py-0.5 text-[10px] font-bold text-[#7342E2]">
                          <Link2 size={10} /> On-chain policy
                        </span>
                      )}
                      {ix.enforcedBy === 'circle-agent-stack' && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#2775CA]/10 px-2 py-0.5 text-[10px] font-bold text-[#2775CA]">
                          <Wallet size={10} /> Circle Agent Wallet
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-ink/50">{ix.policyNote}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-ink">
                      {(ix.amountUsd * ix.count).toFixed(ix.amountUsd < 0.01 ? 4 : 2)}{' '}
                      <span className="text-xs font-semibold text-[#2775CA]">USDC</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-3 flex items-center justify-end gap-2 border-t border-ink/8 pt-3">
                  {ix.status === 'pending_approval' && (
                    <button
                      type="button"
                      onClick={() => act('approve', ix.id)}
                      disabled={busy === ix.id}
                      className="rounded-full border border-accent/30 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/5 disabled:opacity-50"
                    >
                      {busy === ix.id ? '...' : 'Approve'}
                    </button>
                  )}
                  {(ix.status === 'approved' || ix.status === 'auto_approved') && (
                    <button
                      type="button"
                      onClick={() => act('execute', ix.id)}
                      disabled={busy === ix.id}
                      className="rounded-full bg-[#2775CA] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {busy === ix.id ? 'Settling on Arc...' : 'Execute'}
                    </button>
                  )}
                  {ix.status === 'executed_onchain' && ix.explorerUrl && (
                    <a
                      href={ix.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#2775CA] hover:underline"
                    >
                      View on arcscan <ExternalLink size={11} />
                    </a>
                  )}
                  {ix.status === 'executed_simulated' && (
                    <span className="text-xs text-ink/40">Simulated (payee not an Arc address)</span>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {!loading && items.length === 0 && (
            <div className="mt-4 rounded-2xl border border-dashed border-ink/15 bg-white/50 p-8 text-center text-sm text-ink/50">
              No payments yet. Create one above to see the policy engine and on-chain settlement.
            </div>
          )}
        </>
      )}

      <X402Panel />
    </div>
  )
}

function StatusPill({ status }: { status: Status }) {
  const map: Record<Status, { label: string; cls: string; icon?: 'ok' | 'wait' }> = {
    auto_approved: { label: 'Auto-approved', cls: 'bg-emerald-100 text-emerald-700', icon: 'ok' },
    pending_approval: { label: 'Pending approval', cls: 'bg-amber-100 text-amber-700', icon: 'wait' },
    approved: { label: 'Approved', cls: 'bg-[#2775CA]/10 text-[#2775CA]', icon: 'ok' },
    executed_onchain: { label: 'Settled on Arc', cls: 'bg-emerald-100 text-emerald-700', icon: 'ok' },
    executed_simulated: { label: 'Simulated', cls: 'bg-ink/8 text-ink/50' },
    rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-700' },
  }
  const s = map[status]
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${s.cls}`}>
      {s.icon === 'ok' && <CheckCircle2 size={10} />}
      {s.icon === 'wait' && <Clock size={10} />}
      {s.label}
    </span>
  )
}
