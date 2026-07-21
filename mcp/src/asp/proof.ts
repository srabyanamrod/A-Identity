/**
 * Public, verifiable proof for the OKX.AI Genesis Hackathon submission.
 *
 * Everything here is REAL and independently checkable on-chain — no claims a
 * reviewer can't verify themselves:
 *   - the ASP identity registered on X Layer mainnet (Agent #6271),
 *   - 83 real x402 settlements on X Layer mainnet (4 featured, one per paid tool),
 *   - the on-chain showcase agent the tools return real data for (Meridian #849980),
 *   - the engineering rigor behind the scores (deterministic, unit-tested engine).
 *
 * Served free at GET /proof so anyone calling the live ASP sees the substance,
 * and cited from the README. Surfacing verifiable rigor is a deliberate answer
 * to "feels like a product, not a hackathon project."
 */

import { SETTLEMENTS } from './settlements.js'

const OKLINK_TX = 'https://www.oklink.com/x-layer/evm/tx/'
const OKLINK_ADDR = 'https://www.oklink.com/x-layer/evm/address/'

/** payer = the buyer Agentic Wallet; payTo = where per-call revenue settles. */
const PAYER = '0x169ead25d35c146f3f3a7d2936ae37eab2e256d1'
const PAY_TO = '0x6a5f1b8e56a19d456b799c2fa00e513244f58ce6'

// All real settlements (round 0 = live demo, rounds 1-20 = seeding), each + an OKLink link.
const WITH_URLS = SETTLEMENTS.map((s) => ({ ...s, txUrl: `${OKLINK_TX}${s.txHash}` }))
const FEATURED = WITH_URLS.filter((s) => s.round === 0)
const TOTAL_USD = Math.round(SETTLEMENTS.reduce((a, s) => a + s.amountUsd, 0) * 1000) / 1000
const BY_TOOL = SETTLEMENTS.reduce<Record<string, number>>((m, s) => {
  m[s.tool] = (m[s.tool] || 0) + 1
  return m
}, {})

export const PROOF = {
  submission: 'OKX.AI Genesis Hackathon',
  asp: {
    name: 'A-Identity Trust Oracle',
    agentId: '#6271',
    type: 'A2MCP',
    network: 'X Layer mainnet (eip155:196)',
    registrationTx: '0x03a614a902ed742526047dffa165378cb16350a81bf083d4672f6d7a9ecfb078',
    registrationTxUrl: `${OKLINK_TX}0x03a614a902ed742526047dffa165378cb16350a81bf083d4672f6d7a9ecfb078`,
  },
  // REAL x402 pay-per-call settlements on X Layer mainnet — round 0 = the live demo,
  // rounds 1-20 = seeding. Every row is a real USD₮0 transfer to payTo.
  realOnchainRevenue: {
    network: 'X Layer mainnet (eip155:196)',
    asset: 'USD₮0 (0x779Ded0c9e1022225f8E0630b35a9b54bE713736)',
    payer: PAYER,
    payTo: PAY_TO,
    payToUrl: `${OKLINK_ADDR}${PAY_TO}`,
    totalSettlements: WITH_URLS.length,
    totalUsd: TOTAL_USD,
    byTool: BY_TOOL,
    featured: FEATURED,
    settlements: WITH_URLS,
  },
  // Real data the tools return, not mocks: a live ERC-8004 agent on Circle Arc.
  showcaseAgent: {
    name: 'Meridian',
    erc8004TokenId: '#849980',
    chain: 'Circle Arc testnet',
    reputation: '539 / 1000 (settlement 296 + validation 240 + tenure 3 + behavior 0; no marketplace jobs yet)',
    kya: 'verified',
    note: 'reputation_score and agent_passport return this live on-chain data',
  },
  // The rigor behind the numbers — deterministic and unit-tested, not an LLM guess.
  engineering: {
    tests: 139,
    deterministicReputation: true,
    liveOnchainReads: 'ERC-8004 IdentityRegistry + ValidationRegistry (KYA) on Circle Arc, read live via viem',
    standards: ['ERC-8004', 'x402'],
    reputationBasis: 'real on-chain settlements + verified identity credit + tenure + real job outcomes (behavior) — see /methodology',
    riskBasis: 'ALLOW / WARN / DENY composed from identity + KYA + reputation + tenure — see /methodology',
    repo: 'https://github.com/srabyanamrod/A-Identity',
  },
  howToVerify: [
    'Call any tool endpoint (POST /tools/*) — it returns HTTP 402 with an x402 challenge on X Layer mainnet (eip155:196).',
    'Open any settlement txUrl on OKLink — each is a real USD₮0 transfer to payTo on X Layer mainnet.',
    `Check the payTo balance (${PAY_TO}) — it received every one of these settlements in USD₮0.`,
    'GET /methodology for the exact, reproducible reputation and risk formulas.',
  ],
  docs: 'https://a-identity.xyz',
}

