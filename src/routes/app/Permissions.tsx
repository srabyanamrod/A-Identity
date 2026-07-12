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
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { useAuth, authHeaders } from '../../store/auth'

import { MCP_BASE } from '../../lib/mcpBase'
import { fetchPlatformAgents } from '../../lib/platformAgents'
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

/** Result of pushing the saved limits onto the agent's on-chain policy vault. */
type VaultSyncNote = {
  synced: boolean
  ownerGated?: boolean
  reason?: string
  note?: string
  txs?: { setPolicy?: string; setFrozen?: string }
}

const ARCSCAN_TX = 'https://testnet.arcscan.app/tx/'

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
  const [vaultSync, setVaultSync] = useState<VaultSyncNote | null>(null)

  // Live "resets in" countdown, ticking each minute.
  const [now, setNow] = useState(() => new Date().getTime())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date().getTime()), 30_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const data = await fetchPlatformAgents<Agent>()
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
    setVaultSync(null)
    try {
      const res = await fetch(`${MCP_BASE}/api/agents/permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ agentId, permissions: draft }),
      })
      // When the agent has an on-chain vault, the backend reports whether it pushed
      // the new limits on-chain (or that the owner must sign the change).
      const j = (await res.json().catch(() => null)) as { agent?: { vaultSync?: VaultSyncNote } } | null
      if (j?.agent?.vaultSync) setVaultSync(j.agent.vaultSync)
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

          {/* On-chain vault sync outcome (only when the agent has a deployed vault) */}
          {vaultSync && (
            <div
              className={`mt-3 rounded-xl border px-4 py-3 text-xs ${
                vaultSync.synced
                  ? 'border-[#7342E2]/25 bg-[#7342E2]/[0.05] text-ink/70'
                  : 'border-amber-400/40 bg-amber-50 text-amber-800'
              }`}
            >
              {vaultSync.synced ? (
                <span>
                  {vaultSync.note ?? 'New limits pushed to the on-chain policy vault.'}
                  {vaultSync.txs?.setPolicy && (
                    <>
                      {' '}
                      <a
                        href={`${ARCSCAN_TX}${vaultSync.txs.setPolicy}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-[#7342E2] hover:underline"
                      >
                        View setPolicy tx →
                      </a>
                    </>
                  )}
                </span>
              ) : (
                <span>{vaultSync.reason ?? 'Could not sync the on-chain vault.'}</span>
              )}
            </div>
          )}

          {/* Onchain policy vault: deploy this policy as a smart contract on Arc */}
          <VaultPanel agentId={agentId} />

          {/* Circle Agent Wallet: the hosted wallet layer enforcement */}
          <CircleWalletPanel agentId={agentId} />

          {/* Treasury: idle balance auto yield into USYC (Circle's yield bearing token) */}
          <TreasuryPanel agentId={agentId} />

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
          <div className="min-w-0">
            <div className="truncate font-semibold">{user?.name}</div>
            <div className="truncate text-sm text-ink/55">{user?.email}</div>
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
 * payments settle THROUGH the vault. A payment over the cap or auto-approve line
 * reverts onchain, not just on our server. Programmable money enforcing itself.
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
    <section className="mt-4 overflow-hidden rounded-2xl border border-[#7342E2]/25 bg-gradient-to-b from-[#7342E2]/[0.06] to-white p-6 shadow-[0_1px_3px_rgba(16,24,40,0.04)] sm:p-7">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#7342E2] text-white">
          <Link2 size={16} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-semibold text-ink">Onchain Policy Vault</h3>
            {has && (
              <span className="rounded-full bg-[#7342E2]/10 px-2 py-0.5 text-[10px] font-semibold text-[#7342E2]">
                Live on Arc
              </span>
            )}
          </div>
          <p className="text-[11px] text-ink/50">Your policy, enforced by a smart contract</p>
        </div>
      </div>
      <p className="mt-3 mb-4 text-xs text-ink/55">
        Deploy this policy as a smart contract on Arc. Once live, the agent's payments to an Arc
        address settle <b>through the vault</b>. Anything over the cap or auto-approve line
        reverts onchain, not just on our server. Programmable money enforcing itself.
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
            <Stat label="Daily Cap" value={`$${vault!.dailyCapUsd}`} />
            <Stat label="Auto Approve" value={`$${vault!.autoApproveUsd}`} />
            <Stat label="Spent Today" value={`$${vault!.spentTodayUsd?.toFixed(2) ?? '0.00'}`} />
            <Stat label="Vault Balance" value={`$${vault!.balanceUsd?.toFixed(2) ?? '0.00'}`} />
          </div>
          {vault!.frozen && (
            <div className="text-xs font-semibold text-red-600">Frozen onchain. The agent cannot spend.</div>
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
    <div className="rounded-2xl border border-black/[0.06] bg-white px-4 py-3">
      <div className="text-[11px] font-medium text-ink/45">{label}</div>
      <div className="mt-0.5 text-base font-semibold tracking-tight text-ink tabular-nums">{value}</div>
    </div>
  )
}

