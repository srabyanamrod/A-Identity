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

## Architecture

```
a-identity/
├─ src/               React 19 + Vite + Tailwind v4 frontend (landing, app, blog, use cases)
├─ mcp/               Backend: MCP server + REST companion (Node + viem)
│  └─ src/
│     ├─ arc.ts             Live Arc testnet status (block reads)
│     ├─ arc-contracts.ts   Real ERC-8004 + ERC-8183 reads/writes (verbatim addresses)
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
POST /api/instructions/execute  execute (simulated until a signer exists)
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

Copy `.env.example` to `.env` and fill in what you need. All keys are optional
for the demo; the app runs fully on mock plus live-read without any keys.

## Going live (testnet)

1. **Fund a wallet:** create one in the app (Agent ID -> New agent -> Create
   wallet), then get testnet USDC at [faucet.circle.com](https://faucet.circle.com).
2. **Enable real writes:** put that wallet's key in a local `.env` as
   `ARC_SIGNER_KEY`. Now `register-onchain` and `create-job` broadcast for real.
3. **Circle platform:** add `CIRCLE_API_KEY` (from
   [console.circle.com](https://console.circle.com)) to enable the real Circle ping.

## Human-on-the-loop

A-Identity never custodies a key autonomously, never deploys a contract on its
own, and never moves real value without an explicit human approval. Wallet keys
are returned to the user once and never stored server-side. This is a design
rule, not an afterthought.

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
ERC-8183, x402, USDC/EURC/USYC.

## License

MIT. See [LICENSE](./LICENSE).
