# A-Identity

**The passport and wallet for the agentic economy.** Give every AI agent a
verified on-chain identity and a wallet it can pay from. Verify first, then pay,
with a human in the tower for anything that moves real value.

Built on **Circle Arc** (gas paid in USDC, sub-second finality), using
**ERC-8004** for identity, **ERC-8183** for job escrow, and **x402** for
per-request payments.

> Status: hackathon MVP. Arc is the live phase-1 network. Stellar is next, then
> Avalanche, then Solana.

---

## What it does

An agent gets two things it does not have today:

1. **A passport** — a verifiable identity and reputation (ERC-8004), so others
   can trust it before transacting.
2. **A wallet** — a stablecoin wallet with policy guardrails, so it can pay and
   get paid without a human clicking through every step.

The product is a full loop: **register an agent (KYA) -> create a wallet -> fund
it -> set permissions -> give it instructions (pay / purchase / rent / batch) ->
watch it in Agent House.** Anything above the limits you set pauses for your
approval.

## Live on Arc testnet, today

The backend reads the **real deployed contracts** on Arc Testnet, no mocks:

| Contract | Address | Standard |
| --- | --- | --- |
| Identity Registry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` | ERC-8004 |
| Reputation Registry | `0x8004B663056A597Dffe9eCcC1965A193B7388713` | ERC-8004 |
| Validation Registry | `0x8004Cb1BF31DAf7788923b405b754f57acEB4272` | ERC-8004 |
| Agentic Commerce (jobs) | `0x0747EEf0706327138c69792bF28Cd525089e4583` | ERC-8183 |
| USDC | `0x3600000000000000000000000000000000000000` | ERC-20 |

`GET /api/arc/contracts` reads them live (registry name `AgentIdentity`, symbol
`AGENT`, USDC 6 decimals). `GET /api/arc` reads the latest block over JSON-RPC.
Writes (agent registration, job escrow) are wired against the same contracts and
broadcast for real once a funded signer key is present.

### On-chain policy vault — programmable money that enforces itself

An agent's spend policy can be deployed **as its own smart contract on Arc**:
`AgentSpendPolicy` (`mcp/contracts/AgentSpendPolicy.sol`). Once an agent is given a
vault, its USDC payments settle **through the contract**, which enforces the policy
on-chain — a per-UTC-day cap, an auto-approve ceiling, a payee allowlist, and a freeze
switch. A payment that breaks a rule **reverts on Arc** with a typed error (verifiable
on arcscan), not just a server "no"; the human owner can override, adjust limits, freeze,
or withdraw. The server policy engine stays as the fast pre-check and fallback, so agents
without a vault behave exactly as before.

Try it: `cd mcp && node --env-file=.env scripts/test-vault.mjs` (needs a funded
`ARC_SIGNER_KEY`) deploys a vault and plays pay / over-limit-revert / freeze / cap out on
real Arc testnet — or use the **Permissions → On-chain policy vault** panel in the app.

### Know Your Agent (KYA) — a real check, not a stamp

An agent is no longer marked `verified` for free. It must **prove control of its wallet** by
signing a challenge (the same `verifyMessage` primitive as wallet sign-in); only then does its
KYA flip to `verified`. New agents start `unverified`; a wrong signature is rejected. The result
is attested on Arc's real **ERC-8004 ValidationRegistry** (`validationRequest` +
`validationResponse`=100, tag `"kya"`, readable via `getSummary`). Honest by design: an
operator/wallet-proof attestation, not a third-party audit.

### Circle Agent Wallet — hosted wallet-layer screening

An agent can also be given a **Circle Agent Wallet** (Developer-Controlled, on ARC-TESTNET):
Circle's hosted policy engine screens every USDC transfer at the wallet layer (sanctions, address
allow/block, freeze). Credential-gated behind `CIRCLE_API_KEY` + `CIRCLE_ENTITY_SECRET`; a clean
no-op without them. Precise by design: Circle screens transfers — the USD spend cap stays enforced
by our server and the on-chain vault. Together: **server pre-check + Circle screening + on-chain
vault** = three independent guarantees.

## Architecture

```
a-identity/
├─ src/               React 19 + Vite + Tailwind v4 frontend (landing, app, blog, use cases)
├─ mcp/               Backend: MCP server + REST companion (Node + viem)
│  ├─ contracts/      AgentSpendPolicy.sol — on-chain spend-policy vault (npm run compile)
│  └─ src/
│     ├─ arc.ts             Live Arc testnet status (block reads)
│     ├─ arc-contracts.ts   Real ERC-8004 + ERC-8183 reads/writes + AgentSpendPolicy vault
│     ├─ circle.ts          Circle developer platform link (env-gated ping)
│     ├─ platform.ts        Agents, wallets, instructions, marketplace (write side)
│     ├─ erc8004.ts         Multi-chain identity provider (mock + rpc)
│     ├─ reputation.ts      Deterministic reputation score (0-1000)
│     └─ http.ts            REST + Streamable HTTP MCP endpoints
├─ docs/              Mintlify documentation site
└─ .env.example       Every configurable key, documented
```

Two entry points share the same tools: an **MCP server** (read-only tools for
agents) and a **REST API** (the write side the app uses).

### Backend endpoints (REST, port 3399)

```
GET  /health                    liveness + supported chains
GET  /api/arc                   live Arc testnet block/chainId
GET  /api/arc/contracts         LIVE reads of ERC-8004 + ERC-8183 + USDC
POST /api/arc/register-onchain  ERC-8004 register (prepared, or real w/ key)
POST /api/arc/create-job        ERC-8183 createJob (prepared, or real w/ key)
GET  /api/circle                Circle platform link (real ping w/ CIRCLE_API_KEY)
POST /api/wallets               create a real Arc keypair (key returned once)
GET  /api/wallet-balance        live native-USDC balance
POST /api/agents                register an agent (KYA + permissions)
POST /api/instructions          pay / purchase / rental / batch (policy engine)
POST /api/instructions/approve  human approval
POST /api/instructions/execute  execute (through the vault if provisioned, else direct; simulated without a signer)
POST /api/agents/vault          provision an on-chain AgentSpendPolicy vault (real w/ key)
GET  /api/agents/vault          live on-chain vault policy + balance
POST /api/agents/circle-wallet  provision a Circle Agent Wallet (hosted screening, w/ Circle keys)
GET  /api/agents/circle-wallet  live Circle wallet state + balance
POST /api/agents/kya/challenge  start a KYA wallet-control challenge
POST /api/agents/kya/verify     verify the signature (+ on-chain ValidationRegistry attestation)
GET  /api/agents/kya            KYA status + live on-chain validation
GET  /api/x402/nano/data        x402 Nanopayments seller (gasless, Gateway-batched; 402→settle)
POST /api/arc/nanopay-demo      one-click gasless nanopayment (EIP-3009 + Circle Gateway batch)
POST /api/arc/cctp-demo         one-click CCTP burn-and-mint (Arc→Base Sepolia, native USDC)
GET  /api/marketplace           Agent House feed
POST /api/follow                follow an agent
```

## Quickstart

```bash
# 1. Install
npm install
npm install --prefix mcp

