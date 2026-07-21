import { useEffect, useRef, useState, type FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, ShieldCheck, ShieldAlert, ShieldX, ArrowUpRight, Loader2, Sparkles } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import SiteFooter from '../components/sections/SiteFooter'
import { Input } from '../components/ui/input'
import { useTheme } from '../components/ThemeProvider'
import {
  resolveAgent, getReputation, getLeaderboard,
  type AgentIdentity, type Reputation, type FeedAgent,
} from '../lib/mcp-client'
import { EASE_OUT_EXPO } from '../lib/brand'

const ACCENT = '#7342e2'
type Verdict = 'ALLOW' | 'WARN' | 'DENY'
const VERDICT: Record<Verdict, { color: string; Icon: typeof ShieldCheck }> = {
  ALLOW: { color: '#10b981', Icon: ShieldCheck },
  WARN: { color: '#f59e0b', Icon: ShieldAlert },
  DENY: { color: '#ef4444', Icon: ShieldX },
}
function riskOf(score: number, kya?: string, verified = true): Verdict {
  if (kya === 'revoked' || !verified) return 'DENY'
  if (score < 200) return 'DENY'
  if (score < 500) return 'WARN'
  return 'ALLOW'
}
const short = (a?: string | null) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a ?? '')

/** requestAnimationFrame count-up; re-runs when the target changes (new agent loaded). */
function useCountUp(target: number, duration = 1000) {
  const [val, setVal] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    const start = performance.now()
    const begin = from.current
    let raf = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const cur = Math.round(begin + (target - begin) * eased)
      setVal(cur)
      if (t < 1) raf = requestAnimationFrame(tick)
      else from.current = target
    })
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return val
}

/** Slow-drifting blurred color fields + a faint dot grid. Pure CSS, themes with the surface. */
function Ambient() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <motion.div
        className="absolute -left-40 -top-40 h-[36rem] w-[36rem] rounded-full blur-[130px]"
        style={{ background: `${ACCENT}33` }}
        animate={{ x: [0, 60, 0], y: [0, 40, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -right-32 top-52 h-[30rem] w-[30rem] rounded-full blur-[130px]"
        style={{ background: '#10b98122' }}
        animate={{ x: [0, -50, 0], y: [0, 50, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div
        className="absolute inset-0 text-foreground opacity-[0.04]"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '34px 34px' }}
      />
    </div>
  )
}

function Gauge({ score, verdict }: { score: number; verdict: Verdict }) {
  const shown = useCountUp(score)
  const R = 96, STROKE = 13, SIZE = 240, C = 2 * Math.PI * R, SWEEP = 0.75
  const arc = C * SWEEP
  const progress = Math.max(0, Math.min(1, score / 1000))
  const v = VERDICT[verdict]
  return (
    <div className="relative grid h-[240px] w-[240px] place-items-center">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="rotate-[135deg]">
        <defs>
          <linearGradient id="repgrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={ACCENT} />
            <stop offset="100%" stopColor={v.color} />
          </linearGradient>
        </defs>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" strokeWidth={STROKE} strokeLinecap="round"
          className="text-foreground/10" stroke="currentColor" strokeDasharray={`${arc} ${C}`} />
        <motion.circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="url(#repgrad)" strokeWidth={STROKE}
          strokeLinecap="round" strokeDasharray={`${arc} ${C}`}
          initial={{ strokeDashoffset: arc }} animate={{ strokeDashoffset: arc * (1 - progress) }}
          transition={{ duration: 1.2, ease: EASE_OUT_EXPO }}
          style={{ filter: `drop-shadow(0 0 12px ${v.color}77)` }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="text-6xl font-bold leading-none tabular-nums text-foreground">{shown}</div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-foreground/40">reputation</div>
        </div>
      </div>
    </div>
  )
}

function Meter({ label, value, cap }: { label: string; value: number; cap: number }) {
  const neg = value < 0
  const pct = Math.max(2, Math.min(100, (Math.abs(value) / cap) * 100))
  return (
    <div className="flex items-center gap-3">
      <div className="w-24 shrink-0 text-[11px] uppercase tracking-wide text-foreground/45">{label}</div>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-foreground/[0.08]">
        <motion.div className="absolute inset-y-0 left-0 rounded-full" style={{ background: neg ? '#ef4444' : ACCENT }}
          initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9, ease: EASE_OUT_EXPO, delay: 0.15 }} />
      </div>
      <div className={`w-9 text-right text-xs font-bold tabular-nums ${neg ? 'text-red-500' : 'text-foreground/80'}`}>
        {neg ? '' : '+'}{value}
      </div>
    </div>
  )
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <motion.div whileHover={{ y: -3 }} className="min-w-0">
      <div className="text-2xl font-bold tabular-nums text-foreground">{value}</div>
      <div className="mt-0.5 h-[3px] w-7 rounded-full" style={{ background: accent ?? 'var(--color-accent)' }} />
      <div className="mt-1.5 text-[11px] uppercase tracking-wide text-foreground/45">{label}</div>
    </motion.div>
  )
}

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const v = VERDICT[verdict]
  return (
    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
      className="flex items-center gap-2.5 rounded-full px-4 py-2"
      style={{ background: `${v.color}14`, boxShadow: `inset 0 0 0 1px ${v.color}40, 0 0 24px ${v.color}22` }}>
      <v.Icon size={18} style={{ color: v.color }} />
      <span className="text-sm font-bold tracking-wide" style={{ color: v.color }}>{verdict}</span>
    </motion.div>
  )
}