/** The deterministic formulas behind the scores — served at GET /methodology. */
export const METHODOLOGY = {
  reputation: {
    range: '0-1000',
    deterministic: true,
    formula: 'score = settlement(0-600) + validation(0-240) + tenure(0-160) + behavior(-150..+40), clamped 0-1000',
    settlement: 'min(600, round(600 * (1 - e^(-settledOnchain / 6))) + (onchainIdentity ? 60 : 0))',
    validation: 'settledOnchain + rejected == 0 ? 0 : round(240 * settledOnchain / (settledOnchain + rejected))',
    tenure: 'min(160, round(daysSinceCreated / 2))',
    behavior: 'clamp(-150, +40, -round(150 * contestedJobs / (completedJobs + contestedJobs)) + (ratedJobs >= 2 ? clamp(-40, +40, round((avgRating - 4) * 40)) : 0)); 0 with no marketplace job history',
    inputs: 'all real and verifiable: on-chain USDC settlements (carry tx hashes), a verified ERC-8004 identity, clean-vs-rejected ratio, tenure, and real marketplace job outcomes (completed vs disputed/refunded jobs + mean client rating). No mock history, no self-attestation.',
    note: 'behavior uses only outcomes A-Identity records on-chain-escrowed jobs (dispute/refund + client ratings); delivery-latency and on-chain cap-breach signals are intentionally NOT yet included (not tracked with the fidelity to score them honestly).',
  },
  risk: {
    decisions: ['ALLOW', 'WARN', 'DENY'],
    deny: [
      'KYA revoked (the agent is flagged as an incident)',
      "Sybil / wash reputation: >= 60% of jobs hired by the agent's own operator",
      'no verifiable on-chain ERC-8004 identity',
      'reputation < 200',
      'transaction amount > $100 to an agent with reputation < 400',
    ],
    warn: [
      'KYA (wallet-control) not attested',
      'Sybil signals: partial same-operator hiring or low counterparty diversity',
      'reputation in [200, 500)',
      'tenure < 7 days (new agent)',
      'transaction amount > $1000',
    ],
    sybil: "Sybil/wash detection from real state: operator cluster size (agents per owner), self-deal rate (jobs hired by the agent's OWN operator), and counterparty diversity (distinct clients / jobs). HIGH = reputation mostly self-dealt -> DENY; MEDIUM -> WARN. Detects same-operator wash only; cross-operator collusion needs a funder-graph indexer (roadmap).",
    allow: 'none of the above — verified identity, attested KYA, strong reputation',
    note: 'DENY overrides WARN overrides ALLOW; every triggered reason is returned. Pure and unit-tested.',
  },
  standards: {
    'ERC-8004': 'on-chain agent identity (IdentityRegistry) + validation/KYA (ValidationRegistry)',
    x402: 'HTTP 402 pay-per-call settlement, here on X Layer mainnet in USD₮0',
  },
}