# 2. Run everything (UI + MCP backend + docs)
npm run dev:all
#   UI    -> http://localhost:5173
#   MCP   -> http://localhost:3399
#   Docs  -> http://localhost:3000

# 3. Prove the live Arc integration
curl http://localhost:3399/api/arc/contracts
```

Copy `.env.example` to `.env.local` for the frontend (Vite). The backend reads
its config from the process env directly — see below. Everything is optional for
a demo: without a signer key the app still does live contract reads and labels
on-chain writes as prepared / simulated; add a funded `ARC_SIGNER_KEY` to
broadcast real transactions.

## Going live (testnet)

1. **Fund a wallet:** create one in the app (Agent ID -> New agent -> Create
   wallet; the keypair is generated in your browser), then get testnet USDC at
   [faucet.circle.com](https://faucet.circle.com).
2. **Enable real writes:** the backend reads `ARC_SIGNER_KEY` from `process.env`
   and does **not** auto-load a `.env` file. Start it with the key inline:

   ```bash
   ARC_SIGNER_KEY=0x<funded-key> node mcp/dist/http.js
   # or, keeping it in mcp/.env (Node 20.6+):
   node --env-file=mcp/.env mcp/dist/http.js
   ```

   Now on-chain registration, USDC settlement, and job escrow broadcast for real.
3. **Circle platform:** add `CIRCLE_API_KEY` (from
   [console.circle.com](https://console.circle.com)) to enable the real Circle ping.

## Deploy

Frontend is a static Vite build; the backend is a long-running Node server (not
serverless).

- **Frontend -> Vercel.** Leave `VITE_MCP_URL` empty so the app calls same-origin
  paths (`vercel.json` proxies them to the backend). Set `VITE_DOCS_URL` to the
  deployed docs site (if unset, docs links fall back to the live app origin, not a
  dead domain).
- **Backend -> Render** (or any host that runs a persistent Node process). Root
  directory `mcp`, build `npm install --include=dev && npm run build`, start
  `npm run start:http`. The server binds to the host-provided `$PORT` and self-pings
  to stay warm on free tiers. Set in the host's env panel:
  - `AUTH_SECRET` — **required**: a strong, stable random string. Without it the
    server signs session tokens with a random per-process secret (safe, but sessions
    drop on restart) and logs a warning; a public default is never used.
  - `ALLOWED_ORIGINS` — comma-separated site origins allowed to call the API
    cross-origin (e.g. `https://a-identity.xyz`). Unset → `*` (dev only).
  - `ARC_SIGNER_KEY` — funded key to broadcast real Arc writes (optional; without it
    writes are prepared/simulated and labeled as such).
  - `DATABASE_URL` — Postgres connection string for durable state.

