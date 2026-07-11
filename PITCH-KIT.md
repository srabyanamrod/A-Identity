# A-Identity — Pitch & Marketing Kit 🎤

> Date: 2026-07-09 · Branch: `review/critical-gaps`
> This doc is **not technical**. Goal: let the Marketing/Presentation lead speak confidently to judges, in the deck, and on Demo Day.
> Team: one Developer (backend/protocol) · one Marketing/Presentation lead.
>
> ⚠️ **Honesty rule:** below, items are marked "LIVE NOW" vs "by Aug 9". Only promise the judges what will actually work on that date — don't oversell; judges open the code.

---

## 1. The product, in one line

**A-Identity = a passport + wallet for AI agents.**
We give an AI agent (software that acts on your behalf) both a *trusted identity* and a *wallet whose limits you set* — so the agent can spend money but can't run wild.

**Tagline options:**
- "The passport and wallet for the agentic economy." *(current)*
- "Verified agents. Bounded spending. Real USDC."
- "An identity you can trust your agent with — and a wallet it can't run wild with."

---

## 2. Problem → Solution → Why now (the pitch skeleton)

**Problem.** AI agents now act for you, but the moment money is involved nobody can trust them: Who is this agent, really? How much can it spend? What if its wallet is hijacked and it drains everything? Today there's no standard, safe way to let agents pay.

**Solution.** A-Identity gives two things:
1. **A passport** — the agent's verifiable, on-chain identity (so others can trust it before transacting).
2. **A guarded wallet** — daily cap, auto-approve line, payee allowlist. Under the line the agent pays automatically; above it, it **asks a human**.

