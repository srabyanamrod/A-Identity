import type { ComponentType } from 'react'
import { motion } from 'framer-motion'
import { Activity, ShieldCheck, Target, Users, Zap } from 'lucide-react'
import { EASE_OUT_EXPO } from '../../lib/brand'

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.6, ease: EASE_OUT_EXPO },
}

type Signal = {
  value: string
  label: string
  note: string
  icon: ComponentType<{ size?: number }>
  /** 0 to 100, a rough visual fill so the numbers read as momentum. */
  fill: number
}

/** Real, ecosystem-wide signals (not A-Identity's own traction). */
const SIGNALS: Signal[] = [
  { value: '169M+', label: 'x402 payments processed', note: 'ecosystem, to date', icon: Activity, fill: 92 },
  { value: 'Live', label: 'ERC-8004 on Ethereum mainnet', note: 'since Jan 2026', icon: ShieldCheck, fill: 100 },
  { value: '$0.000001', label: 'min USDC nanopayment', note: 'Circle Arc', icon: Zap, fill: 70 },
  { value: '60+', label: 'AP2 launch partners', note: 'now FIDO-governed', icon: Users, fill: 60 },
]

/** A-Identity milestones, labeled as targets, not achieved metrics. */
const TARGETS = [
  'Distribution first: ship the A-Identity SDK into popular agent frameworks (AutoGPT, LangChain).',
  'Become a default KYA and agent-to-agent settlement layer for machine commerce.',
  'Run the first 1,000 agent-to-agent settlements on a public testnet.',
]

export default function Vision() {
  return (
    <section className="w-full px-5 py-20 sm:px-8 sm:py-28" style={{ background: '#F4F1FB' }}>
      <div className="mx-auto max-w-[1100px]">
        <motion.span {...reveal} className="text-sm font-semibold tracking-wide text-accent">
          Where This Goes
        </motion.span>
        <motion.h2
          {...reveal}
          className="mt-4 max-w-2xl text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Built for a trillion-dollar agentic economy.
        </motion.h2>

        {/* Ecosystem signals (real) */}
        <p className="mt-8 text-xs font-semibold tracking-wide text-ink/45">Ecosystem signals today</p>
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {SIGNALS.map(({ value, label, note, icon: Icon, fill }) => (
            <motion.div
              {...reveal}
              key={label}
              className="rounded-2xl border border-ink/10 bg-white p-5"
            >
              <div className="mb-3 grid h-9 w-9 place-items-center rounded-xl bg-accent/10 text-accent">
                <Icon size={18} />
              </div>
              <div className="text-2xl font-bold tracking-tight text-ink">{value}</div>
              <div className="mt-1 text-sm font-medium text-ink/70">{label}</div>
              <div className="mt-0.5 text-xs text-ink/40">{note}</div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ink/8">
                <motion.div
                  className="h-full rounded-full bg-accent"
                  initial={{ width: 0 }}
                  whileInView={{ width: `${fill}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, ease: EASE_OUT_EXPO }}
                />
              </div>
            </motion.div>
          ))}
        </div>

        {/* A-Identity targets (aspirational) */}
        <p className="mt-10 text-xs font-semibold tracking-wide text-ink/45">A-Identity targets</p>
        <ul className="mt-4 flex flex-col gap-3">
          {TARGETS.map((t) => (
            <motion.li
              {...reveal}
              key={t}
              className="flex items-start gap-3 rounded-2xl border border-accent/15 bg-white p-4"
            >
              <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-accent/10 px-2 py-1 text-[11px] font-bold tracking-wide text-accent">
                <Target size={12} /> Target
              </span>
              <span className="text-sm leading-relaxed text-ink/70">{t}</span>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  )
}