State persists to Postgres when `DATABASE_URL` is set, else to
`mcp/data/platform.json` (gitignored). x402 replay protection (spent-payment
hashes) persists the same way, so a restart can't reset it.

## Human-on-the-loop

A-Identity never custodies a key autonomously, never deploys a contract on its
own, and never moves real value without an explicit human approval. Wallet keys
are generated in the browser and never leave it — the server only ever sees the
public address, and sign-in is by wallet signature (no passwords). This is a
design rule, not an afterthought.

## Roadmap

- **Phase 1 (now):** Arc + Circle, end to end. Live contract reads; write path
  wired and env-gated.
- **Phase 2:** Stellar (USDC + EURC native, Soroban), end to end.
- **Phase 3:** Avalanche.
- **Phase 4:** Solana.

New networks follow the same provider pattern in `mcp/src` (see `erc8004.ts` and
`arc-contracts.ts`), so adding one is additive, not a rewrite.

## Tech stack

React 19, Vite 6, Tailwind v4, Framer Motion, React Router v7, Zustand ·
Node, viem, Model Context Protocol SDK, Zod · Mintlify · Circle Arc, ERC-8004,
ERC-8183, x402, **Circle Nanopayments** (`@circle-fin/x402-batching`), **Circle Gateway**,
**Circle CCTP / Bridge Kit** (`@circle-fin/bridge-kit`), **Circle Wallets**, USDC/EURC.

## Circle Product Feedback

Which Circle products we used, why, what worked, and what we'd improve.

**Circle Arc (testnet)** — our base chain. Gas paid in USDC and sub-second finality
made the whole "agent pays per action" loop feel native; a single asset for both gas
and value removed a class of UX problems. *Improve:* the IdentityRegistry isn't
enumerable (`totalSupply` reverts), so a "registered agents" count needs off-chain
indexing; a documented events/indexing path would help.

**Circle Gateway** — chain-abstracted USDC. We deposit on Arc → a unified balance →
move it to Base Sepolia via the Forwarding Service (signed EIP-712 burn intent),
minted gaslessly in seconds, permissionlessly (no API key). This is the cleanest
cross-chain UX we integrated. *Improve:* the estimate→sign→submit shape and the
bytes32-padded `TransferSpec` fields were the fiddly part; a typed helper in the SDK
would cut integration time.

**Circle Developer-Controlled Wallets (Agent Wallets)** — a hosted, wallet-layer
policy engine that screens each transfer (sanctions / allow-block / freeze). We use
it as one of three independent enforcement layers. *Improve:* the testnet faucet
doesn't cover ARC-TESTNET (403), so we fund new Circle wallets from our own signer;
first-class Arc faucet support would remove that step. Also, screening is transaction
*screening*, not a per-wallet USD spend cap — we enforce the cap in our server + the
on-chain vault and are explicit about that split.

**USDC / faucet** — the unit of account throughout; `faucet.circle.com` for testnet
funding.

**Circle Nanopayments — gasless, sub-cent, Gateway-batched.** We ship **two** x402 rails:
1. **On-chain, self-verifying x402** (`mcp/src/x402.ts`) — server returns 402 + requirements →
   client pays USDC on Arc → server verifies the payment on-chain with replay protection + a
   single-use request nonce → serves. Open standard, *provable* settlement, no hosted meter.
2. **Circle Nanopayments** (`mcp/src/nanopay.ts`) — the same x402 negotiation over Circle
   Gateway's `GatewayWalletBatched` scheme: the buyer signs an **EIP-3009 authorization
   off-chain (zero gas)**, Circle Gateway verifies + credits instantly and **batches** the
   on-chain settlement, so true sub-cent payments become economical for high-frequency agent
   traffic. Permissionless on Arc testnet (no API key); the buyer's balance is the same Gateway
   Wallet deposit we already fund. *Improve:* a testnet faucet that pre-funds a Gateway balance
   would remove the one-time deposit step from a first-run demo.

**Circle CCTP (Bridge Kit)** — native USDC cross-chain by burn-and-mint (`mcp/src/cctp.ts`):
USDC is burned on Arc and minted **natively** on Base Sepolia — never wrapped — via CCTPv2
(`@circle-fin/bridge-kit`). Distinct from Gateway's unified-balance forwarding; together they
show both canonical USDC-liquidity primitives. *Improve:* the "leaving Arc, amount must exceed
the CCTPv2 max fee" floor is easy to trip on tiny testnet transfers — a clearer SDK error would help.

## License

MIT. See [LICENSE](./LICENSE).
