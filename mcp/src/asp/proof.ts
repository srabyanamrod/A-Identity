/**
 * Public, verifiable proof for the OKX.AI Genesis Hackathon submission.
 *
 * Everything here is REAL and independently checkable on-chain — no claims a
 * reviewer can't verify themselves:
 *   - the ASP identity registered on X Layer mainnet (Agent #6271),
 *   - four real x402 settlements on X Layer mainnet (one per paid tool),
 *   - the on-chain showcase agent the tools return real data for (Meridian #849980),
 *   - the engineering rigor behind the scores (deterministic, unit-tested engine).
 *
 * Served free at GET /proof so anyone calling the live ASP sees the substance,
 * and cited from the README. Surfacing verifiable rigor is a deliberate answer
 * to "feels like a product, not a hackathon project."
 */

const OKLINK_TX = 'https://www.oklink.com/x-layer/evm/tx/'
const OKLINK_ADDR = 'https://www.oklink.com/x-layer/evm/address/'

/** payer = the buyer Agentic Wallet; payTo = where per-call revenue settles. */
const PAYER = '0x169ead25d35c146f3f3a7d2936ae37eab2e256d1'
const PAY_TO = '0x6a5f1b8e56a19d456b799c2fa00e513244f58ce6'

const SETTLEMENTS = [
  { tool: 'verify_agent', priceUsd: 0.001, txHash: '0x8174a4b29a3bc20d421531d2966d7091ee6d75f994a774aad5886870c5e7a27a' },
  { tool: 'reputation_score', priceUsd: 0.002, txHash: '0x2ede816a12acc7b1ae62d02b610e56079d619a1feeaa6cd61370bbbb977fc9af' },
  { tool: 'risk_check', priceUsd: 0.005, txHash: '0x36977927f1449ea84df341df6fd6c94288f70fd9f4e6c1b57bbe7ba7fa8557c1' },
  { tool: 'agent_passport', priceUsd: 0.01, txHash: '0xc7f9342bde496f21be725f72f5555fa685aeffcc901b54d47bd75e51c302a0cb' },
]

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
  // Four REAL x402 pay-per-call settlements on X Layer mainnet — one per tool.
  realOnchainRevenue: {
    network: 'X Layer mainnet (eip155:196)',
    asset: 'USD₮0 (0x779Ded0c9e1022225f8E0630b35a9b54bE713736)',
    payer: PAYER,
    payTo: PAY_TO,
    payToUrl: `${OKLINK_ADDR}${PAY_TO}`,
    totalUsd: 0.018,
    settlements: SETTLEMENTS.map((s) => ({ ...s, txUrl: `${OKLINK_TX}${s.txHash}` })),
  },
  // Real data the tools return, not mocks: a live ERC-8004 agent on Circle Arc.
  showcaseAgent: {
    name: 'Meridian',
    erc8004TokenId: '#849980',
    chain: 'Circle Arc testnet',
    reputation: '539 / 1000 (settlement 296 + validation 240 + tenure 3)',
    kya: 'verified',
    note: 'reputation_score and agent_passport return this live on-chain data',
  },
  // The rigor behind the numbers — deterministic and unit-tested, not an LLM guess.
  engineering: {
    tests: 58,
    deterministicReputation: true,
    liveOnchainReads: 'ERC-8004 IdentityRegistry + ValidationRegistry (KYA) on Circle Arc, read live via viem',
    standards: ['ERC-8004', 'x402'],
    reputationBasis: 'real on-chain settlements + verified identity credit + tenure — see /methodology',
    riskBasis: 'ALLOW / WARN / DENY composed from identity + KYA + reputation + tenure — see /methodology',
    repo: 'https://github.com/srabyanamrod/A-Identity',
  },
  howToVerify: [
    'Call any tool endpoint (POST /tools/*) — it returns HTTP 402 with an x402 challenge on X Layer mainnet (eip155:196).',
    'Open any settlement txUrl on OKLink — each is a real USD₮0 transfer to payTo on X Layer mainnet.',
    `Check the payTo balance (${PAY_TO}) — it received exactly $0.018 across the four settlements.`,
    'GET /methodology for the exact, reproducible reputation and risk formulas.',
  ],
  docs: 'https://a-identity.xyz',
}

/** The deterministic formulas behind the scores — served at GET /methodology. */
export const METHODOLOGY = {
  reputation: {
    range: '0-1000',
    deterministic: true,
    formula: 'score = settlement(0-600) + validation(0-240) + tenure(0-160), clamped 0-1000',
    settlement: 'min(600, round(600 * (1 - e^(-settledOnchain / 6))) + (onchainIdentity ? 60 : 0))',
    validation: 'settledOnchain + rejected == 0 ? 0 : round(240 * settledOnchain / (settledOnchain + rejected))',
    tenure: 'min(160, round(daysSinceCreated / 2))',
    inputs: 'all real and verifiable: on-chain USDC settlements (carry tx hashes), a verified ERC-8004 identity, clean-vs-rejected ratio, and tenure. No mock history.',
  },
  risk: {
    decisions: ['ALLOW', 'WARN', 'DENY'],
    deny: [
      'no verifiable on-chain ERC-8004 identity',
      'reputation < 200',
      'transaction amount > $100 to an agent with reputation < 400',
    ],
    warn: [
      'KYA (wallet-control) not attested',
      'reputation in [200, 500)',
      'tenure < 7 days (new agent)',
      'transaction amount > $1000',
    ],
    allow: 'none of the above — verified identity, attested KYA, strong reputation',
    note: 'DENY overrides WARN overrides ALLOW; every triggered reason is returned. Pure and unit-tested.',
  },
  standards: {
    'ERC-8004': 'on-chain agent identity (IdentityRegistry) + validation/KYA (ValidationRegistry)',
    x402: 'HTTP 402 pay-per-call settlement, here on X Layer mainnet in USD₮0',
  },
}
