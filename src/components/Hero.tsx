import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { EASE_OUT_EXPO } from '../lib/brand'
import { getLeaderboard, type FeedAgent } from '../lib/mcp-client'

/*
 * The hero IS the product: a minimal headline plus a live trust card that rotates through
 * REAL agents (from the Agent House feed) — animated reputation + ALLOW/WARN/DENY, click to
 * switch or open the full explorer. Palette unchanged (accent #7342E2 + ink + cream); the
 * status hues (green/amber/red) are the same functional risk colors used on /explorer.
 */

const ACCENT = '#7342E2'
const RISK = { ALLOW: '#059669', WARN: '#d97706', DENY: '#dc2626' } as const
type Verdict = keyof typeof RISK
const riskOf = (s: number, kya?: string): Verdict => (kya === 'revoked' || s < 200 ? 'DENY' : s < 500 ? 'WARN' : 'ALLOW')
const gradeOf = (s: number) =>
  s >= 800 ? 'Excellent' : s >= 650 ? 'Strong' : s >= 500 ? 'Good' : s >= 350 ? 'Fair' : s >= 200 ? 'Weak' : 'High risk'

const FALLBACK: FeedAgent[] = [
  { id: '849980', name: 'Meridian', category: 'Showcase', kya: 'verified', onchainAgentId: '849980', reputation: { score: 541 } },
  { id: '850002', name: 'Persofoni', category: 'Data', kya: 'verified', onchainAgentId: '850002', reputation: { score: 397 } },
]

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20, filter: 'blur(8px)' },
  visible: (i: number) => ({ opacity: 1, y: 0, filter: 'blur(0px)', transition: { delay: i * 0.12, duration: 0.7, ease: EASE_OUT_EXPO } }),
}

function hash(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h
}
function Identicon({ seed, size = 40 }: { seed: string; size?: number }) {
  const h = hash(seed)
  const hue = h % 360
  const fg = `hsl(${hue} 62% 52%)`
  const at = (r: number, c: number) => ((h >> (r * 3 + (c < 3 ? c : 4 - c))) & 1) === 1
  const u = size / 5
  return (
    <svg width={size} height={size} className="shrink-0 rounded-lg" style={{ background: `hsl(${hue} 40% 96% / 0.08)` }}>
      {Array.from({ length: 5 }).map((_, r) => Array.from({ length: 5 }).map((_, c) => (at(r, c) ? <rect key={`${r}-${c}`} x={c * u} y={r * u} width={u} height={u} fill={fg} /> : null)))}
    </svg>
  )
}

function useCountUp(target: number, duration = 900) {
  const [val, setVal] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    const start = performance.now()
    const begin = from.current
    let raf = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - start) / duration)
      setVal(Math.round(begin + (target - begin) * (1 - Math.pow(1 - t, 3))))
      if (t < 1) raf = requestAnimationFrame(tick)
      else from.current = target
    })
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return val
}

