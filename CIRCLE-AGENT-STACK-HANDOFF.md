# Handoff — Circle Agent Stack integration (Phase 3 of the hybrid on-chain policy hero)

> **For the next agent.** You are picking up A-Identity mid-feature. Phases 1–2 (the
> trustless **on-chain policy vault**) are DONE and verified on Arc testnet. Your job is
> **Phase 3**: add **Circle Agent Stack — Agent Wallets** as a *second* policy-enforcement
> layer, so the product enforces spend policy three ways: (1) our server pre-check,
> (2) Circle Agent Stack's hosted policy, (3) our on-chain vault as the trustless source of
> truth. This is the **hybrid** the user chose. Everything is **additive + fallback** — never
> break the working demo.
>
> You have the **Circle codegen MCP** and **Arc docs MCP** connected in this session —
> USE THEM (they were not available in the session that built Phases 1–2). See "MCPs" below.

---

## 0. What the product is (fast context)

A-Identity = a **passport (ERC-8004 on-chain identity) + wallet (USDC payments)** for AI
agents, on **Circle Arc testnet**. Two hackathons: Encode "Programmable Money" (primary) and
Ignyte "Stablecoins Commerce Stack" (secondary), both Agentic Economy track. The pitch angle
we are building toward: **"Circle Agent Wallets give the money + spend rules; A-Identity gives
the agent its identity, reputation, and a trustless on-chain enforcement layer."**

- Frontend (Vercel): https://a-identity.vercel.app — React 19 + Vite + Tailwind, `src/`
- Backend (Render): https://a-identity-backend.onrender.com — Node + viem, `mcp/src/`
- Working branch: `feat/onchain-anchor-ui`
- **DB is now durable**: `DATABASE_URL` on Render points at a Neon Postgres (set up this session).

