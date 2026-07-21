import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import {
  Search, ShieldCheck, ShieldAlert, ShieldX, BadgeCheck, ExternalLink, Loader2, Fingerprint,
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import SiteFooter from '../components/sections/SiteFooter'
import { Input } from '../components/ui/input'
import { useTheme } from '../components/ThemeProvider'
import { resolveAgent, getReputation, type AgentIdentity, type Reputation } from '../lib/mcp-client'
import { EASE_OUT_EXPO } from '../lib/brand'

const reveal = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: EASE_OUT_EXPO },
}

/** A reputation-derived verdict. The authoritative, amount-aware pre-transaction risk_check
 *  is the paid ASP tool; this is the free, transparent signal from identity + reputation. */
function derivedRisk(rep: Reputation | null, verified: boolean): { label: 'ALLOW' | 'WARN' | 'DENY'; tone: 'ok' | 'warn' | 'bad' } {
  if (rep?.kya === 'revoked') return { label: 'DENY', tone: 'bad' }
  if (!verified) return { label: 'DENY', tone: 'bad' }
  const s = rep?.score ?? 0
  if (s < 200) return { label: 'DENY', tone: 'bad' }
  if (s < 500) return { label: 'WARN', tone: 'warn' }
  return { label: 'ALLOW', tone: 'ok' }
}

const TONE = {
  ok: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  warn: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30',
  bad: 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/30',
} as const

const short = (a?: string | null) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a ?? '')

