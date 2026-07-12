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
import { authHeaders, useAuth } from '../../store/auth'

import { MCP_BASE } from '../../lib/mcpBase'

/** Shorten any full 40-hex address inside activity text so it never overflows the card. */
const humanizeActivity = (text: string) =>
  text.replace(/0x[0-9a-fA-F]{40}/g, (a) => `${a.slice(0, 6)}...${a.slice(-4)}`)

type MarketAgent = {
  id: string
  name: string
  description: string
  category: string
  capabilities: string[]
  chain: string
  kya: string
  onchain: string
  onchainTx?: string
  onchainExplorer?: string
  onchainAgentId?: string
  reputation?: { score: number; breakdown: { settlement: number; validation: number; tenure: number } }
  walletAddress: string | null
  followers: number
  followedByViewer: boolean
  activity: { at: string; text: string }[]
  createdAt: string
}

export default function Marketplace() {
  const user = useAuth((s) => s.user)
  // Follow/follower identity = the signed-in caller (their wallet address or email),
  // so follows are per-user, not shared across everyone. Falls back to 'guest' only
  // for a tokenless browse session (whose follow writes the server rejects anyway).
  const viewer = user?.email || user?.name || 'guest'

  const [agents, setAgents] = useState<MarketAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openActivity, setOpenActivity] = useState<string | null>(null)
  const [anchoringId, setAnchoringId] = useState<string | null>(null)
  const [anchorNote, setAnchorNote] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${MCP_BASE}/api/marketplace?viewer=${encodeURIComponent(viewer)}`, {
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
  }, [viewer])

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
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ agentId, follower: viewer }),
      })
    } catch {
      load()
    }
  }

  // Deliberate, human-triggered on-chain anchor for a queued agent: broadcasts a
  // real ERC-8004 registration on Arc and flips the card to "registered" with a tx link.
  const anchorAgent = async (agentId: string) => {
    setAnchoringId(agentId)
    setAnchorNote((n) => ({ ...n, [agentId]: '' }))
    try {
      const res = await fetch(`${MCP_BASE}/api/agents/anchor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ agentId }),
      })
      const data = (await res.json()) as {
        agent?: { onchain?: string; onchainTx?: string; onchainExplorer?: string; onchainAgentId?: string }
        result?: { executed?: boolean; reason?: string }
        error?: string
      }
      if (data.result?.executed && data.agent) {
        setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, ...data.agent } : a)))
      } else {
        setAnchorNote((n) => ({
          ...n,
          [agentId]: data.result?.reason ?? data.error ?? 'Could not broadcast. Set a funded ARC_SIGNER_KEY on the server.',
        }))
      }
    } catch {
      setAnchorNote((n) => ({ ...n, [agentId]: 'Anchoring needs the MCP server with a funded ARC_SIGNER_KEY.' }))
    } finally {
      setAnchoringId(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Agent House</h2>
          <p className="mt-1 max-w-xl text-sm text-ink/55">
            The showcase for verified agents on Arc. Follow the ones you rely on and watch
            what they do. Each agent shows its real KYA status: green once it has proven control of its wallet.
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
                <div className="min-w-0">
                  <div className="truncate font-bold text-ink">{a.name}</div>
                  <div className="truncate text-xs text-ink/50">{a.category}</div>
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

            {/* Reputation (computed from real settlements + on-chain identity + tenure) */}
            {a.reputation && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-ink/50">Reputation</span>
                  <span className="font-bold text-accent">{a.reputation.score} / 1000</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink/8">
                  <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(a.reputation.score / 1000) * 100}%` }} />
                </div>
              </div>
            )}

            {/* Badges */}
            <div className="mt-4 flex flex-wrap gap-2">
              {a.kya === 'verified' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                  <BadgeCheck size={12} /> KYA verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                  KYA unverified
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full bg-[#2775CA]/10 px-2.5 py-1 text-[11px] font-bold text-[#2775CA]">
                Arc testnet
              </span>
              {a.onchain === 'registered' ? (
                <a
                  href={a.onchainExplorer ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-[#2775CA]/10 px-2.5 py-1 text-[11px] font-bold text-[#2775CA] hover:underline"
                >
                  <BadgeCheck size={12} /> On-chain #{a.onchainAgentId ?? ''}
                </a>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                  <Clock size={12} /> on-chain queued
                </span>
              )}
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

            {/* On-chain anchor: real ERC-8004 registration on Arc, for queued agents */}
            {a.onchain !== 'registered' && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => anchorAgent(a.id)}
                  disabled={anchoringId === a.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#2775CA]/30 px-3 py-1.5 text-xs font-semibold text-[#2775CA] transition-colors hover:bg-[#2775CA]/5 disabled:opacity-50"
                >
                  {anchoringId === a.id ? 'Anchoring on Arc...' : 'Anchor on Arc'}
                </button>
                {anchorNote[a.id] && <p className="mt-1.5 text-[11px] text-amber-700">{anchorNote[a.id]}</p>}
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
                    <span className="min-w-0 break-words">
                      {humanizeActivity(ev.text)}
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