**Why now.** Circle just shipped its "Agent Stack," Arc (Circle's stablecoin chain) is live, and the agentic economy (agents paying each other) is taking off. The rails just became ready — we add the trust + control layer on top.

---

## 3. Winning thesis: **"bounded authority"** 🔑

This is the line that sets us apart and that judges love. Encode's own page even features the idea:

> *"Bounded authority is the only way M2M scales... if it can't run amok, it's safe."*

**The one-liner to memorize:** *"Everyone is trying to let agents pay. We guarantee how much, to whom, and under what rules an agent can pay. Autonomous payments don't scale without trust — we bring that trust."*

---

## 4. Judging criteria → how to talk to each

Both hackathons' Agentic Economy tracks look for the following. When you speak, make this mapping explicit:

| What judges want | Our answer (talking point) |
|---|---|
| "Clear decision logic" | "Every agent payment runs through a policy engine: cap, allowlist, approval line." |
| "Autonomous spending/settlement" | "Payments under the line settle without a human, in USDC on Arc." |
| "Micro-payments" | "Service-to-service sub-cent payments use a **real x402 rail** — pay-per-call USDC on Arc, verified on-chain (0.001 USDC/call)." |
| "Demonstrable autonomy" | "Every transaction is visible on arcscan — live, real testnet txs." |
| "Bounded authority / zero-trust" | See section 3 — this is our core differentiator. |

---

## 5. 3-minute video demo script 🎬

*(Developer drives the screen, Marketing narrates. Keep it short and real.)*

| Time | Screen | What to say |
|---|---|---|
| 0:00–0:20 | Title / problem visual | "AI agents act for you — but when money is on the line, how do you trust them?" |
| 0:20–0:40 | Product home | "A-Identity: a passport + a guarded wallet for agents." |
| 0:40–1:10 | Register agent → identity on Arc | "We register the agent; a **real** ERC-8004 identity is minted on Arc." *(→ show the tx on arcscan)* |
| 1:10–1:40 | Permissions screen | "Daily cap, auto-approve line, allowlist — a human sets the rules." |
| 1:40–2:20 | Agent makes a payment | "The agent pays a service in USDC (x402 pay-per-call + on-chain policy vault): under the line it's automatic; **above it the vault reverts on Arc and a human is asked.**" *(show both — including the on-chain revert)* |
| 2:20–2:40 | Agent House / reputation | "Reputation builds from real settlements; others can trust it." |
| 2:40–3:00 | Close | "Live today on Arc + Circle. Vision: a safe financial identity for every agent." |

> **Rule:** every link/tx you show must actually work. No placeholders on camera.

---

## 6. Deck outline (≈10 slides)

1. **Title** — logo + tagline + "Arc / Circle · Agentic Economy Track"
2. **Problem** — money can't be entrusted to agents (no trust + no control)
3. **Why now** — Circle Agent Stack, Arc live, agentic economy rising
4. **Solution** — passport (identity) + guarded wallet (guardrails)
5. **How it works** — 3 steps: Register → Set rules → Pay autonomously (simple diagram)
6. **Live proof** — real ERC-8004 registration on Arc, arcscan tx screenshot
7. **The edge: bounded authority** — "an agent that can't run amok" (section 3)
8. **Circle stack** — USDC · Arc · Circle Agent Wallets · Gateway (+ x402 micro-payment rail) — which product used where
9. **Traction & roadmap** — Arc today; then Stellar/Solana/Avalanche (vision)
10. **Team + ask** — a developer (protocol/backend) & a marketing/BD lead; "in the accelerator we turn this into a product"

---

## 7. Positioning lines (steal-ready)

- "Letting agents pay is easy; letting them pay **safely** is hard. We're that trust layer."
- "Identity + limits + human approval = money you can entrust to an agent."
- "Like setting a limit on a credit card, but for your agent."
- "Code verifies everything: identity on-chain, payments on-chain, reputation on-chain."

---

## 8. Glossary — speak with confidence 📖

*(If a judge gets technical, no panic — plain-language equivalents:)*

| Term | Plain meaning |
|---|---|
| **Agent** | Software / AI assistant that acts on your behalf |
| **ERC-8004** | The "ID card" standard for agents (a verifiable on-chain identity) |
| **USDC** | A dollar-pegged digital currency (1 USDC ≈ $1) |
| **Arc** | Circle's blockchain; even the transaction fee is paid in USDC |
| **Circle** | The company behind USDC + wallet/payment services |
| **x402** | Open HTTP-402 rail for very small (sub-cent) pay-per-call payments, settled + verified in USDC on-chain |
| **Wallet** | The account where the agent holds its money |
| **On-chain** | Written to the blockchain = verifiable by anyone, can't be erased |
| **Testnet** | A test network; play money, no real value |
| **Escrow** | A mechanism that holds funds until a job is done |
| **Human-on-the-loop** | A human approves large transactions |

---

## 9. Demo Day Q&A prep (likely questions + short answers)

- **"How is this different from just another wallet?"** → "A wallet only holds money; we add identity + rules + reputation. The difference is the agent being *trustworthy*."
- **"Security? What if the agent is hacked?"** → "Authority is bounded: daily cap + allowlist + human approval on large txs. Small blast radius."
- **"Why Arc/Circle?"** → "USDC as native gas, sub-second finality, Circle's ready-made wallet/payment tools — ideal for agent payments."
- **"Does it actually work?"** → "Yes, live on Arc testnet; we can show the identity registration on arcscan."
- **"Business model?"** → "Identity + payment infra per agent; at scale, per-transaction/subscription. For now, focus: a working product + the accelerator."
- **"Competition?"** → "Payment rails exist, identity standards exist; nobody combines them into a **trust + control** product layer. That's us."

---

## 10. Submission copy drafts (copy-edit these)

**Title:** A-Identity — The Passport & Wallet for the Agentic Economy

**Short description (≈2 sentences):**
"A-Identity gives every AI agent a verifiable on-chain identity (ERC-8004) and a policy-guarded USDC wallet on Arc. Agents pay autonomously within human-set limits — a real x402 pay-per-call rail plus an on-chain policy vault — verified first, bounded always, human-approved above the line."

**"Circle Product Feedback" section (required by Ignyte) — skeleton:**
- *Why we chose these products:* USDC (settlement), Circle Wallets (hosted wallet-layer screening), Circle Gateway (chain-abstracted USDC), **Circle Nanopayments** (gasless, Gateway-batched sub-cent x402), **Circle CCTP / Bridge Kit** (native burn-and-mint cross-chain), Arc (deterministic fees + fast finality). We ship **two x402 rails** — our own on-chain self-verifying one AND Circle Nanopayments — see README.
- *Circle products used (submission checkboxes):* **USDC ✓ · Wallets ✓ · Gateway ✓ · Nanopayments ✓ · CCTP/Bridge Kit ✓.** USYC / StableFX are enterprise-gated → architecture-level only (no penalty per the rules; request access if time allows).
- *What worked well:* [dev to fill in — live contract reads, fast finality, familiar EVM tooling].
- *What could improve:* [dev to fill in — e.g. docs / `.env` setup, testnet faucet limits].
- *Recommendations:* [1-2 concrete dev-experience improvements].

---

## 12. Market data, competitors & business model (research-backed) 📊

> Source: Trends.vc "Agentic Payments" (Know Your Agent / micro-agency model), Jul 2026 + Circle docs.
> Use these on the **"Why now"**, **competition**, and **business model** slides. Numbers are
> third-party claims — attribute them ("per Trends.vc") rather than stating as our own data.

### "Why now" — the market is validating our exact thesis
- **24,000 agents registered on ERC-8004 in a single week** — the identity standard we build on is being adopted *fast*.
- **87% of financial institutions cite identity trust as the blocker** to agent payments — this is precisely the gap A-Identity (KYA) fills.
- **+4,700% surge in unidentifiable AI traffic** — "who is this agent?" is now an urgent, measurable problem.
- **x402 is becoming the default agent-payment protocol** (Solana ~49% of current x402 share); **Stripe/Visa expected to hold ~70% of agent-to-merchant**, while **crypto rails dominate agent-to-agent APIs** — which is exactly our lane.
- **Identity-standard race:** Visa TAP, Google AP2, and **ERC-8004** (ours). Betting on the open on-chain standard.
- **The unsolved problem — fraud/liability:** "when an agent makes a bad purchase, who pays?" No framework yet. **Our answer:** KYA (verified identity) + bounded authority (on-chain limits) + human-on-the-loop = the smallest possible blast radius. *This is the slide that lands.*

### Competitive positioning — we're the layer *underneath* the marketplaces
| Project | What it is | Relationship to us |
|---|---|---|
| **moltlaunch** | AI-agent task **marketplace** on Base (ERC-8004 + escrow + x402) | Closest analog. They're a marketplace; **we're the trust/identity+policy layer such marketplaces need.** A plug-in, not a competitor. |
| **nomu.store** | Solana **commerce autopilot** (AI e-commerce ops, x402-ready checkout) | Different domain (physical commerce). Shows the "agent-discoverable + x402 checkout" pattern. Not a competitor. |
| **Flovia** | **Analytics** for machine-paid APIs (x402/MPP) | Complementary — they read the payment data our rails produce. Potential integration, not a rival. |

**One-liner:** *"They're building the marketplaces and storefronts of the agent economy. We're the passport office and the bank underneath them — the trust and policy layer every one of them needs."*

### Business model (Aybars's thesis) 💸
- **A-Identity = the identity + policy layer other agent-marketplaces plug into.** Marketplaces (moltlaunch, agentic.market, nomu…) integrate our SDK for KYA + bounded-authority policy; **we take a small fee per verified settlement** routed through the layer.
- Ladder: (1) infra/API per agent → (2) **per-transaction take-rate** on settlements that flow through our policy/identity layer → (3) enterprise KYA compliance tier.
- Why it's credible: agents transact **continuously** (vs humans a few times/day), so a tiny take-rate on verified agent settlements compounds. "Passport for the agentic economy" — the passport office charges per crossing.

---

## 11. Next steps for the Marketing/Presentation lead ✅

1. **This week:** register for Encode + **Ignyte (closes Jul 13!)**.
2. Turn the deck outline (section 6) into slides — ask the dev for arcscan screenshots for visuals.
3. Memorize the "bounded authority" narrative (section 3) — it's our hook.
4. As Aug 9 nears, record the video script (section 5) against the dev's live demo.