function TrustPanel({ identity, reputation, query }: { identity: AgentIdentity | null; reputation: Reputation | null; query: string }) {
  const verified = identity?.valid ?? reputation?.onchain === 'registered'
  const score = reputation?.score ?? 0
  const verdict = riskOf(score, reputation?.kya, verified)
  const name = reputation?.name || (identity ? `Agent #${identity.tokenId}` : query)
  const bd = reputation?.breakdown
  const beh = reputation?.behavioral
  const owner = identity?.owner
  const arcUrl = owner && /^0x[0-9a-fA-F]{40}$/.test(owner) ? `https://testnet.arcscan.app/address/${owner}` : null

  return (
    <div className="relative overflow-hidden rounded-[2.5rem] bg-foreground/[0.025] p-7 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.35)] sm:p-10">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/40">
            <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" /></span>
            Live · Circle Arc
          </div>
          <h2 className="mt-2 truncate text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{name}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-foreground/50">
            {identity && <span>#{identity.tokenId}</span>}
            {owner && (arcUrl
              ? <a href={arcUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-accent">{short(owner)}<ArrowUpRight size={11} /></a>
              : <span>{short(owner)}</span>)}
            <span className="uppercase" style={{ color: reputation?.kya === 'revoked' ? '#ef4444' : undefined }}>
              KYA {reputation?.kya ?? 'unknown'}
            </span>
          </div>
        </div>
        <VerdictBadge verdict={verdict} />
      </div>

      {/* gauge + breakdown */}
      <div className="mt-8 grid items-center gap-8 md:grid-cols-[240px_1fr]">
        <div className="mx-auto">{reputation ? <Gauge score={score} verdict={verdict} /> : <div className="grid h-[240px] place-items-center text-sm text-foreground/40">on-chain identity only</div>}</div>
        <div className="flex flex-col gap-3">
          {bd && <Meter label="Settlement" value={bd.settlement} cap={600} />}
          {bd && <Meter label="Validation" value={bd.validation} cap={240} />}
          {bd && <Meter label="Tenure" value={bd.tenure} cap={160} />}
          {bd && typeof bd.behavior === 'number' && <Meter label="Behavior" value={bd.behavior} cap={150} />}
          {beh && (
            <div className="mt-4 grid grid-cols-4 gap-4 border-t border-foreground/10 pt-5">
              <Tile label="Done" value={String(beh.completedJobs)} />
              <Tile label="Contested" value={String(beh.contestedJobs)} accent={beh.contestedJobs > 0 ? '#f59e0b' : undefined} />
              <Tile label="Dispute" value={`${Math.round(beh.disputeRate * 100)}%`} accent={beh.disputeRate >= 0.3 ? '#ef4444' : undefined} />
              <Tile label="Rating" value={beh.avgRating != null ? `${beh.avgRating.toFixed(1)}★` : '—'} />
            </div>
          )}
        </div>
      </div>

      <p className="mt-8 max-w-xl text-xs leading-relaxed text-foreground/40">
        Live ERC-8004 read · deterministic{' '}
        <a href="https://a-identity-asp.onrender.com/methodology" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">reproducible</a> reputation.
        Amount-aware verdicts: the paid{' '}
        <a href="https://a-identity-asp.onrender.com/proof" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">risk_check on OKX</a>.
      </p>
    </div>
  )
}

function LeaderRow({ rank, agent, active, onPick }: { rank: number; agent: FeedAgent; active: boolean; onPick: () => void }) {
  const score = agent.reputation?.score ?? 0
  const verdict = riskOf(score, agent.kya)
  const v = VERDICT[verdict]
  return (
    <motion.button
      onClick={onPick}
      initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
      transition={{ duration: 0.4, ease: EASE_OUT_EXPO, delay: Math.min(rank * 0.04, 0.4) }}
      whileHover={{ x: 5 }}
      className={`group flex w-full items-center gap-4 rounded-2xl px-3 py-3 text-left transition-colors ${active ? 'bg-foreground/[0.05]' : 'hover:bg-foreground/[0.04]'}`}
    >
      <div className={`w-9 text-3xl font-bold tabular-nums transition-colors ${active ? 'text-accent/60' : 'text-foreground/12 group-hover:text-accent/40'}`}>{rank}</div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-foreground">{agent.name}</div>
        <div className="truncate font-mono text-[11px] text-foreground/40">{agent.category}{agent.onchainAgentId ? ` · #${agent.onchainAgentId}` : ''}</div>
      </div>
      <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-foreground/[0.08] sm:block">
        <div className="h-full rounded-full" style={{ width: `${Math.max(3, score / 10)}%`, background: ACCENT }} />
      </div>
      <div className="w-10 text-right text-sm font-bold tabular-nums text-foreground">{score}</div>
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: v.color, boxShadow: `0 0 10px ${v.color}` }} />
    </motion.button>
  )
}

