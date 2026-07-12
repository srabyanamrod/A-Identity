import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Bot, Check, Code, Server, ShieldCheck, Sparkles, User } from 'lucide-react'
import { DOCS_URL, EASE_OUT_EXPO } from '../../lib/brand'

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.6, ease: EASE_OUT_EXPO },
}

/* ---------------------------------------------------------- stablecoins --- */

type TokenKind = 'usdc' | 'usdt' | 'pyusd'

const TOKENS: Record<TokenKind, { label: string; color: string; glyph: ReactNode }> = {
  usdc: {
    label: 'USDC',
    color: '#2775CA',
    glyph: <span className="text-[13px] font-extrabold leading-none text-white">$</span>,
  },
  usdt: {
    label: 'USDT',
    color: '#26A17B',
    glyph: <span className="text-[14px] font-extrabold leading-none text-white">₮</span>,
  },
  pyusd: {
    label: 'PYUSD',
    color: '#0E2A8C',
    glyph: <span className="text-[13px] font-extrabold leading-none text-white">P</span>,
  },
}

/** A stablecoin that moves on its own. Pulsing aura plus a spark to read as an agent. */
function TokenCoin({ kind, size = 32 }: { kind: TokenKind; size?: number }) {
  const t = TOKENS[kind]
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{ background: t.color }}
        animate={{ scale: [1, 1.7, 1], opacity: [0.35, 0, 0.35] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
      />
      <div
        className="relative grid h-full w-full place-items-center rounded-full shadow-md ring-1 ring-black/10"
        style={{ background: t.color }}
      >
        {t.glyph}
        <span className="absolute -right-1 -top-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-white shadow">
          <Sparkles size={8} className="text-accent" />
        </span>
      </div>
    </div>
  )
}

/* ----------------------------------------------------- verify (KYA) lane --- */

const VERIFY_DUR = 7

function VerifyChip({ delay }: { delay: number }) {
  return (
    <motion.div
      className="absolute top-1/2 -translate-y-1/2"
      animate={{ left: ['-9%', '109%'] }}
      transition={{ duration: VERIFY_DUR, repeat: Infinity, ease: 'linear', delay }}
    >
      <motion.div
        className="relative grid h-11 w-11 place-items-center rounded-full bg-white"
        animate={{
          boxShadow: [
            '0 0 0 2px rgba(25,40,55,0.18)',
            '0 0 0 2px rgba(25,40,55,0.18)',
            '0 0 0 2px rgba(26,171,122,0.95)',
            '0 0 0 2px rgba(26,171,122,0.95)',
          ],
        }}
        transition={{
          duration: VERIFY_DUR,
          repeat: Infinity,
          ease: 'linear',
          delay,
          times: [0, 0.46, 0.56, 1],
        }}
      >
        <Bot size={20} className="text-accent" />
        <motion.span
          className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-emerald-500 text-white"
          animate={{ opacity: [0, 0, 1, 1], scale: [0.5, 0.5, 1, 1] }}
          transition={{
            duration: VERIFY_DUR,
            repeat: Infinity,
            ease: 'linear',
            delay,
            times: [0, 0.5, 0.58, 1],
          }}
        >
          <Check size={10} />
        </motion.span>
      </motion.div>
    </motion.div>
  )
}

function VerifyLane() {
  return (
    <div className="relative h-40 overflow-hidden rounded-2xl border border-ink/10 bg-cream/40">
      {/* track */}
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-ink/10" />

      {/* KYA gate */}
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2">
        <motion.div
          className="h-full w-[3px] bg-accent/40"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-white">
          KYA gate
        </div>
      </div>

      {/* labels (hidden on very small screens to avoid overlapping the gate) */}
      <span className="absolute left-3 top-3 hidden text-[11px] font-semibold text-ink/45 sm:block">
        Unverified
      </span>
      <span className="absolute right-3 top-3 hidden items-center gap-1 text-[11px] font-semibold text-emerald-600 sm:inline-flex">
        <ShieldCheck size={12} /> ERC-8004 verified
      </span>

      {[0, VERIFY_DUR / 3, (VERIFY_DUR / 3) * 2].map((d, i) => (
        <VerifyChip key={i} delay={d} />
      ))}
    </div>
  )
}

/* ---------------------------------------------------------- pay lane --- */

const NODES = {
  agentA: { x: 14, y: 64 },
  agentB: { x: 86, y: 64 },
  human: { x: 50, y: 18 },
} as const

type Pt = { x: number; y: number }
const mid = (a: Pt, b: Pt, lift = 0): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - lift })

function FlowCoin({
  from,
  to,
  kind,
  delay,
  dur = 4,
  lift = 8,
}: {
  from: Pt
  to: Pt
  kind: TokenKind
  delay: number
  dur?: number
  lift?: number
}) {
  const m = mid(from, to, lift)
  return (
    <motion.div
      className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
      animate={{
        left: [`${from.x}%`, `${m.x}%`, `${to.x}%`, `${to.x}%`],
        top: [`${from.y}%`, `${m.y}%`, `${to.y}%`, `${to.y}%`],
        opacity: [0, 1, 1, 0],
      }}
      transition={{ duration: dur, repeat: Infinity, ease: 'easeInOut', delay, times: [0, 0.45, 0.82, 1] }}
    >
      <TokenCoin kind={kind} size={30} />
    </motion.div>
  )
}

