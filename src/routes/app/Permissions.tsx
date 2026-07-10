import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Check,
  CreditCard,
  ExternalLink,
  Link2,
  LogOut,
  PlayCircle,
  Save,
  Shield,
  Snowflake,
} from 'lucide-react'
import { useAuth, authHeaders } from '../../store/auth'

const MCP_BASE = (import.meta.env.VITE_MCP_URL as string | undefined) ?? 'http://localhost:3399'
const short = (a: string) => (a.length > 14 ? `${a.slice(0, 8)}...${a.slice(-4)}` : a)

type Permissions = {
  dailyCapUsd: number
  autoApproveUnderUsd: number
  payeeAllowlist: string[]
  agentToAgent: boolean
  agentToHuman: boolean
  frozen: boolean
}

type Policy = {
  agentId: string
  name: string
  permissions: Permissions
  spentTodayUsd: number
  remainingTodayUsd: number
  resetsAt: string
}

type Agent = { id: string; name: string }

export default function Permissions() {
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)
  const navigate = useNavigate()

  const [agents, setAgents] = useState<Agent[]>([])
  const [agentId, setAgentId] = useState('')
  const [policy, setPolicy] = useState<Policy | null>(null)
  const [draft, setDraft] = useState<Permissions | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Live "resets in" countdown, ticking each minute.
  const [now, setNow] = useState(() => new Date().getTime())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date().getTime()), 30_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch(`${MCP_BASE}/api/platform-agents`, { signal: AbortSignal.timeout(6000) })
        const data = (await res.json()) as { agents: Agent[] }
        setAgents(data.agents)
        if (data.agents.length) setAgentId((cur) => cur || data.agents[0].id)
        else setLoading(false)
      } catch {
        setError('Permissions need the MCP server. Start the backend on :3399.')
        setLoading(false)
      }
    })()
  }, [])

  const loadPolicy = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${MCP_BASE}/api/agents/policy?agentId=${id}`, { signal: AbortSignal.timeout(6000) })
      const p = (await res.json()) as Policy
      setPolicy(p)
      setDraft(p.permissions)
      setError(null)
    } catch {
      setError('Could not load the policy.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (agentId) loadPolicy(agentId)
  }, [agentId, loadPolicy])

  const save = async () => {
    if (!draft || !agentId) return
    setSaving(true)
    setSaved(false)
    try {
      await fetch(`${MCP_BASE}/api/agents/permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ agentId, permissions: draft }),
      })
      await loadPolicy(agentId)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError('Save failed. Is the backend running?')
    } finally {
      setSaving(false)
    }
  }

  const set = <K extends keyof Permissions>(key: K, value: Permissions[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d))

  const untilReset = (iso: string) => {
    const ms = new Date(iso).getTime() - now
    if (ms <= 0) return 'now'
    const h = Math.floor(ms / 3_600_000)
    const m = Math.floor((ms % 3_600_000) / 60_000)
    return `${h}h ${m}m`
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="text-2xl font-bold tracking-tight">Permissions</h2>
      <p className="mt-1 text-sm text-ink/55">
        You are in control. Set what your agent can do, who it can pay, and how much it
        can spend per day. The policy engine enforces every rule here for real.
      </p>

      {error && (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-ink/70">
          {error}
        </div>
      )}

      {loading && !error && (
        <div className="mt-5 rounded-2xl border border-ink/10 bg-white p-8 text-center text-sm text-ink/45">
          Loading policy...
        </div>
      )}

      {!loading && !error && agents.length === 0 && (
        <div className="mt-5 rounded-2xl border border-dashed border-ink/15 bg-white p-8 text-center text-sm text-ink/55">
          No agents yet. Register one in Agent ID, then set its permissions here.
        </div>
      )}

      {policy && draft && (
        <>
          {/* Agent selector */}
          {agents.length > 1 && (
            <div className="mt-5">
              <label className="text-xs font-semibold text-ink/50">Agent</label>
              <select
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-accent"
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Daily limit status */}
          <div className="mt-5 rounded-2xl border border-ink/10 bg-white p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <CreditCard size={16} className="text-[#2775CA]" />
                Today's spending
              </div>
              <div className="text-xs text-ink/45">
                Resets at 00:00 UTC (in {untilReset(policy.resetsAt)})
              </div>
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div className="text-2xl font-bold tracking-tight text-ink">
                ${policy.spentTodayUsd.toFixed(2)}
                <span className="text-sm font-semibold text-ink/40"> / ${policy.permissions.dailyCapUsd}</span>
              </div>
              <div className="text-xs font-semibold text-emerald-600">
                ${policy.remainingTodayUsd.toFixed(2)} left today
              </div>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-ink/8">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (policy.spentTodayUsd / Math.max(1, policy.permissions.dailyCapUsd)) * 100)}%`,
                  background: policy.spentTodayUsd >= policy.permissions.dailyCapUsd ? '#EF4444' : '#2775CA',
                }}
              />
            </div>
          </div>

          {/* Spending limits (editable) */}
          <section className="mt-4 rounded-2xl border border-ink/10 bg-white p-6">
            <h3 className="mb-4 font-semibold text-ink">Spending limits</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-ink/50">Daily cap (USD)</label>
                <input
                  type="number"
                  min="0"
                  value={draft.dailyCapUsd}
                  onChange={(e) => set('dailyCapUsd', Number(e.target.value) || 0)}
                  className="mt-1 w-full rounded-xl border border-ink/10 bg-cream/40 px-3 py-2.5 text-sm outline-none focus:border-accent"
                />
                <p className="mt-1 text-[11px] text-ink/45">Total the agent may commit per day. Resets 00:00 UTC.</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink/50">Auto-approve under (USD)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={draft.autoApproveUnderUsd}
                  onChange={(e) => set('autoApproveUnderUsd', Number(e.target.value) || 0)}
                  className="mt-1 w-full rounded-xl border border-ink/10 bg-cream/40 px-3 py-2.5 text-sm outline-none focus:border-accent"
                />
                <p className="mt-1 text-[11px] text-ink/45">Payments below this settle without asking you.</p>
              </div>
            </div>
          </section>

          {/* Access controls (toggles) */}
          <section className="mt-4 rounded-2xl border border-ink/10 bg-white p-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#1AAB7A] text-white">
                <Shield size={15} />
              </div>
              <h3 className="font-semibold text-ink">Access controls</h3>
            </div>
            <ul className="divide-y divide-ink/8">
              <Row
                label="Agent-to-agent payments"
                desc="Let the agent pay other verified agents autonomously, within the limits above."
                on={draft.agentToAgent}
                onChange={() => set('agentToAgent', !draft.agentToAgent)}
              />
              <Row
                label="Agent-to-human payments"
                desc="Allow the agent to pay human wallet addresses."
                on={draft.agentToHuman}
                onChange={() => set('agentToHuman', !draft.agentToHuman)}
              />
            </ul>
          </section>

          {/* Safety */}
          <section className="mt-4 rounded-2xl border border-ink/10 bg-white p-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-red-500 text-white">
                <Snowflake size={15} />
              </div>
              <h3 className="font-semibold text-ink">Safety</h3>
            </div>
            <ul className="divide-y divide-ink/8">
              <Row
                label="Freeze all activity"
                desc="Emergency off switch. Every payment pauses for your approval until you unfreeze."
                on={draft.frozen}
                danger
                onChange={() => set('frozen', !draft.frozen)}
              />
            </ul>
          </section>

          {/* Save */}
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-50"
            >
              {saved ? <Check size={16} /> : <Save size={16} />}
              {saving ? 'Saving...' : saved ? 'Saved' : 'Save permissions'}
            </button>
            <span className="text-xs text-ink/45">Applies to every new action immediately.</span>
          </div>

          {/* On-chain policy vault — deploy this policy as a smart contract on Arc */}
          <VaultPanel agentId={agentId} />

          {/* Try a payment (live policy tester) */}
          <PolicyTester agentId={agentId} onSpent={() => loadPolicy(agentId)} />
        </>
      )}

      {/* Profile */}
      <section className="mt-6 rounded-2xl border border-ink/10 bg-white p-6">
        <h3 className="mb-4 font-semibold">Profile</h3>
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent text-lg font-bold text-white">
            {user?.name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div>
            <div className="font-semibold">{user?.name}</div>
            <div className="text-sm text-ink/55">{user?.email}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            logout()
            navigate('/')
          }}
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-5 py-3 text-sm font-semibold text-ink/80 transition-colors hover:bg-ink/5"
        >
          <LogOut size={16} />
          Log out
        </button>
      </section>
    </div>
  )
}