export default function Explorer() {
  const { theme } = useTheme()
  const [query, setQuery] = useState('849980')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [identity, setIdentity] = useState<AgentIdentity | null>(null)
  const [reputation, setReputation] = useState<Reputation | null>(null)
  const [shown, setShown] = useState('')
  const [board, setBoard] = useState<FeedAgent[]>([])
  const topRef = useRef<HTMLElement>(null)

  async function lookup(raw: string, scroll = false) {
    const q = raw.trim()
    if (!q) return
    setLoading(true); setError(null)
    const [idRes, repRes] = await Promise.all([resolveAgent(q), getReputation(q)])
    const id = idRes.ok && idRes.data.found ? (idRes.data.agent ?? null) : null
    const rep = repRes.ok && repRes.data.found ? (repRes.data.reputation ?? null) : null
    setIdentity(id); setReputation(rep); setShown(q)
    if (!id && !rep) setError(`No agent found for "${q}". Try a token id (849980) or an owner address.`)
    setLoading(false)
    if (scroll) topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  useEffect(() => {
    void lookup('849980')
    void getLeaderboard().then((r) => { if (r.ok) setBoard(r.data.filter((a) => (a.reputation?.score ?? 0) > 0).slice(0, 12)) })
  }, [])

  const onSubmit = (e: FormEvent) => { e.preventDefault(); void lookup(query) }
  const activeId = reputation?.name ? shown : null

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className="relative min-h-screen w-full bg-background text-foreground" style={{ fontFamily: 'var(--font-body)' }}>
        <Ambient />
        <PageHeader />
        <main ref={topRef} className="mx-auto w-full max-w-[980px] px-5 py-14 sm:px-8 sm:py-20">
          {/* hero */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
              <Sparkles size={13} /> Trust Explorer
            </div>
            <h1 className="mt-4 text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl" style={{ fontFamily: 'var(--font-heading)' }}>
              Every agent,<br /><span className="text-accent">weighed before you trust it.</span>
            </h1>
          </motion.div>

          {/* search */}
          <motion.form onSubmit={onSubmit} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1, ease: EASE_OUT_EXPO }}
            className="mt-8 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Agent query"
                placeholder="Token id (849980) or 0x owner address"
                className="h-12 rounded-2xl pl-11 text-base" />
            </div>
            <button type="submit" disabled={loading}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-accent px-7 text-sm font-semibold text-white shadow-[0_10px_30px_-10px_rgba(115,66,226,0.7)] transition-transform hover:scale-[1.02] disabled:opacity-60">
              {loading ? <Loader2 size={17} className="animate-spin" /> : <Search size={17} />}
              {loading ? 'Reading chain' : 'Explore'}
            </button>
          </motion.form>

          {/* result */}
          <div className="mt-8">
            {error && <div className="rounded-2xl bg-foreground/[0.03] p-6 text-sm text-foreground/60">{error}</div>}
            <AnimatePresence mode="wait">
              {!error && (identity || reputation) && (
                <motion.div key={shown} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}>
                  <TrustPanel identity={identity} reputation={reputation} query={shown} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* leaderboard */}
          {board.length > 0 && (
            <div className="mt-16">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-lg font-bold tracking-tight text-foreground">Most trusted agents</h2>
                <span className="text-xs text-foreground/40">ranked by reputation · live</span>
              </div>
              <div className="flex flex-col">
                {board.map((a, i) => (
                  <LeaderRow key={a.id} rank={i + 1} agent={a} active={activeId != null && (a.onchainAgentId === activeId || a.id === activeId)}
                    onPick={() => { const q = a.onchainAgentId || a.id; setQuery(q); void lookup(q, true) }} />
                ))}
              </div>
            </div>
          )}
        </main>
        <SiteFooter />
      </div>
    </div>
  )
}