function Node({ pt, icon, label }: { pt: Pt; icon: ReactNode; label: string }) {
  return (
    <div className="absolute z-20" style={{ left: `${pt.x}%`, top: `${pt.y}%`, transform: 'translate(-50%,-50%)' }}>
      <div className="relative grid place-items-center">
        <motion.span
          className="absolute inset-0 rounded-2xl bg-accent/15"
          animate={{ scale: [1, 1.35, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
        />
        <div className="relative grid h-12 w-12 place-items-center rounded-2xl border border-ink/10 bg-white text-accent shadow-sm">
          {icon}
        </div>
      </div>
      <div className="mt-1.5 text-center text-[11px] font-semibold text-ink/70">{label}</div>
    </div>
  )
}

function PayLane() {
  return (
    <div className="relative h-64 overflow-hidden rounded-2xl border border-ink/10 bg-cream/40">
      {/* connectors */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {(
          [
            [NODES.agentA, NODES.agentB],
            [NODES.agentA, NODES.human],
            [NODES.human, NODES.agentB],
          ] as const
        ).map(([a, b], i) => (
          <line
            key={i}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="rgba(25,40,55,0.14)"
            strokeWidth={1}
            strokeDasharray="2 2"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      {/* edge labels */}
      <span className="absolute left-1/2 top-[58%] -translate-x-1/2 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-ink/55 shadow-sm">
        agent to agent, x402
      </span>
      <span className="absolute left-[27%] top-[36%] -translate-x-1/2 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-ink/55 shadow-sm">
        agent to human
      </span>

      {/* nodes */}
      <Node pt={NODES.agentA} icon={<Bot size={22} />} label="Agent A" />
      <Node pt={NODES.agentB} icon={<Bot size={22} />} label="Agent B" />
      <Node pt={NODES.human} icon={<User size={22} />} label="Human (approves)" />

      {/* flowing value */}
      <FlowCoin from={NODES.agentA} to={NODES.agentB} kind="usdc" delay={0} />
      <FlowCoin from={NODES.agentA} to={NODES.human} kind="usdt" delay={1.3} />
      <FlowCoin from={NODES.human} to={NODES.agentB} kind="pyusd" delay={2.6} />
    </div>
  )
}

/* ------------------------------------------------------------- section --- */

export default function Web25Layer() {
  return (
    <section className="w-full bg-white px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-[1100px]">
        <motion.span {...reveal} className="text-base font-semibold tracking-wide text-accent">
          The Web2.5 Layer
        </motion.span>
        <motion.h2
          {...reveal}
          className="mt-4 max-w-2xl text-2xl font-bold leading-tight tracking-tight text-ink sm:text-3xl"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Verify first. Then pay, at machine speed.
        </motion.h2>
        <motion.p {...reveal} className="mt-5 max-w-2xl text-lg leading-relaxed text-ink/65">
          First the agent proves who it is. Then it pays, in stablecoins, inside limits both
          sides agreed to. Web2 trust, running on Web3 rails.
        </motion.p>

        {/* legend */}
        <motion.div {...reveal} className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-ink/60">
          <span className="font-semibold text-ink/70">Settled in:</span>
          {(['usdc', 'usdt', 'pyusd'] as const).map((k) => (
            <span key={k} className="inline-flex items-center gap-2">
              <TokenCoin kind={k} size={26} /> {TOKENS[k].label}
            </span>
          ))}
        </motion.div>

        {/* lanes */}
        <motion.div {...reveal} className="mt-8 grid gap-5">
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <span className="grid h-6 w-6 place-items-center rounded-md bg-accent/10 text-accent">1</span>
                First, prove the agent is real
              </div>
              <a
                href={`${DOCS_URL}/concepts/know-your-agent`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
              >
                Read the story <ArrowRight size={13} />
              </a>
            </div>
            <VerifyLane />
          </div>
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-accent/10 text-accent">2</span>
              Then pay, under permissions both sides set
            </div>
            <PayLane />
          </div>
        </motion.div>

        {/* Integration offer: use it like an SDK / MCP server */}
        <motion.div
          {...reveal}
          className="mt-5 flex flex-col gap-4 rounded-2xl border border-ink/10 bg-cream/40 p-6 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h3 className="font-semibold text-ink">Want this in your own project?</h3>
            <p className="mt-1 text-sm text-ink/60">
              We expose the same verify and pay flow as an SDK and an MCP server, so any
              agent or service can plug in.
            </p>
          </div>
          <div className="flex shrink-0 gap-3">
            <a
              href={`${DOCS_URL}/developers/sdk`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.03]"
            >
              <Code size={16} /> SDK
            </a>
            <a
              href={`${DOCS_URL}/developers/mcp-server`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-4 py-2.5 text-sm font-semibold text-ink/80 transition-transform hover:scale-[1.03]"
            >
              <Server size={16} /> MCP
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