function TrustCard({ agents }: { agents: FeedAgent[] }) {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (paused || agents.length < 2) return
    const id = setInterval(() => setI((x) => (x + 1) % agents.length), 3800)
    return () => clearInterval(id)
  }, [paused, agents.length])

  const a = agents[i] ?? agents[0]
  const score = a?.reputation?.score ?? 0
  const shown = useCountUp(score)
  const v = riskOf(score, a?.kya)
  const seed = a?.onchainAgentId || a?.id || 'x'

  return (
    <motion.div
      custom={2} variants={fadeUp} initial="hidden" animate="visible"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      className="w-full max-w-[420px] rounded-2xl border border-border bg-card/90 p-6 shadow-[0_24px_70px_-30px_rgba(20,28,38,0.55)] backdrop-blur-xl"
    >
      <AnimatePresence mode="wait">
        <motion.div key={seed} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Identicon seed={seed} />
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-foreground">{a?.name ?? 'Agent'}</div>
                <div className="truncate font-mono text-[11px] text-foreground/45">{a?.onchainAgentId ? `#${a.onchainAgentId}` : a?.id} · KYA {a?.kya ?? '—'}</div>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold" style={{ color: RISK[v], background: `${RISK[v]}14`, boxShadow: `inset 0 0 0 1px ${RISK[v]}33` }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: RISK[v] }} /> {v}
            </span>
          </div>

          <div className="mt-5 flex items-baseline gap-2">
            <span className="font-mono text-5xl font-bold tabular-nums tracking-tight text-foreground">{shown}</span>
            <span className="font-mono text-sm text-foreground/35">/ 1000</span>
            <span className="ml-auto text-xs font-semibold" style={{ color: RISK[v] }}>{gradeOf(score)}</span>
          </div>
          <div className="mt-3 h-2 w-full rounded-full" style={{ background: 'linear-gradient(90deg,#dc2626,#d97706 45%,#059669)' }}>
            <div className="relative h-full">
              <motion.span className="absolute -top-1 h-4 w-[3px] -translate-x-1/2 rounded-full bg-foreground shadow-[0_0_0_2px_var(--color-card)]"
                initial={{ left: 0 }} animate={{ left: `${Math.max(0, Math.min(100, score / 10))}%` }} transition={{ duration: 0.9, ease: EASE_OUT_EXPO }} />
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* switcher dots + explore */}
      <div className="mt-5 flex items-center justify-between">
        <div className="flex gap-1.5">
          {agents.slice(0, 6).map((ag, idx) => (
            <button key={ag.id} aria-label={`Show ${ag.name}`} onClick={() => setI(idx)}
              className="h-1.5 rounded-full transition-all" style={{ width: idx === i ? 18 : 6, background: idx === i ? ACCENT : 'color-mix(in srgb, var(--foreground) 20%, transparent)' }} />
          ))}
        </div>
        <Link to="/explorer" className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
          Explore all <ArrowUpRight size={13} />
        </Link>
      </div>
    </motion.div>
  )
}

export default function Hero() {
  const navigate = useNavigate()
  const [agents, setAgents] = useState<FeedAgent[]>(FALLBACK)

  useEffect(() => {
    void getLeaderboard().then((r) => {
      if (r.ok) {
        const live = r.data.filter((x) => (x.reputation?.score ?? 0) > 0).slice(0, 6)
        if (live.length) setAgents(live)
      }
    })
  }, [])

  return (
    <section className="relative z-10 mx-auto w-full max-w-[1280px] px-5 sm:px-8" style={{ paddingTop: 'clamp(40px, 8vw, 72px)' }}>
      <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_minmax(0,440px)]">
        {/* left: minimal headline + CTA */}
        <div>
          <motion.h1 custom={0} variants={fadeUp} initial="hidden" animate="visible"
            style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(2.2rem, 6vw, 4rem)', lineHeight: 1.02, letterSpacing: '-0.03em', color: 'var(--foreground)' }}>
            Trust, before<br />you pay.
          </motion.h1>

          <motion.p custom={1} variants={fadeUp} initial="hidden" animate="visible"
            className="mt-5 max-w-md text-foreground/65"
            style={{ fontFamily: 'var(--font-body)', fontSize: 'clamp(0.95rem, 2.4vw, 1.12rem)', lineHeight: 1.6 }}>
            A verified on-chain identity and a bounded wallet for every AI agent.
          </motion.p>

          <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible" className="mt-8 flex flex-wrap items-center gap-4">
            <motion.button type="button" onClick={() => navigate('/signup')} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-3 rounded-full px-6 py-3.5 text-sm font-semibold text-white sm:text-base"
              style={{ background: ACCENT, boxShadow: '0 10px 34px rgba(115,66,226,0.34)', border: '1px solid transparent' }}>
              Get your Agent ID <ArrowRight size={18} />
            </motion.button>
            <Link to="/explorer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground/70 transition-colors hover:text-foreground sm:text-base">
              Explore trust <ArrowUpRight size={16} />
            </Link>
          </motion.div>
        </div>

        {/* right: live trust card */}
        <div className="justify-self-center lg:justify-self-end">
          <TrustCard agents={agents} />
        </div>
      </div>
    </section>
  )
}
