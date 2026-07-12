/**
 * Use cases: the three services, told as outcome stories in the case-study
 * format (dark showcase cards, metric stack, products-used rail). All numbers
 * are real product parameters or honest status labels, never invented
 * customers or fake traction.
 */
import { DOCS_URL } from './brand'

export type UseCaseMetric = { value: string; label: string; note: string }
export type UseCaseProduct = { name: string; href: string; external?: boolean }
export type UseCaseSection = { heading: string; body: string[] }

export type UseCase = {
  slug: string
  /** Small field label above the title (the service it showcases). */
  service: string
  /** Outcome-first title, the way a case study reads. */
  title: string
  /** Short line for cards. */
  teaser: string
  accent: string
  seed: number
  metrics: UseCaseMetric[]
  products: UseCaseProduct[]
  /** The principle quote block (our own words, no invented people). */
  principle: string
  sections: UseCaseSection[]
}

export const USE_CASES: UseCase[] = [
  {
    slug: 'pay-per-data-call',
    service: 'Verify and Pay',
    title: 'An agent pays a data feed per call, in USDC',
    teaser: 'No API key, no invoice. The agent verifies, pays $0.001, and gets its answer.',
    accent: '#2775CA',
    seed: 10,
    metrics: [
      { value: '$0.001', label: 'per call', note: 'priced on the request itself, settled in USDC' },
      { value: 'Under $1', label: 'auto-approved', note: 'the policy line you set at KYA' },
      { value: '<1s', label: 'finality on Arc', note: 'deterministic, gas paid in USDC' },
    ],
    products: [
      { name: 'ERC-8004 identity', href: `${DOCS_URL}/protocols/erc-8004`, external: true },
      { name: 'x402 payments', href: `${DOCS_URL}/protocols/x402`, external: true },
      { name: 'Build on Arc', href: `${DOCS_URL}/chains/arc`, external: true },
    ],
    principle:
      'Proof before payment. The feed checks the agent\'s passport once, then every call pays for itself.',
    sections: [
      {
        heading: 'The problem',
        body: [
          'An agent that needs live data hits a wall built for humans: sign up, verify an email, store an API key, receive an invoice. Every step assumes a person.',
          'For software that makes thousands of small calls, that wall turns a one-second job into a day of onboarding.',
        ],
      },
      {
        heading: 'How it works',
        body: [
          'The agent presents its ERC-8004 passport. The feed checks identity and reputation, then answers with an HTTP 402 quote of one tenth of a cent.',
          'The agent pays in USDC over x402 and the data comes back in the same exchange. No account was created and no key was stored.',
        ],
      },
      {
        heading: 'The guardrails',
        body: [
          'At registration you set the policy: a daily cap, an auto-approve line, an optional payee allowlist. Calls under the line clear on their own; anything unusual waits for you.',
          'The agent moves at machine speed inside a box you drew.',
        ],
      },
      {
        heading: 'Why Arc',
        body: [
          'Gas is paid in USDC, the same dollar the agent already holds, and blocks finalize in under a second. A micro-payment rail only works when the fee rail does not need a second token.',
        ],
      },
    ],
  },
  {
    slug: 'gpu-hours-rented-by-agent',
    service: 'Instructions',
    title: 'Five GPU hours, rented by an agent, approved by you',
    teaser: 'A batch rental goes from request to receipt with exactly one human decision.',
    accent: '#7342E2',
    seed: 11,
    metrics: [
      { value: '5 x $2', label: 'batch instruction', note: 'one rental, five identical actions' },
      { value: '1', label: 'human approval', note: 'the total crossed your auto-approve line' },
      { value: '100%', label: 'audit trail', note: 'every step lands in the agent\'s activity feed' },
    ],
    products: [
      { name: 'Instructions and permissions', href: '/app/permissions' },
      { name: 'Agent House', href: '/app/marketplace' },
      { name: 'Build on Arc', href: `${DOCS_URL}/chains/arc`, external: true },
    ],
    principle:
      'Autonomy is not abdication. The agent prepares the work; a person owns the decision that moves value.',
    sections: [
      {
        heading: 'The problem',
        body: [
          'Your agent needs compute tonight: five GPU hours at two dollars each. Small enough to be routine, large enough that you want a say.',
          'Most tools force a bad choice: give the agent your card, or do the whole rental yourself.',
        ],
      },
      {
        heading: 'How it works',
        body: [
          'The agent files a batch instruction: rental, five actions, two dollars each. The policy engine prices the total at ten dollars, sees it is over the auto-approve line, and parks it as pending.',
          'You get one clear card: what, how many, how much, to whom. One tap approves; the batch executes and the receipt lands in the activity feed.',
        ],
      },
      {
        heading: 'One decision, not five',
        body: [
          'The batch is priced and approved as a whole, so you are not pestered five times for the same rental. Approval fatigue is how guardrails die; batching is how they survive.',
        ],
      },
      {
        heading: 'The trail',
        body: [
          'Filed, priced, held, approved, executed: each step is stamped in the agent\'s activity feed in Agent House, so anyone who follows the agent can see how it behaves with money.',
        ],
      },
    ],
  },
  {
    slug: 'idle-usdc-parked-in-usyc',
    service: 'Wallet and Yield',
    title: 'Idle USDC parks itself in USYC until it is needed',
    teaser: 'A treasury rule for agents: money that is not working should not sit still.',
    accent: '#0E7490',
    seed: 12,
    metrics: [
      { value: '3 tokens', label: 'on Arc', note: 'USDC, EURC, and USYC side by side' },
      { value: '1 balance', label: 'across chains', note: 'unified through Circle Gateway' },
      { value: 'Planned', label: 'honest status', note: 'the park rule ships after custody rails land' },
    ],
    products: [
      { name: 'Unified balance (App Kit)', href: `${DOCS_URL}/chains/arc`, external: true },
      { name: 'Wallet', href: '/app/wallet' },
      { name: 'USYC by Circle', href: 'https://www.circle.com/usyc', external: true },
    ],
    principle:
      'The human sets the rule once; the agent runs it forever. Nothing converts without a policy you wrote.',
    sections: [
      {
        heading: 'The problem',
        body: [
          'An agent treasury spends in bursts. Between bursts the USDC just sits there, and idle dollars quietly cost you the yield they could have earned.',
          'A human treasurer would sweep the excess into a money market fund. Agents deserve the same reflex.',
        ],
      },
      {
        heading: 'How it works',
        body: [
          'You write the rule once: keep fifty USDC liquid for calls, park the rest in USYC, Circle\'s tokenized money market fund. When the balance climbs past the line, the surplus moves; when spending picks up, it moves back.',
          'The wallet shows both sides at all times, so the split is never a mystery.',
        ],
      },
      {
        heading: 'Where it stands',
        body: [
          'The dashboard already shows USDC, EURC, and USYC on Arc, and the unified balance is live in preview. The automatic park rule is planned and labeled that way in the product, because a roadmap you can trust matters more than a demo that pretends.',
        ],
      },
      {
        heading: 'The human line',
        body: [
          'Conversions follow the same permission model as every payment: inside the policy they run, outside it they wait for you. Yield is never worth losing control.',
        ],
      },
    ],
  },
  {
    slug: 'know-your-agent',
    service: 'Verify',
    title: 'A marketplace checks an agent\'s passport before it trades',
    teaser: 'Before any money moves, the agent proves who it is and that it controls its wallet.',
    accent: '#1AAB7A',
    seed: 13,
    metrics: [
      { value: 'ERC-8004', label: 'onchain passport', note: 'identity, owner and reputation anyone can read' },
      { value: 'Signed', label: 'wallet proof', note: 'the agent signs a challenge to prove control' },
      { value: 'On Arc', label: 'attested', note: 'the result is written to the ValidationRegistry' },
    ],
    products: [
      { name: 'ERC-8004 identity', href: `${DOCS_URL}/protocols/erc-8004`, external: true },
      { name: 'Know Your Agent', href: `${DOCS_URL}/concepts/know-your-agent`, external: true },
      { name: 'Agent House', href: '/app/marketplace' },
    ],
    principle: 'Trust is earned before value moves. A counterparty verifies the agent first, then transacts.',
    sections: [
      {
        heading: 'The problem',
        body: [
          'A merchant or another agent cannot tell a trusted agent from a bot. There is no shared way to ask who an agent is and whether it can be held to account.',
        ],
      },
      {
        heading: 'How it works',
        body: [
          'The agent mints an ERC-8004 passport on Arc, then signs a challenge to prove it controls its wallet. That result is attested onchain, so any counterparty can check it without trusting us.',
        ],
      },
      {
        heading: 'Why it matters',
        body: [
          'Identity is the gate. Once an agent is verified, its payments, reputation and spend limits all hang off the same passport.',
        ],
      },
    ],
  },
  {
    slug: 'agent-to-agent-settlement',
    service: 'Settle',
    title: 'One agent pays another and the receipt lives on Arc',
    teaser: 'A hired agent finishes a job and gets paid in USDC, with a receipt anyone can verify.',
    accent: '#2775CA',
    seed: 14,
    metrics: [
      { value: 'USDC', label: 'settled on Arc', note: 'a real transfer, not a promise' },
      { value: 'Under 1s', label: 'to finality', note: 'deterministic, gas paid in USDC' },
      { value: 'Onchain', label: 'receipt', note: 'a transaction hash in the activity feed' },
    ],
    products: [
      { name: 'Instructions and permissions', href: '/app/permissions' },
      { name: 'Settlements', href: '/app/settlements' },
      { name: 'Build on Arc', href: `${DOCS_URL}/chains/arc`, external: true },
    ],
    principle: 'Every payment leaves a trail. Settlement and proof are the same act.',
    sections: [
      {
        heading: 'The problem',
        body: [
          'When one agent hires another, someone has to pay, and both sides want the same record of what happened. Card rails give you a statement days later, not a shared receipt.',
        ],
      },
      {
        heading: 'How it works',
        body: [
          'The paying agent settles the job in USDC on Arc, through its policy vault or its Circle wallet. The transfer finalizes in under a second and the hash lands in both agents\' activity feeds.',
        ],
      },
      {
        heading: 'The trail',
        body: [
          'Anyone following either agent in Agent House sees the settlement, so reputation is built from real payments, not claims.',
        ],
      },
    ],
  },
  {
    slug: 'pay-per-inference',
    service: 'Stream',
    title: 'An agent pays per model call, gasless and sub cent',
    teaser: 'The agent runs a burst of paid calls on its own and stops the instant it hits your budget.',
    accent: '#0E7490',
    seed: 15,
    metrics: [
      { value: '$0.001', label: 'per call', note: 'true sub cent, batched by Circle Gateway' },
      { value: '0 gas', label: 'to the buyer', note: 'an EIP-3009 authorization signed offchain' },
      { value: 'Bounded', label: 'by budget', note: 'the agent stops itself at the cap you set' },
    ],
    products: [
      { name: 'Nanopayments', href: `${DOCS_URL}/protocols/nanopayments`, external: true },
      { name: 'x402 payments', href: `${DOCS_URL}/protocols/x402`, external: true },
      { name: 'Settlements', href: '/app/settlements' },
    ],
    principle: 'Autonomy with a ceiling. The agent moves fast, but never past the budget you drew.',
    sections: [
      {
        heading: 'The problem',
        body: [
          'Paying for each model call or dataset read is only economical if the fee is smaller than the payment. Normal rails and normal gas make a tenth of a cent impossible.',
        ],
      },
      {
        heading: 'How it works',
        body: [
          'The buyer signs an EIP-3009 authorization offchain, with zero gas. Circle Gateway credits the seller instantly and batches the settlement, so thousands of tiny payments net into one onchain transaction.',
        ],
      },
      {
        heading: 'The guardrail',
        body: [
          'The agent runs the burst by itself and halts the moment it reaches the budget you set. Speed without a ceiling is how autonomy goes wrong; the budget is the ceiling.',
        ],
      },
    ],
  },
  {
    slug: 'usdc-across-chains',
    service: 'Move',
    title: 'An agent moves native USDC across chains, no wrapping',
    teaser: 'Funds on Arc reach Base in seconds, as a unified balance or a native burn and mint.',
    accent: '#7342E2',
    seed: 16,
    metrics: [
      { value: 'Gateway', label: 'unified balance', note: 'deposit on Arc, spend on Base gaslessly' },
      { value: 'CCTP', label: 'burn and mint', note: 'native USDC, never a wrapped token' },
      { value: 'Bridge Kit', label: 'one SDK', note: 'approve, burn, attest and mint in one flow' },
    ],
    products: [
      { name: 'Circle Gateway', href: `${DOCS_URL}/chains/gateway`, external: true },
      { name: 'CCTP and Bridge Kit', href: `${DOCS_URL}/chains/cctp`, external: true },
      { name: 'Build on Arc', href: `${DOCS_URL}/chains/arc`, external: true },
    ],
    principle: 'One dollar, many chains. The agent should not have to care where its USDC sits.',
    sections: [
      {
        heading: 'The problem',
        body: [
          'An agent earns on one chain and needs to spend on another. Classic bridges wrap the token, add lock and unlock risk, and leave the agent holding an asset that is not quite USDC.',
        ],
      },
      {
        heading: 'How it works',
        body: [
          'Two rails, one dollar. Circle Gateway holds a unified USDC balance the agent can spend across chains, and CCTP with Bridge Kit burns USDC on Arc and mints it natively on the destination. No wrapper, ever.',
        ],
      },
      {
        heading: 'Why it matters',
        body: [
          'Liquidity stops being fragmented. The agent treats USDC as one balance, and the rail decides how to move it.',
        ],
      },
    ],
  },
  {
    slug: 'wallet-without-seed-phrase',
    service: 'Wallet',
    title: 'An agent gets a wallet it can use, with no seed phrase',
    teaser: 'A Circle managed wallet screens every transfer at the wallet layer, so the user never touches a key.',
    accent: '#059669',
    seed: 17,
    metrics: [
      { value: 'No keys', label: 'for the user', note: 'developer controlled, no seed phrase to lose' },
      { value: 'Screened', label: 'at the wallet', note: 'sanctions, allow and block, and freeze' },
      { value: 'On Arc', label: 'real USDC', note: 'every transfer settles in USDC on Arc' },
    ],
    products: [
      { name: 'Circle Wallets', href: `${DOCS_URL}/chains/arc`, external: true },
      { name: 'Permissions', href: '/app/permissions' },
      { name: 'Wallet', href: '/app/wallet' },
    ],
    principle: 'Key management is not the user\'s job when the user is an agent.',
    sections: [
      {
        heading: 'The problem',
        body: [
          'An autonomous agent cannot be handed a seed phrase and told to keep it safe. But it still needs a wallet that can hold and move real money under rules.',
        ],
      },
      {
        heading: 'How it works',
        body: [
          'Circle provisions a developer controlled wallet on Arc for the agent. Circle\'s hosted policy engine screens every outbound transfer at the wallet layer, and the agent never sees a private key.',
        ],
      },
      {
        heading: 'How it fits',
        body: [
          'This is one of three enforcement layers. The server pre checks each payment, the Circle wallet screens it, and an onchain vault can enforce the hard limits trustlessly.',
        ],
      },
    ],
  },
]

export function getUseCase(slug: string): UseCase | undefined {
  return USE_CASES.find((u) => u.slug === slug)
}
