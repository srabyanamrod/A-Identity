import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowUpRight, ChevronDown } from 'lucide-react'
import { EASE_OUT_EXPO } from '../../lib/brand'

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.6, ease: EASE_OUT_EXPO },
}

type Item = { q: string; a: string; tag?: string }
type Group = { category: string; items: Item[] }

// Ordered general to specific: basics, how it works, who and why, for builders.
const GROUPS: Group[] = [
  {
    category: 'The basics',
    items: [
      {
        q: `What is A-Identity?`,
        a: `A-Identity is the identity and payment layer for AI agents. It gives every agent two core tools: a verified ID, and a wallet to pay from. Built on Arc, it lets an agent prove who it is before any payment happens.`,
      },
      {
        q: `Why do AI agents need identity?`,
        a: `Agents already connect to apps, APIs, and each other. But they still cannot always prove who they are. Without identity there is no trust, and without trust agent-to-agent commerce cannot scale. A-Identity fixes this with a KYA gate and ERC-8004 verification.`,
      },
      {
        q: `What does "KYA" mean?`,
        a: `KYA means Know Your Agent. It is an identity check for AI agents. Before an agent can act, connect, or pay, it has to pass verification.`,
        tag: `No verified agent, no trusted transaction.`,
      },
      {
        q: `What is ERC-8004 used for?`,
        a: `ERC-8004 is the verification layer for agent identity. It gives an agent a verified status that other systems can recognize as trusted, traceable, and approved. In short, ERC-8004 gives the agent proof.`,
      },
      {
        q: `Why do AI agents need wallets?`,
        a: `Agents are moving from chat tools to digital workers. They can search, compare, negotiate, and finish tasks. Once an agent creates real value, it needs a secure way to pay or get paid. A-Identity gives it a wallet built for the agentic economy.`,
      },
    ],
  },
  {
    category: 'How it works',
    items: [
      {
        q: `How do agent-to-agent payments work?`,
        a: `A-Identity uses x402. The agent proves who it is, receives verified status, then pays another agent through x402, and value settles in stablecoins (USDC, USDT, or PYUSD).`,
      },
      {
        q: `What does "Web2 trust, Web3 rails" mean?`,
        a: `The experience stays familiar, like Web2, so real users and businesses can trust it. The payment and settlement run on Web3 rails. You get clear identity, stablecoin settlement, faster payments, and human approval when value moves.`,
      },
      {
        q: `What role does Arc play?`,
        a: `Arc powers the infrastructure. It connects identity, verification, payments, and settlement into one agent-native flow, with gas paid in USDC and sub-second finality. Arc handles the protocol layer; A-Identity makes it usable for agents, builders, and businesses.`,
      },
      {
        q: `When does a human approve the payment?`,
        a: `A human approves when real value moves. The agent runs at machine speed, but payment approval stays controlled. Fast, without removing human responsibility.`,
      },
      {
        q: `Is A-Identity a crypto wallet?`,
        a: `Not only. The wallet is one part. A-Identity is a trust and payment layer for AI agents, and the verified identity is the foundation. In agent commerce, payment should never come before proof.`,
      },
      {
        q: `Which stablecoins and networks does it support?`,
        a: `Settlement is in stablecoins, mainly USDC, with USDT and PYUSD too. Payments run across Arc, Base, Arbitrum, Stellar, and Algorand. Identity uses ERC-8004 on the EVM chains, bridged to the rest.`,
      },
      {
        q: `Is my data exposed when an agent gets verified?`,
        a: `The roadmap uses zero-knowledge proofs. An agent can prove a claim, such as "reputation above X" or "authorized for Y", without revealing the underlying data. Verify the fact, not the file.`,
      },
    ],
  },
  {
    category: 'Who it is for, and why now',
    items: [
      {
        q: `Who is A-Identity built for?`,
        a: `AI agent builders, fintech products, agent-native marketplaces, Web2.5 platforms, protocol teams, automation companies, AI commerce products, and enterprise workflows. Any product where agents need to prove, act, and pay.`,
      },
      {
        q: `What problem does A-Identity solve?`,
        a: `Most agentic workflows break at the same point: the agent can talk, but it cannot prove, and it cannot pay safely. A-Identity closes that gap with a passport and wallet for real economic activity.`,
      },
      {
        q: `What makes A-Identity different?`,
        a: `It combines three things in one flow: identity through KYA and ERC-8004, payments through x402, and settlement through USDC, USDT, and PYUSD.`,
        tag: `Verify first. Pay at machine speed.`,
      },
      {
        q: `Why does this matter now?`,
        a: `Agents are multiplying fast. Soon they will not only answer questions; they will complete transactions, coordinate services, and move value. That economy needs infrastructure, so we are building the trust layer before the payment layer.`,
      },
      {
        q: `What is the simplest way to describe A-Identity?`,
        a: `A passport, a wallet, and a proof layer before payment. Built for Web2.5, designed for the agent economy.`,
      },
    ],
  },
  {
    category: 'For builders',
    items: [
      {
        q: `How can builders use A-Identity?`,
        a: `Add verified agent identity and agent-native payments to your product. Instead of building trust, verification, payment, and settlement from scratch, plug into the A-Identity flow through the SDK or the MCP server.`,
      },
      {
        q: `How do I add A-Identity to my project?`,
        a: `Two ways. Embed the SDK in your agent, or connect the MCP server so any agent can reach you. The MCP server is read-only today and needs no code in the agent. The developer docs cover both.`,
      },
      {
        q: `What is the core principle?`,
        a: `Proof before payment. Every agent verifies first. Every payment moves only after trust is established. That is the foundation of A-Identity.`,
      },
    ],
  },
]

