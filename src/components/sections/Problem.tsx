import { motion } from 'framer-motion'
import { CreditCard, UserX } from 'lucide-react'
import { EASE_OUT_EXPO } from '../../lib/brand'

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.6, ease: EASE_OUT_EXPO },
}

const FRICTIONS = [
  {
    icon: UserX,
    title: 'KYC is built for humans',
    body: 'Onboarding and fraud checks all assume a person behind the screen. An agent has no passport of its own.',
  },
  {
    icon: CreditCard,
    title: 'Payments still wear a human costume',
    body: 'An agent can fill the cart, then freezes at checkout. Card numbers were made for a person typing them in.',
  },
] as const

export default function Problem() {
  return (
    <section className="w-full bg-white px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-[1100px]">
        <motion.span {...reveal} className="text-sm font-semibold tracking-wide text-accent">
          The Friction
        </motion.span>

        <motion.h2
          {...reveal}
          className="mt-4 max-w-3xl text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Agents can book your flight. They still pay with your 16-digit card.
        </motion.h2>

        <motion.p {...reveal} className="mt-5 max-w-2xl text-lg leading-relaxed text-ink/65">
          The hard part is no longer making agents smart. It is letting them trust and pay
          each other. A-Identity solves both, so money moves as fast as the agents do.
        </motion.p>

        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {FRICTIONS.map(({ icon: Icon, title, body }) => (
            <motion.div
              {...reveal}
              key={title}
              className="rounded-2xl border border-ink/10 bg-cream/50 p-7"
            >
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-accent/10 text-accent">
                <Icon size={20} />
              </div>
              <h3 className="text-lg font-semibold text-ink">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/60">{body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
