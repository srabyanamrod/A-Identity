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
          'The agent presents its ERC-8004 passport. The feed checks identity and reputation, then answers with a price: 402, one tenth of a cent.',
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
          'Conversions follow the same permission model as every payment: inside the policy they run, outside it they wait for you. Yield is not worth losing the tower.',
        ],
      },
    ],
  },
]

export function getUseCase(slug: string): UseCase | undefined {
  return USE_CASES.find((u) => u.slug === slug)
}
