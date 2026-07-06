import type { ComponentType } from 'react'
import { motion } from 'framer-motion'
import { ArrowUpRight, Code, Coins, Fingerprint, Network, Server } from 'lucide-react'
import { DOCS_URL, EASE_OUT_EXPO } from '../../lib/brand'

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.6, ease: EASE_OUT_EXPO },
}

type Pillar = {
  tag: string
  title: string
  icon: ComponentType<{ size?: number }>
  body: string
  spec: string
  href: string
}

const PILLARS: Pillar[] = [
  {
    tag: 'Verify',
    title: 'Know Your Agent',
    icon: Fingerprint,
    body: 'Every agent gets an ID card that lives on-chain, plus a reputation it earns over time. No company hands it out or takes it away. Anyone can check it, no permission needed.',
    spec: 'ERC-8004, live on Ethereum mainnet',
    href: `${DOCS_URL}/protocols/erc-8004`,
  },
  {
    tag: 'Pay',
    title: 'Pay-per-action',
    icon: Coins,
    body: 'Agents pay per request, the way a meter charges per minute. No accounts, no API keys. The payment rides along with the call and clears in about 200ms.',
    spec: 'x402, USDC micro-payments',
    href: `${DOCS_URL}/protocols/x402`,
  },
  {
    tag: 'Connect',
    title: 'Native tool access',
    icon: Network,
    body: 'MCP is the socket an agent plugs into to reach your data and tools. Put a price on any tool and it gets paid on its own through x402.',
    spec: 'MCP, x402-mcp paid tools',
    href: `${DOCS_URL}/protocols/mcp`,
  },
]

export default function Pillars() {
  return (
    <section id="pillars" className="w-full bg-cream px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-[1100px]">
        <motion.span {...reveal} className="text-sm font-semibold tracking-wide text-accent">
          The Underlying Magic
        </motion.span>
        <motion.h2
          {...reveal}
          className="mt-4 max-w-2xl text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Three protocols, one agent-native stack.
        </motion.h2>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {PILLARS.map(({ tag, title, icon: Icon, body, spec, href }) => (
            <motion.div
              {...reveal}
              key={tag}
              className="flex flex-col rounded-2xl border border-ink/10 bg-white p-7"
            >
              <div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-accent text-white">
                <Icon size={22} />
              </div>
              <div className="text-xs font-bold tracking-wide text-accent">{tag}</div>
              <h3 className="mt-1 text-xl font-semibold text-ink">{title}</h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-ink/60">{body}</p>
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="mt-5 flex items-center justify-between border-t border-ink/10 pt-4 text-xs font-medium text-ink/45 transition-colors hover:text-accent"
              >
                {spec}
                <ArrowUpRight size={14} />
              </a>
            </motion.div>
          ))}
        </div>

        {/* Integration buttons, straight to the docs */}
        <motion.div {...reveal} className="mt-8 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-ink/55">Read the integration docs:</span>
          <a
            href={`${DOCS_URL}/developers/sdk`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.03]"
          >
            <Code size={16} /> SDK
          </a>
          <a
            href={`${DOCS_URL}/developers/mcp-server`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink/80 transition-transform hover:scale-[1.03]"
          >
            <Server size={16} /> MCP
          </a>
        </motion.div>
      </div>
    </section>
  )
}