function Band({ label, value, cap }: { label: string; value: number; cap: number }) {
  const pct = Math.max(0, Math.min(100, (Math.abs(value) / cap) * 100))
  const negative = value < 0
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-foreground/60">{label}</span>
        <span className={negative ? 'font-semibold text-red-500' : 'font-semibold text-foreground'}>
          {negative ? '' : '+'}{value}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
        <div className={`h-full rounded-full ${negative ? 'bg-red-500' : 'bg-accent'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Chip({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'warn' | 'bad' }) {
  return (
    <div className={`rounded-xl border px-3 py-2 ${tone ? TONE[tone] : 'border-border bg-card'}`}>
      <div className="text-[11px] uppercase tracking-wide text-foreground/50">{label}</div>
      <div className="text-sm font-semibold text-foreground">{value}</div>
    </div>
  )
}

function TrustCard({ identity, reputation, query }: { identity: AgentIdentity | null; reputation: Reputation | null; query: string }) {
  const verified = identity?.valid ?? reputation?.onchain === 'registered'
  const risk = derivedRisk(reputation, verified)
  const RiskIcon = risk.label === 'ALLOW' ? ShieldCheck : risk.label === 'WARN' ? ShieldAlert : ShieldX
  const name = reputation?.name || (identity ? `Agent #${identity.tokenId}` : query)
  const bd = reputation?.breakdown
  const beh = reputation?.behavioral
  const owner = identity?.owner
  const arcUrl = owner && /^0x[0-9a-fA-F]{40}$/.test(owner) ? `https://testnet.arcscan.app/address/${owner}` : null

  return (
    <motion.div {...reveal} className="rounded-3xl border border-border bg-card p-6 sm:p-8">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent/10 text-accent"><Fingerprint size={18} /></div>
            <h2 className="text-xl font-bold text-foreground">{name}</h2>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {verified && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <BadgeCheck size={13} /> ERC-8004 verified
              </span>
            )}
            {reputation?.kya === 'verified' && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground/70">KYA verified</span>
            )}
            {reputation?.kya === 'revoked' && (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-600 dark:text-red-400">KYA revoked (incident)</span>
            )}
            {reputation?.kya === 'unverified' && (
              <span className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground/50">KYA unverified</span>
            )}
          </div>
        </div>
        {/* risk verdict */}
        <div className={`flex items-center gap-2 rounded-2xl border px-4 py-3 ${TONE[risk.tone]}`}>
          <RiskIcon size={20} />
          <div>
            <div className="text-lg font-bold leading-none">{risk.label}</div>
            <div className="text-[10px] uppercase tracking-wide opacity-70">reputation-derived</div>
          </div>
        </div>
      </div>

      {/* score + breakdown */}
      {reputation ? (
        <div className="mt-7 grid gap-7 sm:grid-cols-[auto_1fr]">
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-background/40 px-8 py-5">
            <div className="text-4xl font-bold text-foreground">{reputation.score}</div>
            <div className="text-xs text-foreground/50">/ 1000 reputation</div>
          </div>
          <div className="flex flex-col justify-center gap-2.5">
            {bd && <Band label="Settlement" value={bd.settlement} cap={600} />}
            {bd && <Band label="Validation" value={bd.validation} cap={240} />}
            {bd && <Band label="Tenure" value={bd.tenure} cap={160} />}
            {bd && typeof bd.behavior === 'number' && <Band label="Behavior (job outcomes)" value={bd.behavior} cap={150} />}
          </div>
        </div>
      ) : (
        <p className="mt-6 text-sm text-foreground/55">No platform reputation for this agent yet, showing on-chain identity only.</p>
      )}

      {/* behavioral summary */}
      {beh && (
        <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Chip label="Completed jobs" value={String(beh.completedJobs)} />
          <Chip label="Contested jobs" value={String(beh.contestedJobs)} tone={beh.contestedJobs > 0 ? 'warn' : undefined} />
          <Chip label="Dispute rate" value={`${Math.round(beh.disputeRate * 100)}%`} tone={beh.disputeRate >= 0.3 ? 'bad' : undefined} />
          <Chip label="Avg rating" value={beh.avgRating != null ? `${beh.avgRating.toFixed(1)} ★` : '—'} />
        </div>
      )}

      {/* identity + settlements */}
      <div className="mt-6 grid gap-3 border-t border-border pt-5 text-sm sm:grid-cols-2">
        {identity && <Row label="Token id">#{identity.tokenId}</Row>}
        {identity && (
          <Row label="Owner">
            {arcUrl ? (
              <a href={arcUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-accent hover:underline">
                {short(owner)} <ExternalLink size={12} />
              </a>
            ) : short(owner)}
          </Row>
        )}
        {identity?.chain && <Row label="Chain">{identity.chain}</Row>}
        {typeof reputation?.settledOnchain === 'number' && (
          <Row label="Settled on-chain">{reputation.settledOnchain} settlement(s){reputation.settledUsd ? ` · $${reputation.settledUsd}` : ''}</Row>
        )}
      </div>

      <p className="mt-5 text-xs text-foreground/45">
        Every number is real: identity read live from Circle Arc&apos;s ERC-8004 registry, reputation deterministic and{' '}
        <a href="https://a-identity-asp.onrender.com/methodology" target="_blank" rel="noopener noreferrer" className="font-semibold text-accent hover:underline">reproducible</a>.
        The authoritative, amount-aware pre-transaction verdict is the paid{' '}
        <a href="https://a-identity-asp.onrender.com/proof" target="_blank" rel="noopener noreferrer" className="font-semibold text-accent hover:underline">risk_check on the OKX ASP</a>.
      </p>
    </motion.div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-foreground/50">{label}</span>
      <span className="text-right font-medium text-foreground">{children}</span>
    </div>
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

  async function lookup(raw: string) {
    const q = raw.trim()
    if (!q) return
    setLoading(true); setError(null)
    const [idRes, repRes] = await Promise.all([resolveAgent(q), getReputation(q)])
    const id = idRes.ok && idRes.data.found ? (idRes.data.agent ?? null) : null
    const rep = repRes.ok && repRes.data.found ? (repRes.data.reputation ?? null) : null
    setIdentity(id); setReputation(rep); setShown(q)
    if (!id && !rep) setError(`No agent found for "${q}". Try a token id like 849980, or an owner address.`)
    setLoading(false)
  }

  // Featured on load: the live ERC-8004 showcase agent (Meridian #849980).
  useEffect(() => { void lookup('849980') }, [])

  const onSubmit = (e: FormEvent) => { e.preventDefault(); void lookup(query) }

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className="min-h-screen w-full bg-background text-foreground" style={{ fontFamily: 'var(--font-body)' }}>
        <PageHeader />
        <main className="mx-auto w-full max-w-[860px] px-5 py-14 sm:px-8 sm:py-20">
          <motion.span {...reveal} className="text-sm font-semibold tracking-wide text-accent">Trust Explorer</motion.span>
          <motion.h1 {...reveal} className="mt-3 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl" style={{ fontFamily: 'var(--font-heading)' }}>
            Look up any agent&apos;s trust.
          </motion.h1>
          <motion.p {...reveal} className="mt-5 max-w-2xl text-lg leading-relaxed text-foreground/60">
            Search an agent by token id or owner address. See its on-chain identity, reputation, job-outcome behavior, and risk. No login, no mocks.
          </motion.p>

          <motion.form {...reveal} onSubmit={onSubmit} className="mt-8 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/40" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Token id (e.g. 849980) or 0x owner address"
                className="pl-10"
                aria-label="Agent query"
              />
            </div>
            <button type="submit" disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-60">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              {loading ? 'Looking up' : 'Explore'}
            </button>
          </motion.form>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-foreground/50">
            <span>Try:</span>
            <button onClick={() => { setQuery('849980'); void lookup('849980') }} className="rounded-full border border-border px-2.5 py-1 font-medium hover:bg-foreground/5">Meridian #849980</button>
          </div>

          <div className="mt-8">
            {error && <div className="rounded-2xl border border-border bg-card p-6 text-sm text-foreground/60">{error}</div>}
            {!error && (identity || reputation) && <TrustCard identity={identity} reputation={reputation} query={shown} />}
          </div>
        </main>
        <SiteFooter />
      </div>
    </div>
  )
}
