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
import { useMcpChains, useMcpHealth } from '../../hooks/useMcp'
import { CHAINS } from '../../lib/chains'

const ACTIVITY = [
  { who: 'ResearchBot', action: 'paid 0.001 USDC via x402', when: '2m ago', type: 'pay', chain: 'arc' },
  { who: 'Human approval', action: 'settlement of 5.00 USDC confirmed', when: '1h ago', type: 'human', chain: 'arbitrum' },
  { who: 'Reputation engine', action: 'score updated to 742 (+18)', when: '5h ago', type: 'rep', chain: null },
  { who: 'DataProvider', action: 'resolved via ERC-8004 on Base', when: 'Yesterday', type: 'id', chain: 'base' },
] as const

const STATUS_ITEMS = [
  { label: 'Agent ID', detail: 'ERC-8004 verified, multi-chain', ok: true, to: '/app/agent-id', icon: Fingerprint },
  { label: 'Wallet', detail: '153.50 USDC unified balance', ok: true, to: '/app/wallet', icon: CreditCard },
  { label: 'Permissions', detail: '6 of 10 controls set', ok: true, to: '/app/permissions', icon: SlidersHorizontal },
] as const

export default function Dashboard() {
  const user = useAuth((s) => s.user)
  const mcpOnline = useMcpHealth()
  const { chains: mcpChains, loading: chainsLoading } = useMcpChains()

  // Merge MCP live chain data with static config
  const mcpChainById = Object.fromEntries(mcpChains.map((c) => [c.id, c]))

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Welcome back, {user?.name ?? 'there'}.
          </h2>
          <p className="mt-1 text-sm text-ink/55">
            Your agent console. Everything your agent needs to act, with you in the tower.
          </p>
        </div>
        {/* MCP live indicator */}
        <div
          className={`mt-1 flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${
            mcpOnline === null
              ? 'bg-ink/5 text-ink/30'
              : mcpOnline
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-red-50 text-red-500'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              mcpOnline === null
                ? 'bg-ink/20'
                : mcpOnline
                  ? 'bg-emerald-400'
                  : 'bg-red-400'
            }`}
          />
          {mcpOnline === null ? 'Connecting MCP...' : mcpOnline ? 'MCP live' : 'MCP offline'}
        </div>
      </div>

      {/* Stat grid */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Star} value="742" label="Reputation score" sub="+18 this week" to="/app/agent-id" />
        <StatCard icon={CreditCard} value="$142.50" label="Wallet balance" sub="USDC on Arc" to="/app/wallet" />
        <StatCard icon={ArrowLeftRight} value="18" label="Settlements" sub="this month" to="/app/settlements" />
        <StatCard icon={SlidersHorizontal} value="6 / 10" label="Permissions" sub="controls active" to="/app/permissions" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Agent status */}
        <div className="rounded-2xl border border-ink/10 bg-white p-6 lg:col-span-2">
          <h3 className="mb-4 font-semibold">Agent status</h3>
          <ul className="flex flex-col gap-3">
            {STATUS_ITEMS.map(({ label, detail, ok, to, icon: Icon }) => (
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

          {/* Multi-chain network panel */}
          <h3 className="mb-3 mt-6 font-semibold">Network</h3>
          <div className="grid gap-2 sm:grid-cols-3">
            {CHAINS.map((c) => {
              const mc = mcpChainById[c.id]
              return (
                <div
                  key={c.id}
                  className="rounded-xl border border-ink/8 bg-cream/50 p-3"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                    <span className="text-xs font-semibold text-ink">{c.shortName}</span>
                    <span
                      className="ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{
                        background: c.color + '18',
                        color: c.color,
                      }}
                    >
                      {c.status}
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] leading-relaxed text-ink/45">
                    {chainsLoading
                      ? '...'
                      : mc
                        ? `${mc.agentCount} agent${mc.agentCount === 1 ? '' : 's'}`
                        : 'No data yet'}
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
              )
            })}
          </div>
        </div>

        {/* Activity feed */}
        <div className="rounded-2xl border border-ink/10 bg-white p-6">
          <h3 className="mb-4 font-semibold">Recent activity</h3>
          <ul className="flex flex-col gap-4">
            {ACTIVITY.map((a, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span
                  className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                    a.type === 'pay'
                      ? 'bg-[#2775CA]'
                      : a.type === 'human'
                        ? 'bg-emerald-500'
                        : a.type === 'rep'
                          ? 'bg-accent'
                          : 'bg-ink/30'
                  }`}
                />
                <span className="text-ink/70">
                  <span className="font-semibold text-ink">{a.who}</span>{' '}
                  {a.action}
                  <span className="block text-xs text-ink/40">
                    {a.when}
                    {a.chain && (
                      <span
                        className="ml-1.5 rounded-full px-1.5 py-0.5 font-semibold capitalize"
                        style={{
                          background:
                            (CHAINS.find((c) => c.id === a.chain)?.color ?? '#888') + '18',
                          color: CHAINS.find((c) => c.id === a.chain)?.color ?? '#888',
                        }}
                      >
                        {a.chain}
                      </span>
                    )}
                  </span>
                </span>
              </li>
            ))}
          </ul>
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