function Row({
  label,
  desc,
  on,
  danger,
  onChange,
}: {
  label: string
  desc: string
  on: boolean
  danger?: boolean
  onChange: () => void
}) {
  return (
    <li className="flex items-center justify-between gap-4 py-4">
      <div className="min-w-0">
        <div className={`text-sm font-medium ${danger ? 'text-red-600' : 'text-ink'}`}>{label}</div>
        <div className="mt-0.5 text-xs text-ink/50">{desc}</div>
      </div>
      <Toggle on={on} danger={danger} onChange={onChange} />
    </li>
  )
}

function Toggle({ on, danger, onChange }: { on: boolean; danger?: boolean; onChange: () => void }) {
  const activeColor = danger ? 'bg-red-500' : 'bg-accent'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? activeColor : 'bg-ink/20'}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`}
      />
    </button>
  )
}

/** Fire a real instruction through the policy engine and show the verdict. */
function PolicyTester({ agentId, onSpent }: { agentId: string; onSpent: () => void }) {
  const [amount, setAmount] = useState('10')
  const [payee, setPayee] = useState('agent://provider')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ status: string; policyNote: string } | null>(null)

  const run = async () => {
    setBusy(true)
    try {
      const res = await fetch(`${MCP_BASE}/api/instructions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ agentId, type: 'payment', amountUsd: Number(amount) || 0, payee, memo: 'policy test' }),
      })
      const ix = (await res.json()) as { status?: string; policyNote?: string; error?: string }
      setResult({ status: ix.status ?? 'error', policyNote: ix.policyNote ?? ix.error ?? '' })
      onSpent()
    } catch {
      setResult({ status: 'error', policyNote: 'Backend not reachable.' })
    } finally {
      setBusy(false)
    }
  }

  const approved = result?.status === 'auto_approved'
  const pending = result?.status === 'pending_approval'

  return (
    <section className="mt-4 rounded-2xl border border-accent/20 bg-accent/[0.04] p-6">
      <div className="mb-1 flex items-center gap-2">
        <PlayCircle size={16} className="text-accent" />
        <h3 className="font-semibold text-ink">Try a payment</h3>
      </div>
      <p className="mb-4 text-xs text-ink/55">
        Send a test payment through the real policy engine. Watch it auto-approve under your
        rules, or pause for approval once it would break the daily cap.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-[11px] font-semibold text-ink/50">Amount (USD)</label>
          <input
            type="number"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-28 rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <div className="flex-1">
          <label className="text-[11px] font-semibold text-ink/50">Payee</label>
          <input
            value={payee}
            onChange={(e) => setPayee(e.target.value)}
            className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-50"
        >
          {busy ? 'Testing...' : 'Test'}
        </button>
      </div>

      {result && (
        <div
          className={`mt-4 rounded-xl border p-3 text-sm ${
            approved
              ? 'border-emerald-200 bg-emerald-50/60 text-emerald-800'
              : pending
                ? 'border-amber-200 bg-amber-50/60 text-amber-800'
                : 'border-red-200 bg-red-50/60 text-red-700'
          }`}
        >
          <div className="flex items-center gap-1.5 font-bold">
            {approved ? <Check size={14} /> : <AlertTriangle size={14} />}
            {approved ? 'Auto-approved' : pending ? 'Paused for human approval' : 'Error'}
          </div>
          <p className="mt-0.5">{result.policyNote}</p>
        </div>
      )}
    </section>
  )
}

