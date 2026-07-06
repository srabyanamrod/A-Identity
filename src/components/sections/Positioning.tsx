import { motion } from 'framer-motion'
import { Building2, Wallet, Fingerprint, Check, Minus } from 'lucide-react'
import type { ComponentType } from 'react'
import { EASE_OUT_EXPO } from '../../lib/brand'

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.6, ease: EASE_OUT_EXPO },
}

type Column = {
  icon: ComponentType<{ size?: number }>
  name: string
  blurb: string
  traits: { label: string; ok: boolean }[]
  highlight?: boolean
}

const COLUMNS: Column[] = [
  {
    icon: Building2,
    name: 'Card networks and banks',
    blurb: 'Mastercard Agent Pay, Visa TAP, and AP2. A human buys through an agent.',
    traits: [
      { label: 'Agent-to-agent native', ok: false },
      { label: 'Custodial, card rails', ok: false },
      { label: 'On-chain identity and reputation', ok: false },
      { label: 'Consumer checkout', ok: true },
    ],
  },
  {
    icon: Fingerprint,
    name: 'A-Identity',
    blurb: 'Open KYA identity (ERC-8004) plus x402 micro-payments, with the wallet abstracted away.',
    highlight: true,
    traits: [
      { label: 'Agent-to-agent native', ok: true },
      { label: 'Portable on-chain identity (KYA)', ok: true },
      { label: 'Sub-cent USDC settlement (x402)', ok: true },
      { label: 'Interoperable with AP2 mandates', ok: true },
    ],
  },
  {
    icon: Wallet,
    name: 'Raw Web3 wallets',
    blurb: 'Self-custody and on-chain settlement, but built for humans, not agents.',
    traits: [
      { label: 'Agent-to-agent native', ok: false },
      { label: 'Key management an agent can hold', ok: false },
      { label: 'On-chain identity and reputation', ok: true },
      { label: 'Abstracted UX', ok: false },
    ],
  },
]

export default function Positioning() {
  return (
    <section id="positioning" className="w-full bg-white px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-[1100px]">
        <motion.span {...reveal} className="text-sm font-semibold tracking-wide text-accent">
          Market and Positioning
        </motion.span>
        <motion.h2
          {...reveal}
          className="mt-4 max-w-2xl text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          The Web2.5 bridge for agent commerce.
        </motion.h2>
        <motion.p {...reveal} className="mt-5 max-w-2xl text-lg leading-relaxed text-ink/65">
          The rails for <span className="font-semibold text-ink">humans buying through agents</span>{' '}
          already exist. The open gap is{' '}
          <span className="font-semibold text-ink">agents transacting with each other</span>:
          proving identity and settling micro-payments without a human in every loop. That is where
          A-Identity lives.
        </motion.p>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {COLUMNS.map((col) => (
            <motion.div
              {...reveal}
              key={col.name}
              className={`flex flex-col rounded-2xl border p-7 ${
                col.highlight
                  ? 'border-accent/30 bg-accent/[0.05] shadow-[0_24px_64px_rgba(115,66,226,0.12)]'
                  : 'border-ink/10 bg-cream/40'
              }`}
            >
              <div
                className={`mb-4 grid h-11 w-11 place-items-center rounded-xl ${
                  col.highlight ? 'bg-accent text-white' : 'bg-ink/5 text-ink/70'
                }`}
              >
                <col.icon size={20} />
              </div>
              <h3 className="text-lg font-semibold text-ink">{col.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/60">{col.blurb}</p>

              <ul className="mt-5 flex flex-col gap-2.5 border-t border-ink/10 pt-5">
                {col.traits.map((t) => (
                  <li key={t.label} className="flex items-center gap-2.5 text-sm">
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                        t.ok ? 'bg-accent/15 text-accent' : 'bg-ink/8 text-ink/35'
                      }`}
                    >
                      {t.ok ? <Check size={12} /> : <Minus size={12} />}
                    </span>
                    <span className={t.ok ? 'text-ink/80' : 'text-ink/45'}>{t.label}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        <motion.p {...reveal} className="mt-8 text-sm text-ink/50">
          Interoperable, not isolated. We read AP2 mandates, settle over x402 and Arc, and carry
          ERC-8004 reputation. Peers like Skyfire, Nevermined, and Payman lead with payment. We
          lead with identity, then pay.
        </motion.p>
      </div>
    </section>
  )
}