type CircleWalletState = {
  circleWalletId: string | null
  circleWalletAddress?: string | null
  configured?: boolean
  walletAddress?: string | null
  blockchain?: string | null
  state?: string | null
  balances?: { amount: string; symbol?: string; tokenAddress?: string }[]
  explorer?: string | null
  reason?: string
  error?: string
}

/**
 * Provision a Circle Agent Wallet for the agent: the hosted wallet layer enforcement
 * layer that complements the on-chain vault. The agent's USDC lives in a Circle-managed
 * wallet on Arc whose hosted policy engine SCREENS every transfer (sanctions, address
 * allow/block, freeze). Precise by design: Circle screens at the wallet layer; the spend
 * cap stays on our server + the on-chain vault. Credential-gated behind Circle keys.
 */
function CircleWalletPanel({ agentId }: { agentId: string }) {
  const [wallet, setWallet] = useState<CircleWalletState | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${MCP_BASE}/api/agents/circle-wallet?agentId=${agentId}`, {
        signal: AbortSignal.timeout(12000),
      })
      setWallet((await res.json()) as CircleWalletState)
      setErr(null)
    } catch {
      setErr('Could not load Circle wallet status.')
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
      const res = await fetch(`${MCP_BASE}/api/agents/circle-wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ agentId, fund: true }),
      })
      const j = (await res.json()) as { error?: string }
      if (j.error) setErr(j.error)
      await load()
    } catch {
      setErr('Provision failed. The backend needs CIRCLE_API_KEY + CIRCLE_ENTITY_SECRET.')
    } finally {
      setBusy(false)
    }
  }

  const has = !!wallet?.circleWalletId
  const addr = wallet?.circleWalletAddress ?? wallet?.walletAddress ?? null
  const usdc = wallet?.balances?.find((b) => (b.symbol ?? '').toUpperCase().includes('USDC'))

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-[#2775CA]/25 bg-gradient-to-b from-[#2775CA]/[0.06] to-white p-6 shadow-[0_1px_3px_rgba(16,24,40,0.04)] sm:p-7">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#2775CA] text-white">
          <Wallet size={16} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-semibold text-ink">Circle Agent Wallet</h3>
            {has && (
              <span className="rounded-full bg-[#2775CA]/10 px-2 py-0.5 text-[10px] font-semibold text-[#2775CA]">
                Live on Arc
              </span>
            )}
          </div>
          <p className="text-[11px] text-ink/50">A Circle managed wallet, screened at the wallet layer</p>
        </div>
      </div>
      <p className="mb-4 text-xs text-ink/55">
        Give the agent a <b>Circle-managed wallet</b> on Arc. Circle's hosted policy engine screens
        every transfer at the <b>wallet layer</b> (sanctions, address allow and block, and freeze) and
        settles real USDC. It complements the onchain vault: the server sets the spend cap, Circle
        screens at the wallet layer, and the vault enforces it trustlessly onchain.
      </p>

      {loading ? (
        <div className="text-xs text-ink/45">Loading Circle wallet status...</div>
      ) : has ? (
        <div className="space-y-3">
          {addr && (
            <a
              href={wallet?.explorer ?? `https://testnet.arcscan.app/address/${addr}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-[#2775CA] hover:underline"
            >
              {short(addr)} <ExternalLink size={11} />
            </a>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Wallet State" value={wallet?.state ?? (wallet?.configured === false ? 'Keys off' : 'Not set')} />
            <Stat label="USDC Balance" value={usdc ? `$${Number(usdc.amount).toFixed(2)}` : 'Not set'} />
            <Stat label="Network" value={wallet?.blockchain ?? 'ARC-TESTNET'} />
          </div>
          {wallet?.configured === false && wallet?.reason && (
            <p className="text-[11px] text-ink/45">
              Wallet stored; live balance needs Circle keys on the backend. {wallet.reason}
            </p>
          )}
          <p className="text-[11px] text-ink/45">
            Address payments now settle through Circle, screened by its hosted policy at the wallet layer.
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={provision}
          disabled={busy}
          className="rounded-full bg-[#2775CA] px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-50"
        >
          {busy ? 'Provisioning on Circle...' : 'Provision Circle Agent Wallet'}
        </button>
      )}
      {err && <div className="mt-3 text-xs text-red-600">{err}</div>}
    </section>
  )
}

type TreasuryState = {
  address?: string
  balances?: { usdcUsd: number; eurcUsd: number; usycUsd: number; idleUsd: number; totalUsd: number }
  capUsd?: number
  deployableUsd?: number
  projection?: { apyPct: number; weeklyUsd: number; monthlyUsd: number; yearlyUsd: number }
  usyc?: { token: string; teller: string; explorer: string; apyEstimatePct: number }
  note?: string
  autoYieldEnabled?: boolean
  authorizedAt?: string
  error?: string
}

/**
 * Treasury: put the agent's idle stablecoin to work in USYC, Circle's yield-bearing token.
 * Idle USDC/EURC above a working-capital cap earns yield and redeems back to USDC on demand.
 * The owner reviews projected earnings and authorizes; balances and the review are live, the
 * on-chain USDC to USYC mint goes live once the wallet is USYC-allowlisted (enterprise-gated).
 */
const CAP_PRESETS = [0, 5, 25, 100]

function BalanceTile({ ticker, value, yielding }: { ticker: string; value: string; yielding?: boolean }) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-semibold text-ink/55">{ticker}</span>
        {yielding && (
          <span className="rounded-full bg-emerald-100 px-1.5 py-[1px] text-[9px] font-semibold text-emerald-700">Yielding</span>
        )}
      </div>
      <div className="mt-1 text-lg font-semibold tracking-tight text-ink tabular-nums">{value}</div>
    </div>
  )
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white px-4 py-3">
      <div className="text-[11px] font-medium text-ink/45">{label}</div>
      <div className="mt-0.5 text-base font-semibold tracking-tight text-ink tabular-nums">{value}</div>
    </div>
  )
}

function TreasuryPanel({ agentId }: { agentId: string }) {
  const [t, setT] = useState<TreasuryState | null>(null)
  const [cap, setCap] = useState('25')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(
    async (capUsd?: string) => {
      setLoading(true)
      try {
        const q = capUsd !== undefined && capUsd !== '' ? `&cap=${Number(capUsd)}` : ''
        const res = await fetch(`${MCP_BASE}/api/agents/treasury?agentId=${agentId}${q}`, { signal: AbortSignal.timeout(12000) })
        const j = (await res.json()) as TreasuryState
        setT(j)
        if (typeof j.capUsd === 'number') setCap(String(j.capUsd))
        setErr(j.error ?? null)
      } catch {
        setErr('Could not load treasury status.')
      } finally {
        setLoading(false)
      }
    },
    [agentId],
  )

  useEffect(() => {
    if (agentId) load()
  }, [agentId, load])

  const act = async (enable: boolean) => {
    setBusy(true)
    setErr(null)
    try {
      const res = await fetch(`${MCP_BASE}/api/agents/treasury`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(enable ? { agentId, capUsd: Number(cap) || 0 } : { agentId, enabled: false }),
      })
      const j = (await res.json()) as { error?: string }
      if (j.error) setErr(j.error)
      await load(cap)
    } catch {
      setErr('Action failed. Is the backend running?')
    } finally {
      setBusy(false)
    }
  }

  const setCapPreset = (v: number) => {
    setCap(String(v))
    load(String(v))
  }

  const b = t?.balances
  const proj = t?.projection
  const on = !!t?.autoYieldEnabled
  const deployable = t?.deployableUsd ?? 0
  const apy = t?.usyc?.apyEstimatePct ?? proj?.apyPct ?? 4.2
  const money = (n?: number) => `$${(n ?? 0).toFixed(2)}`

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-emerald-200/70 bg-gradient-to-b from-emerald-50/50 to-white p-6 shadow-[0_1px_3px_rgba(16,24,40,0.04)] sm:p-7">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-600 text-white">
            <TrendingUp size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-semibold text-ink">Treasury</h3>
              {on && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  Auto Yield On
                </span>
              )}
            </div>
            <p className="text-[11px] text-ink/50">Idle balance put to work in USYC</p>
          </div>
        </div>
        {t?.address && (
          <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-black/[0.07] bg-white px-2.5 py-1 text-[11px] font-medium text-ink/55 sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Reading {short(t.address)}
          </span>
        )}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-ink/55">
        Put the agent's idle stablecoin to work. Anything above your working capital cap earns yield in <b>USYC</b>,
        Circle's tokenized money market fund on Arc, and redeems back to USDC when the agent needs to spend. You review
        the projection and authorize. Nothing moves on its own.
      </p>

      {loading ? (
        <div className="mt-5 text-xs text-ink/45">Loading treasury...</div>
      ) : t?.error ? (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-xs text-ink/60">{t.error}</div>
      ) : (
        <div className="mt-5 space-y-5">
          <div>
            <div className="mb-2 text-[11px] font-medium text-ink/45">Wallet Balances</div>
            <div className="grid grid-cols-3 gap-2.5">
              <BalanceTile ticker="USDC" value={money(b?.usdcUsd)} />
              <BalanceTile ticker="EURC" value={money(b?.eurcUsd)} />
              <BalanceTile ticker="USYC" value={money(b?.usycUsd)} yielding />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-medium text-ink/45">Working Capital Cap</span>
              <span className="text-[11px] text-ink/40">Idle below this stays liquid</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {CAP_PRESETS.map((v) => {
                const active = Number(cap) === v
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setCapPreset(v)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                      active ? 'bg-ink text-white' : 'border border-black/10 bg-white text-ink/60 hover:border-ink/25'
                    }`}
                  >
                    ${v}
                  </button>
                )
              })}
              <div className="ml-1 inline-flex items-center rounded-full border border-black/10 bg-white pl-3">
                <span className="text-[11px] text-ink/40">$</span>
                <input
                  type="number"
                  min="0"
                  value={cap}
                  onChange={(e) => setCap(e.target.value)}
                  onBlur={() => load(cap)}
                  className="w-16 bg-transparent px-1.5 py-1.5 text-xs font-semibold text-ink outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => load(cap)}
                className="rounded-full border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
              >
                Preview
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-emerald-300/60 bg-gradient-to-r from-emerald-400/[0.16] via-emerald-300/[0.08] to-transparent px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-medium text-ink/50">Ready To Earn In USYC</div>
                <div className="mt-0.5 text-[26px] font-bold leading-none tracking-tight text-emerald-700 tabular-nums">
                  {money(deployable)}
                </div>
              </div>
              <div className="text-right text-[11px] leading-relaxed text-ink/50">
                <div>About {apy}% APY estimate</div>
                <div className="tabular-nums">
                  {money(proj?.monthlyUsd)} per month · {money(proj?.weeklyUsd)} per week
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <MetricTile label="Idle Now" value={money(b?.idleUsd)} />
            <MetricTile label="Deployable" value={money(deployable)} />
            <MetricTile label="Est. Monthly" value={money(proj?.monthlyUsd)} />
            <MetricTile label="Est. Yearly" value={money(proj?.yearlyUsd)} />
          </div>

          {deployable <= 0 && (
            <p className="text-[11px] text-ink/45">
              Idle balance is at or below the ${Number(cap) || 0} cap. Lower the cap to put more to work.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            {on ? (
              <>
                <button
                  type="button"
                  onClick={() => act(true)}
                  disabled={busy}
                  className="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {busy ? 'Updating...' : 'Update Cap'}
                </button>
                <button
                  type="button"
                  onClick={() => act(false)}
                  disabled={busy}
                  className="rounded-full border border-black/10 px-4 py-2.5 text-sm font-semibold text-ink/60 transition hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                >
                  Turn Off
                </button>
                <span className="text-xs font-medium text-emerald-700">
                  Authorized{typeof t?.capUsd === 'number' ? ` · cap $${t.capUsd}` : ''}
                </span>
              </>
            ) : (
              <button
                type="button"
                onClick={() => act(true)}
                disabled={busy}
                className="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy ? 'Authorizing...' : 'Authorize Auto Yield'}
              </button>
            )}
            {t?.usyc?.explorer && (
              <a
                href={t.usyc.explorer}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
              >
                USYC Contract <ExternalLink size={11} />
              </a>
            )}
          </div>

          <p className="text-[11px] leading-relaxed text-ink/40">
            USYC is an enterprise gated Circle product. Balances, the cap and the earnings review are live now. The
            onchain USDC to USYC mint goes live once this wallet is USYC allowlisted (Circle Support, about 24 to 48
            hours). Estimated APY only. USYC yield floats with short Treasury rates.
          </p>
        </div>
      )}
      {err && <div className="mt-3 text-xs text-red-600">{err}</div>}
    </section>
  )
}
