import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { EASE_OUT_EXPO } from '../../lib/brand'

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.6, ease: EASE_OUT_EXPO },
}

const POINTS = [
  'Wallets are handled for you by Circle Agent Wallets or Privy.',
  'Drop in a spec file and your service learns to charge for itself.',
  'Your manifest lists every tool, so agents find and use them on their own.',
]

const SNIPPET = `import { paidTool } from 'x402-mcp'

// An MCP tool any agent can call, and pay for, over HTTP 402.
server.addTool(
  paidTool({
    name: 'verify_agent',
    price: '$0.001',        // settled in USDC, no API keys
    network: 'arc',         // Circle Agent Wallets + Nanopayments
    handler: async ({ agentId }) => {
      const passport = await identity.resolve(agentId) // ERC-8004
      return { verified: passport.valid, score: passport.reputation }
    },
  }),
)`

export default function DeveloperExperience() {
  return (
    <section id="developers" className="w-full bg-ink px-5 py-20 text-white sm:px-8 sm:py-28">
      <div className="mx-auto grid max-w-[1100px] gap-12 lg:grid-cols-2 lg:items-center">
        <div>
          <motion.span {...reveal} className="text-sm font-semibold tracking-wide text-accent">
            Agent Experience (AX and DX)
          </motion.span>
          <motion.h2
            {...reveal}
            className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Integrate in "Describe and Leave" mode.
          </motion.h2>
          <motion.p {...reveal} className="mt-5 text-lg leading-relaxed text-white/65">
            You describe the capability. The agent layer wires up identity, payment, and settlement.
            No checkout pages, no key juggling.
          </motion.p>

          <ul className="mt-8 flex flex-col gap-3">
            {POINTS.map((p) => (
              <motion.li {...reveal} key={p} className="flex items-start gap-3 text-sm text-white/80">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent">
                  <Check size={13} />
                </span>
                {p}
              </motion.li>
            ))}
          </ul>
        </div>

        <motion.div
          {...reveal}
          className="overflow-hidden rounded-2xl border border-white/10 bg-[#10202d] shadow-2xl"
        >
          <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-white/20" />
            <span className="h-3 w-3 rounded-full bg-white/20" />
            <span className="h-3 w-3 rounded-full bg-white/20" />
            <span className="ml-3 text-xs text-white/40">server.ts</span>
          </div>
          <pre className="overflow-x-auto p-5 text-[12.5px] leading-relaxed text-white/85">
            <code>{SNIPPET}</code>
          </pre>
        </motion.div>
      </div>
    </section>
  )
}