type VaultState = {
  vaultAddress: string | null
  dailyCapUsd?: number
  autoApproveUsd?: number
  frozen?: boolean
  spentTodayUsd?: number
  balanceUsd?: number
  explorer?: string
  error?: string
}

/**
 * Deploy the agent's policy as a real smart contract on Arc. Once live, address
 * payments settle THROUGH the vault — a payment over the cap or auto-approve line
 * reverts on-chain, not just on our server. Programmable money enforcing itself.
 */
function VaultPanel({ agentId }: { agentId: string }) {
  const [vault, setVault] = useState<VaultState | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [fund, setFund] = useState('2')
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${MCP_BASE}/api/agents/vault?agentId=${agentId}`, { signal: AbortSignal.timeout(8000) })
      setVault((await res.json()) as VaultState)
      setErr(null)
    } catch {
      setErr('Could not load vault status.')
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => {
    if (agentId) load()
  }, [agentId, load])

  const provision = async () => {
    setBusy(true)
    setErr(null)
    try {
      const res = await fetch(`${MCP_BASE}/api/agents/vault`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ agentId, fundUsd: Number(fund) || 0 }),
      })
      const j = (await res.json()) as { error?: string }
      if (j.error) setErr(j.error)
      await load()
    } catch {
      setErr('Provision failed. The backend needs a funded ARC_SIGNER_KEY.')
    } finally {
      setBusy(false)
    }
  }

  const has = !!vault?.vaultAddress

  return (
    <section className="mt-4 rounded-2xl border border-[#7342E2]/25 bg-[#7342E2]/[0.04] p-6">
      <div className="mb-1 flex items-center gap-2">
        <Link2 size={16} className="text-[#7342E2]" />
        <h3 className="font-semibold text-ink">On-chain policy vault</h3>
        {has && (
          <span className="ml-1 rounded-full bg-[#7342E2]/10 px-2 py-0.5 text-[10px] font-bold text-[#7342E2]">
            Live on Arc
          </span>
        )}
      </div>
      <p className="mb-4 text-xs text-ink/55">
        Deploy this policy as a smart contract on Arc. Once live, the agent's payments to an Arc
        address settle <b>through the vault</b> — anything over the cap or auto-approve line
        reverts on-chain, not just on our server. Programmable money enforcing itself.
      </p>

      {loading ? (
        <div className="text-xs text-ink/45">Loading vault status...</div>
      ) : has ? (
        <div className="space-y-3">
          <a
            href={vault!.explorer}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-[#7342E2] hover:underline"
          >
            {short(vault!.vaultAddress!)} <ExternalLink size={11} />
          </a>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Daily cap" value={`$${vault!.dailyCapUsd}`} />
            <Stat label="Auto-approve" value={`$${vault!.autoApproveUsd}`} />
            <Stat label="Spent today" value={`$${vault!.spentTodayUsd?.toFixed(2) ?? '0.00'}`} />
            <Stat label="Vault balance" value={`$${vault!.balanceUsd?.toFixed(2) ?? '0.00'}`} />
          </div>
          {vault!.frozen && (
            <div className="text-xs font-semibold text-red-600">Frozen on-chain — the agent cannot spend.</div>
          )}
          <p className="text-[11px] text-ink/45">
            The contract enforces the same limits set above. Address payments now settle through it.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-[11px] font-semibold text-ink/50">Fund with (USDC)</label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={fund}
              onChange={(e) => setFund(e.target.value)}
              className="mt-1 w-28 rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm outline-none focus:border-[#7342E2]"
            />
          </div>
          <button
            type="button"
            onClick={provision}
            disabled={busy}
            className="rounded-full bg-[#7342E2] px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-50"
          >
            {busy ? 'Deploying on Arc...' : 'Provision on-chain vault'}
          </button>
        </div>
      )}
      {err && <div className="mt-3 text-xs text-red-600">{err}</div>}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ink/8 bg-white px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-ink/40">{label}</div>
      <div className="mt-0.5 text-sm font-bold text-ink">{value}</div>
    </div>
  )
}
