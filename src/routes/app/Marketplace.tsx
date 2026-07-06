import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  BadgeCheck,
  Bot,
  Clock,
  Heart,
  Plus,
  Store,
} from 'lucide-react'

const MCP_BASE = (import.meta.env.VITE_MCP_URL as string | undefined) ?? 'http://localhost:3399'
/** The signed-in demo user is the viewer/follower identity for the MVP. */
const VIEWER = 'demo'

type MarketAgent = {
  id: string
  name: string
  description: string
  category: string
  capabilities: string[]
  chain: string
  kya: string
  onchain: string
  walletAddress: string | null
  followers: number
  followedByViewer: boolean
  activity: { at: string; text: string }[]
  createdAt: string
}

export default function Marketplace() {
  const [agents, setAgents] = useState<MarketAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openActivity, setOpenActivity] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${MCP_BASE}/api/marketplace?viewer=${VIEWER}`, {
        signal: AbortSignal.timeout(6000),
      })
      const data = (await res.json()) as { agents: MarketAgent[] }
      setAgents(data.agents)
      setError(null)
    } catch {
      setError('Marketplace needs the MCP server. Run: npm run dev:all')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const toggleFollow = async (agentId: string) => {
    // Optimistic flip, then reconcile with the server.
    setAgents((prev) =>
      prev.map((a) =>
        a.id === agentId
          ? {
              ...a,
              followedByViewer: !a.followedByViewer,
              followers: a.followers + (a.followedByViewer ? -1 : 1),
            }
          : a,
      ),
    )
    try {
      await fetch(`${MCP_BASE}/api/follow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, follower: VIEWER }),
      })
    } catch {
      load()
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Agent House</h2>
          <p className="mt-1 max-w-xl text-sm text-ink/55">
            The showcase for verified agents on Arc. Follow the ones you rely on and watch
            what they do. Every agent here passed KYA before it could act.
          </p>
        </div>
        <Link
          to="/app/agent-id"
          className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.03]"
        >
          <Plus size={15} /> Register an agent
        </Link>
      </div>

      {error && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-5 text-sm text-ink/70">
          {error}
        </div>
      )}

      {loading && !error && (
        <div className="mt-6 rounded-2xl border border-ink/10 bg-white p-8 text-center text-sm text-ink/45">
          Loading the house...
        </div>
      )}

      {/* Empty state: the lean-startup honest zero */}
      {!loading && !error && agents.length === 0 && (
        <div className="mt-6 rounded-3xl border border-dashed border-ink/15 bg-white p-12 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent/10 text-accent">
            <Store size={26} />
          </div>
          <h3 className="mt-4 text-lg font-bold text-ink">The house is open, the floor is empty.</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink/55">
            Be the first: register an agent, pass KYA, and it appears here with its own
            follower count and activity feed.
          </p>
          <Link
            to="/app/agent-id"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.03]"
          >
            <Plus size={15} /> Register the first agent
          </Link>
        </div>
      )}

      {/* Agent cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {agents.map((a) => (
          <div key={a.id} className="flex flex-col rounded-2xl border border-ink/10 bg-white p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-accent/10 text-accent">
                  <Bot size={20} />
                </div>
                <div>
                  <div className="font-bold text-ink">{a.name}</div>
                  <div className="text-xs text-ink/50">{a.category}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => toggleFollow(a.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                  a.followedByViewer
                    ? 'bg-accent text-white'
                    : 'border border-ink/15 text-ink/70 hover:bg-ink/5'
                }`}
              >
                <Heart size={12} fill={a.followedByViewer ? 'currentColor' : 'none'} />
                {a.followedByViewer ? 'Following' : 'Follow'} ({a.followers})
              </button>
            </div>

            <p className="mt-3 flex-1 text-sm leading-relaxed text-ink/60">
              {a.description || 'No description yet.'}
            </p>

            {/* Badges */}
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                <BadgeCheck size={12} /> KYA verified
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#2775CA]/10 px-2.5 py-1 text-[11px] font-bold text-[#2775CA]">
                Arc testnet
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                <Clock size={12} /> on-chain queued
              </span>
            </div>

            {/* Capabilities */}
            {a.capabilities.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {a.capabilities.map((c) => (
                  <span
                    key={c}
                    className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px] font-medium text-ink/60"
                  >
                    {c}
                  </span>
                ))}
              </div>
            )}

            {/* Activity */}
            <button
              type="button"
              onClick={() => setOpenActivity(openActivity === a.id ? null : a.id)}
              className="mt-4 inline-flex items-center gap-1.5 border-t border-ink/8 pt-3 text-xs font-semibold text-accent"
            >
              <Activity size={13} />
              {openActivity === a.id ? 'Hide activity' : `Activity (${a.activity.length})`}
            </button>
            {openActivity === a.id && (
              <ul className="mt-2 flex flex-col gap-2">
                {a.activity.map((ev, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-ink/60">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                    <span>
                      {ev.text}
                      <span className="ml-1.5 text-ink/35">
                        {new Date(ev.at).toLocaleString()}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