### ⚠️ Git: DUAL REMOTE — push every commit to BOTH
- `origin` → `srabyanamrod/A-Identity` (partner's canonical) — branch `feat/onchain-anchor-ui`
- `deploy` → `mericcintosun/a-identity` (user's copy; **Render deploys from this**) — branch `main`
- After every commit: `git push origin feat/onchain-anchor-ui` **and**
  `git push deploy feat/onchain-anchor-ui:main`, then verify all three heads match.
- **Pushing to `deploy` auto-redeploys the Render backend → confirm with the user first.**

---

## 1. What is ALREADY built (Phases 1–2) — do not rebuild, integrate alongside

The **on-chain policy vault**: a per-agent USDC smart contract on Arc that enforces the
agent's spend policy at the contract level.

**Contract** — `mcp/contracts/AgentSpendPolicy.sol` (compiled by `npm run compile` in `mcp/`,
which writes `mcp/src/contracts/AgentSpendPolicy.ts` = ABI + bytecode via solc 0.8.36).
- Rules enforced on-chain by `pay(to, amount)` (operator/agent-only): `frozen`, payee
  `allowlist`, `autoApproveMax` (per-payment ceiling), `dailyCap` (per-UTC-day, `block.timestamp/86400`).
  A disallowed payment **reverts on Arc** with a typed error (`IsFrozen`, `AboveAutoApprove`,
  `DailyCapExceeded`, `PayeeNotAllowed`). `ownerPay` = human override. Amounts in USDC 6-dec units.

**Backend** — `mcp/src/arc-contracts.ts` gained: `deployPolicyVault`, `policyPay`,
`policyOwnerPay`, `policySetPolicy`, `policySetFrozen`, `policySetAllowed`, `policyWithdraw`,
`readPolicyVault`. All viem, env-gated behind `ARC_SIGNER_KEY`. `policyPay` simulates first, so a
policy rejection returns the on-chain revert reason without spending gas.

**Platform** — `mcp/src/platform.ts`:
- `PlatformAgent` gained `vaultAddress?`, `vaultExplorer?`.
- `Instruction` gained `enforcedBy?: 'server' | 'onchain-vault'`.
- `provisionAgentVault(agentId, { fundUsd, caller })` — deploys + optionally funds a vault,
  using the agent's `permissions`. `getAgentVault(agentId)` — live on-chain read.
- `executeInstruction` now routes address payments **through the vault when the agent has one**:
  auto-approved → `policyPay` (agent, enforced); human-approved → `policyOwnerPay` (override).
  A *policy* revert (`VAULT_POLICY_ERRORS`) kicks the instruction back to `pending_approval`
  (authoritative "no"); an *infra* error falls through to the legacy direct-settlement path.
  **Agents without a vault behave exactly as before.**

**Endpoints** — `mcp/src/http.ts`:
- `POST /api/agents/vault` `{ agentId, fundUsd? }` (owner-only) → provision.
- `GET /api/agents/vault?agentId=` → live vault state.

**Frontend** — `src/routes/app/Permissions.tsx` has a `VaultPanel` (provision + live cap/
auto-approve/spent/balance/frozen, arcscan link). `src/routes/app/Settlements.tsx` shows an
"On-chain policy" badge on `enforcedBy === 'onchain-vault'` settlements.

**Verified:** `mcp/scripts/test-vault.mjs` (run: `cd mcp && node --env-file=.env scripts/test-vault.mjs`)
= 12/12 on real Arc testnet (pay/revert/freeze/cap, real tx hashes). HTTP layer = 8/8.

---

## 2. Your goal (Phase 3) — Circle Agent Stack "Agent Wallets" as a second enforcement layer

### What Circle Agent Stack is (researched, cite before relying)
Launched **May 11, 2026**. Chain-agnostic infra for the agentic economy. Components:
**Agent Wallets, Agent Marketplace, Circle CLI, Nanopayments (via Circle Gateway), Circle Skills.**
- **Agent Wallets** is our target: machine-initiated USDC wallets with **wallet-layer spend
  policies** — "time-bound USDC spending limits for transfers and x402 services," address
  **allowlists/blocklists**, sanctions screening. **Non-custodial 2-of-2 MPC** ("Circle cannot
  unilaterally move funds"). **`ARC-TESTNET` is a supported blockchain** (verify on the
  supported-blockchains page). Config/operate via **Circle CLI** (`curl -sL https://agents.circle.com/skills/setup.md`).
- **CRITICAL — be precise in the pitch:** Agent Stack policy is enforced by **Circle's hosted
  policy engine ("at the wallet layer"), NOT by an on-chain contract.** So it moves the enforcer
  from *our server* → *Circle's service*. Our vault (Phase 1) is the *trustless on-chain* layer.
  Frame it honestly: "server pre-check + Circle hosted policy + on-chain vault (source of truth)."

Key docs to read (via WebFetch and the MCPs):
- https://developers.circle.com/agent-stack  and  /agent-stack/agent-wallets  and
  /agent-stack/agent-wallets/supported-blockchains
- https://www.circle.com/blog/introducing-circle-agent-stack-financial-infrastructure-for-the-agentic-economy
- Circle Skills repo: https://github.com/circlefin/skills (`use-modular-wallets`, `use-arc`)

### What you need FROM THE USER before coding the runtime path
Circle Agent Wallets need Circle credentials — the user must provision these (you cannot in a
headless session):
1. A **Circle developer account** + **API key** (console.circle.com) — likely an
   `Authorization: Bearer <API_KEY>` and an entity secret / wallet set, per Circle's SDK.
2. Confirmation that **Agent Wallets is enabled** for their account and that **ARC-TESTNET** is
   selectable.
3. They should set the resulting secret(s) as backend env vars (e.g. `CIRCLE_API_KEY`,
   `CIRCLE_ENTITY_SECRET`) — locally in `mcp/.env` (gitignored), on Render in the env panel.
**Ask the user for these early.** Use the Circle codegen MCP + docs to determine the *exact*
env vars and setup steps, then give the user a precise checklist.

### MCPs (connected in this session — USE THEM)
- **Circle codegen MCP** (`circle`, `https://api.circle.com/v1/codegen/mcp`) — generates correct
  Circle SDK code for Wallets / Gateway / CCTP. Lean on it heavily for the integration code.
- **Arc docs MCP** (`arc-docs`, `https://docs.arc.io/mcp`) — `Search` / `Get page` over Arc docs.
  Use to confirm Arc chain specifics.
- Confirm they're live with a quick tool call; if a tool isn't visible, tell the user to restart
  the Claude Code session so the MCPs load.

---

## 3. Suggested architecture (keep it ADDITIVE + credential-gated, mirror the vault pattern)

Mirror exactly how `ARC_SIGNER_KEY` gates the on-chain path — the Circle path must **no-op
cleanly when `CIRCLE_API_KEY` is unset**, so local/CI/demo without creds still works.

1. **New module `mcp/src/circle-agent.ts`** (mirrors `arc-contracts.ts`'s shape):
   - `circleEnabled(env)` → boolean (key present).
   - `createAgentWallet({ ... })` → provision a Circle Agent Wallet on ARC-TESTNET, return its id/address.
   - `setWalletPolicy(walletId, { dailyCapUsd, autoApproveUsd, allowlist })` → map our
     `Permissions` onto Circle's spend-policy schema (use the codegen MCP to get the exact shape).
   - `circlePay(walletId, to, amountUsd)` → initiate a USDC transfer; Circle's hosted policy
     accepts/rejects. Return `{ executed, txHash?, explorerUrl?, rejected?, reason? }` in the
     SAME result shape as the vault helpers, so `executeInstruction` can treat it uniformly.
2. **Platform wiring** (`platform.ts`), additive:
   - `PlatformAgent` gains `circleWalletId?`, `circleWalletAddress?`.
   - A `provisionCircleWallet(agentId, ...)` alongside `provisionAgentVault`.
   - In `executeInstruction`, add a branch/option for the Circle path. Design decision to make
     with the user: do the two layers run **in sequence** (server → Circle → vault) or does the
     agent pick an "enforcement mode"? Simplest demo: an agent can have EITHER a vault OR a Circle
     wallet OR both, and the UI shows which enforced each payment (extend `enforcedBy` to include
     `'circle-agent-stack'`).
3. **Endpoints** (`http.ts`): `POST /api/agents/circle-wallet` (provision), `GET
   /api/agents/circle-wallet?agentId=` (read), mirroring the vault endpoints. Owner-only.
4. **Frontend**: a `CircleWalletPanel` in `Permissions.tsx` next to `VaultPanel`, and extend the
   Settlements badge to distinguish `circle-agent-stack` vs `onchain-vault` vs `server`.

**Extend `enforcedBy`** in both `mcp/src/platform.ts` (Instruction type) and
`src/routes/app/Settlements.tsx` to a third value `'circle-agent-stack'`.

---

## 4. Narrative / pitch (get this exactly right — it's the hero)

> "Circle Agent Stack gives an agent a wallet and hosted spend policy. A-Identity adds the two
> things it doesn't: a **verifiable on-chain identity** (ERC-8004 passport + reputation) and a
> **trustless on-chain enforcement layer** (the AgentSpendPolicy vault) where the rule lives in
> the contract, not a server. We enforce policy in depth: our server pre-checks, Circle's hosted
> engine enforces at the wallet layer, and our on-chain vault is the source of truth that reverts
> on Arc. Same agent, same USDC, three independent guarantees."

Be honest that Circle's layer is hosted/off-chain and the vault is chain-enforced — judges reward
precision. Do NOT claim Circle Agent Stack is on-chain enforcement; that's the vault's job.

---

## 5. Guardrails & commands

- **Scope discipline:** Arc + Circle only. No Stellar/Solana/Avalanche for these hackathons
  (roadmap/vision only).
- **Additive + fallback:** never remove or weaken the server pre-check or the on-chain vault.
  Circle path must degrade to no-op without creds.
- **Build/test:** backend `cd mcp && npm run build` (tsc) + `npm run compile` (contract) +
  `node --env-file=.env scripts/test-vault.mjs`. Frontend `npx tsc --noEmit` at repo root.
- **Run backend with the key:** `node --env-file=mcp/.env mcp/dist/http.js` (it does NOT
  auto-load .env). `ARC_SIGNER_KEY` is a burned testnet wallet (`0xd305…`), testnet-only.
- **Local dev:** frontend `npm run dev` (5173) + backend started separately with the key. Do
  NOT use `npm run dev:all` (starts a keyless backend on 3399 that conflicts).
- **Commit trailer:** `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
  Confirm with the user before committing/pushing (push redeploys prod).

---

## 6. Definition of done for Phase 3

- [ ] User has provided Circle creds; exact env-var names confirmed via the codegen MCP.
- [ ] `circle-agent.ts` provisions an Agent Wallet on ARC-TESTNET and maps our Permissions to a
      Circle spend policy, credential-gated (no-op without the key).
- [ ] `executeInstruction` can settle a payment through the Circle wallet and tags
      `enforcedBy: 'circle-agent-stack'`; a Circle-policy rejection surfaces honestly.
- [ ] Endpoints + `CircleWalletPanel` UI, mirroring the vault.
- [ ] E2E covers the Circle path (adapts to whether creds are present, like the on-chain steps do).
- [ ] Pitch copy in the UI/docs states precisely: server pre-check + Circle hosted + on-chain vault.
- [ ] Committed and pushed to BOTH remotes (with user OK), heads verified equal.
