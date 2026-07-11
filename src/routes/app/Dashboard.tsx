import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeftRight,
  ArrowUpRight,
  CreditCard,
  ExternalLink,
  Fingerprint,
  SlidersHorizontal,
  Star,
} from 'lucide-react'
import { useAuth } from '../../store/auth'
import { useMcpHealth } from '../../hooks/useMcp'
import { CHAINS } from '../../lib/chains'

import { MCP_BASE } from '../../lib/mcpBase'
import { pickPrimaryAgent } from '../../lib/pickAgent'

type Perms = { dailyCapUsd: number; autoApproveUnderUsd: number; frozen: boolean }
type Agent = {
  id: string
  name: string
  walletAddress: string | null
  kya: 'unverified' | 'verified'
  onchain: 'queued' | 'registered'
  permissions: Perms
  activity: { at: string; text: string }[]
}

/** Compact "5h ago" style relative time. */
function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function Dashboard() {
  const user = useAuth((s) => s.user)
  const mcp = useMcpHealth() // 'checking' | 'waking' | 'online' | 'offline'

  // Cold-start-aware MCP badge: a free-tier backend can take ~40s to wake.
  const mcpTone =
    mcp === 'online' ? 'bg-emerald-50 text-emerald-700' : mcp === 'offline' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-600'
  const mcpDot = mcp === 'online' ? 'bg-emerald-400' : mcp === 'offline' ? 'bg-red-400' : 'bg-amber-400'
  const mcpLabel =
    mcp === 'online' ? 'MCP live' : mcp === 'waking' ? 'Backend waking up…' : mcp === 'checking' ? 'Connecting…' : 'MCP offline'

  // Real data for the user's first agent (empty until the backend answers).
  const [agent, setAgent] = useState<Agent | null>(null)
  const [rep, setRep] = useState<number | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [settlements, setSettlements] = useState<number | null>(null)
  const [agentTotal, setAgentTotal] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await fetch(`${MCP_BASE}/api/platform-agents`, { signal: AbortSignal.timeout(6000) }).then((r) =>
          r.json(),
        )
        if (cancelled) return
        setAgentTotal(Array.isArray(list.agents) ? list.agents.length : 0)
        const first: Agent | undefined = pickPrimaryAgent(list.agents)
        if (!first) return
        setAgent(first)
        const [repRes, ixRes] = await Promise.all([
          fetch(`${MCP_BASE}/api/agents/reputation?agentId=${first.id}`).then((r) => r.json()).catch(() => null),
          fetch(`${MCP_BASE}/api/instructions?agentId=${first.id}`).then((r) => r.json()).catch(() => null),
        ])
        if (cancelled) return
        if (repRes && !('error' in repRes) && typeof repRes.score === 'number') setRep(repRes.score)
        if (Array.isArray(ixRes?.instructions))
          setSettlements(ixRes.instructions.filter((i: { status: string }) => i.status === 'executed_onchain').length)
        if (first.walletAddress) {
          const bal = await fetch(`${MCP_BASE}/api/wallet-balance?address=${first.walletAddress}`)
            .then((r) => r.json())
            .catch(() => null)
          if (!cancelled && bal?.balance != null) setBalance(Number(bal.balance))
        }
      } catch {
        /* backend unreachable — leave everything empty (no fake numbers) */
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const dash = '—'
  const p = agent?.permissions
  const statusItems = [
    {
      label: 'Agent ID',
      detail: !agent
        ? 'No agent yet'
        : agent.onchain === 'registered'
          ? `ERC-8004 anchored · KYA ${agent.kya}`
          : `Registration queued · KYA ${agent.kya}`,
      ok: agent?.onchain === 'registered' && agent?.kya === 'verified',
      to: '/app/agent-id',
      icon: Fingerprint,
    },
    {
      label: 'Wallet',
      detail: !agent?.walletAddress
        ? 'No wallet yet'
        : balance != null
          ? `${balance.toFixed(4)} USDC on Arc`
          : 'Balance loading…',
      ok: (balance ?? 0) > 0,
      to: '/app/wallet',
      icon: CreditCard,
    },
    {
      label: 'Permissions',
      detail: !p ? 'Not set' : p.frozen ? 'Frozen — all activity paused' : `Daily cap $${p.dailyCapUsd}`,
      ok: Boolean(p) && !p!.frozen,
      to: '/app/permissions',
      icon: SlidersHorizontal,
    },
  ]

  const activity = agent?.activity ? [...agent.activity].slice(-6).reverse() : []

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Welcome back, {user?.name ?? 'there'}.</h2>
          <p className="mt-1 text-sm text-ink/55">
            Your agent console. Everything your agent needs to act, with you in the tower.
          </p>
        </div>
        {/* MCP live indicator (cold-start aware) */}
        <div
          className={`mt-1 flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${mcpTone}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${mcpDot} ${mcp === 'waking' || mcp === 'checking' ? 'animate-pulse' : ''}`} />
          {mcpLabel}
        </div>
      </div>

      {/* No-agent nudge (only once we know the backend answered and there's nothing yet) */}
      {loaded && !agent && (
        <div className="mt-6 rounded-2xl border border-dashed border-ink/15 bg-white p-6 text-sm text-ink/60">
          No agent registered yet.{' '}
          <Link to="/app/agent-id" className="font-semibold text-accent hover:underline">
            Claim an Agent ID
          </Link>{' '}
          to give it a wallet, limits, and an on-chain passport.
        </div>
      )}

      {/* Stat grid — real values, em-dash until the backend answers */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={Star}
          value={rep != null ? String(rep) : dash}
          label="Reputation score"
          sub="from real activity"
          to="/app/agent-id"
        />
        <StatCard
          icon={CreditCard}
          value={balance != null ? `${balance.toFixed(2)}` : dash}
          label="Wallet balance"
          sub="USDC on Arc (live)"
          to="/app/wallet"
        />
        <StatCard
          icon={ArrowLeftRight}
          value={settlements != null ? String(settlements) : dash}
          label="Settlements"
          sub="settled on-chain"
          to="/app/settlements"
        />
        <StatCard
          icon={SlidersHorizontal}
          value={p ? `$${p.dailyCapUsd}` : dash}
          label="Daily cap"
          sub={p ? `auto-approve $${p.autoApproveUnderUsd}` : 'set your limits'}
          to="/app/permissions"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Agent status */}
        <div className="rounded-2xl border border-ink/10 bg-white p-6 lg:col-span-2">
          <h3 className="mb-4 font-semibold">Agent status</h3>
          <ul className="flex flex-col gap-3">
            {statusItems.map(({ label, detail, ok, to, icon: Icon }) => (
              <li
                key={label}
                className="flex items-center justify-between gap-3 rounded-xl border border-ink/8 bg-cream/50 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent/10 text-accent">
                    <Icon size={15} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-ink">{label}</div>
                    <div className="text-xs text-ink/50">{detail}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      ok ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {ok ? 'Ready' : 'Pending'}
                  </span>
                  <Link to={to} className="text-accent hover:opacity-70">
                    <ArrowUpRight size={15} />
                  </Link>
                </div>
              </li>
            ))}
          </ul>

          {/* Multi-chain network panel (live) */}
          <h3 className="mb-3 mt-6 font-semibold">Network</h3>
          <div className="grid gap-2 sm:grid-cols-3">
            {CHAINS.map((c) => (
                <div key={c.id} className="rounded-xl border border-ink/8 bg-cream/50 p-3">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                    <span className="text-xs font-semibold text-ink">{c.shortName}</span>
                    <span
                      className="ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{ background: c.color + '18', color: c.color }}
                    >
                      {c.status}
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] leading-relaxed text-ink/45">
                    {c.id === 'arc'
                      ? agentTotal == null
                        ? '…'
                        : `${agentTotal} live agent${agentTotal === 1 ? '' : 's'}`
                      : 'no live agents yet'}
                  </div>
                  {c.explorer && (
                    <a
                      href={c.explorer}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-0.5 text-[11px] font-semibold text-accent hover:underline"
                    >
                      Explorer <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              ))}
          </div>
        </div>

        {/* Activity feed (real agent activity) */}
        <div className="rounded-2xl border border-ink/10 bg-white p-6">
          <h3 className="mb-4 font-semibold">Recent activity</h3>
          {activity.length > 0 ? (
            <ul className="flex flex-col gap-4">
              {activity.map((a, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span className="text-ink/70">
                    {a.text}
                    <span className="block text-xs text-ink/40">{ago(a.at)}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink/45">
              {loaded ? 'No activity yet. Register an agent and make a payment.' : 'Loading…'}
            </p>
          )}
          <Link
            to="/app/settlements"
            className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"
          >
            View all <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  value,
  label,
  sub,
  to,
}: {
  icon: React.ComponentType<{ size?: number }>
  value: string
  label: string
  sub: string
  to: string
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col rounded-2xl border border-ink/10 bg-white p-5 transition-shadow hover:shadow-md"
    >
      <div className="mb-3 grid h-9 w-9 place-items-center rounded-xl bg-accent/10 text-accent">
        <Icon size={18} />
      </div>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      <div className="text-sm font-medium text-ink/70">{label}</div>
      <div className="mt-0.5 text-xs text-ink/40">{sub}</div>
    </Link>
  )
}