// Flatten for a single open-at-a-time accordion across all groups.
const FLAT = GROUPS.flatMap((g) => g.items)

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0)
  let runningIndex = -1

  return (
    <section id="faq" className="w-full bg-cream px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-[820px]">
        <motion.span {...reveal} className="text-sm font-semibold tracking-wide text-accent">
          FAQ
        </motion.span>
        <motion.h2
          {...reveal}
          className="mt-4 text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Questions humans (still) ask.
        </motion.h2>

        <div className="mt-10 flex flex-col gap-10">
          {GROUPS.map((group) => (
            <div key={group.category}>
              <motion.h3
                {...reveal}
                className="mb-3 text-xs font-bold uppercase tracking-widest text-ink/40"
              >
                {group.category}
              </motion.h3>
              <div className="flex flex-col gap-3">
                {group.items.map((item) => {
                  runningIndex += 1
                  const i = runningIndex
                  const isOpen = open === i
                  return (
                    <motion.div
                      {...reveal}
                      key={item.q}
                      className="overflow-hidden rounded-2xl border border-ink/10 bg-white"
                    >
                      <button
                        type="button"
                        onClick={() => setOpen(isOpen ? null : i)}
                        aria-expanded={isOpen}
                        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                      >
                        <span className="font-semibold text-ink">{item.q}</span>
                        <ChevronDown
                          size={20}
                          className={`shrink-0 text-accent transition-transform duration-300 ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      {/* Answers stay mounted (agent-parsable); the grid-rows
                          0fr to 1fr trick collapses them with pure CSS. */}
                      <div
                        className="grid transition-all duration-300 ease-out"
                        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr', opacity: isOpen ? 1 : 0 }}
                      >
                        <div className="overflow-hidden">
                          <div className="px-6 pb-6">
                            <p className="text-sm leading-relaxed text-ink/65">{item.a}</p>
                            {item.tag && (
                              <p className="mt-3 text-sm font-bold text-accent">{item.tag}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Closing CTA */}
        <motion.div
          {...reveal}
          className="mt-12 rounded-3xl border border-accent/20 bg-accent/[0.05] p-8 text-center sm:p-10"
        >
          <h3 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
            Building agent-native products?
          </h3>
          <p className="mx-auto mt-3 max-w-xl text-ink/65">
            A-Identity gives your agents verified identity, wallets, and payment infrastructure
            built for the next economy.
          </p>
          <p className="mt-4 font-bold text-accent">Verify first. Pay at machine speed.</p>
          <Link
            to="/signup"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.03]"
          >
            Get Your Agent ID <ArrowUpRight size={16} />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}

// Exposed for any future count badge or sitemap use.
export const FAQ_COUNT = FLAT.length
