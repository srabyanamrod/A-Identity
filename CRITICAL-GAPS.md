# A-Identity — Critical Gaps Review

> Date: 2026-07-09 · Branch: `review/critical-gaps`
> Scope: `src/` (React/Vite frontend), `mcp/src/` (MCP + REST backend), `docs/`, README claims.
> Method: source reading + live verification (Arc testnet RPC calls).

---

## First, the good news: one claim is genuinely true

The README says "real deployed contracts, no mocks," and the **read path is genuinely live**. Verified against the RPC:

- `eth_chainId` → `0x4cef52` = **5042002** (correct Arc testnet)
- `identityRegistry.name()` → returns **"AgentIdentity"**

So the live contract reads in `mcp/src/arc-contracts.ts` are not fabricated. This is the project's strongest part; lead with it.

Beyond that, there are serious gaps between the story the product sells and what the code actually does.

---

## 📊 Progress — closed vs open (updated 2026-07-10)

Live: frontend https://a-identity.vercel.app · backend https://a-identity-backend.onrender.com

| # | Gap | Status |
|---|-----|--------|
| 1 | No backend auth / approval gate unprotected | ✅ **CLOSED** — real auth via Sign-In with Ethereum (wallet signature, no password); session token required on all writes (401); agent-scoped actions restricted to the owner (403). Email login kept as a guest fallback |
| 2 | Private key server-side + rendered to DOM | ✅ **CLOSED** — keypair now generated in the browser (viem); the server only records the public address. Wallet-signature login also means identity = your own wallet |
| 3 | No KYA verification | ❌ open |
| 4 | Reputation is mock (not on-chain) | ✅ **CLOSED** — computed from real signals: on-chain USDC settlements (real tx hashes), verified ERC-8004 identity, clean ratio, tenure. No more hardcoded 742 |
| 5 | x402 not implemented | ✅ **CLOSED** — real HTTP-402 pay-per-call rail: server returns 402 + requirements, client pays USDC on Arc, server verifies the payment on-chain (with replay protection) and serves the resource. UI panel + E2E coverage |
| 6 | Core flow disconnected + always simulated | ✅ **CLOSED** — instruction console + on-chain anchor + real USDC settlement, verified end-to-end |
| 7 | Wallet + Permissions screens fake | ✅ **CLOSED** — Permissions real (policy engine, daily cap, 00:00 UTC reset, freeze); Wallet real (live Arc balance + real payments) |
| 8 | README `.env` instruction wrong | 🟡 handled for deploy (Render env panel + `PORT` fix); local README still inaccurate |
| 9 | `totalSupply()` reverts (minor) | ✅ **CLOSED** — dropped the reverting totalSupply read and the silently-null registeredAgents field |
| 10 | Production maturity | ✅ **CLOSED** — deployability (Render + Vercel); tests + CI (node:test unit + full E2E, 34 checks, in GitHub Actions); durable persistence via Postgres (`DATABASE_URL`) with a JSON-file fallback for dev — verified surviving a restart. Set `DATABASE_URL` on Render for a fully durable deploy |

**Closed this session:** #1 auth · #2 client-side keys · #4 reputation · #6 core flow · #7 Permissions+Wallet · #9 totalSupply · #10 deployability + tests/CI.
**Remaining:**
- **#3 KYA verification** ❌ — agents are still auto-stamped `kya: 'verified'`; no real check (challenge, wallet proof, or the on-chain ValidationRegistry). The only original gap still open.

(#5 x402, #8 README, and #10 persistence are now closed — see the table above.)

---

## 🔴 Critical gaps

### 1. The security model is not implemented (the biggest issue)
The product's entire value prop is built on "human-on-the-loop / human approval," yet nothing technically enforces it:

- **Zero authentication on the backend.** All `/api/*` endpoints are public, CORS `*`. Most critically, the human approval gate `/api/instructions/approve` has no auth — `mcp/src/http.ts:224`. There is no code backing "only a human can approve"; anyone who sends the request can approve.
- **Frontend login is entirely fake.** `src/store/auth.ts:11-13` — the comment itself says "any credentials succeed," persisting to localStorage.

### 2. Private keys are generated server-side and sent over the wire (contradicts the README)
The README says "never custodies a key, never stored server-side." But:
- The key is generated **on the server** (`mcp/src/platform.ts:126` `generatePrivateKey()`) → at that moment a fully-authorized key exists in server memory.
- It's returned in JSON over plaintext HTTP with CORS `*` and **rendered directly into the browser DOM** — `src/routes/app/AgentId.tsx:492`.

Even on testnet this is a bad pattern and contradicts the "no custody" claim. Correct approach: generate the key **client-side**; the server should never see it.

### 3. There is no "KYA" (Know Your Agent) verification
The "K" in the product name is cosmetic: `mcp/src/platform.ts:230` assigns `kya: 'verified'` to every agent unconditionally. No check, signature, or challenge.

### 4. Reputation is not read from chain — it's mock
`mcp/src/reputation.ts` computes the score deterministically from fake history in `mcp/src/data.ts`. The `reputationRegistry` address is defined but **never queried**. The `742` on the agent card (`src/routes/app/AgentId.tsx:47`) is a hard-coded mock.

### 5. x402 is not implemented at all
x402, sold in the README as a core payment rail, has no code behind it — only an `x402: true` boolean flag and labels in `mcp/src/data.ts`. No HTTP 402 handler, facilitator, or payment middleware.

### 6. The core flow (instruction → payment) is disconnected from the UI and never makes a real payment
Even for a hackathon MVP, this is the most damaging gap:
- The policy engine exists in the backend (`mcp/src/platform.ts:259`), but **the frontend never calls `/api/instructions` anywhere**. The "give the agent a pay/purchase/rent/batch instruction → watch it" loop at the heart of the README has **no screen**.
- `executeInstruction` is **always "simulated"** — no real USDC moves even with `ARC_SIGNER_KEY` set (`mcp/src/platform.ts:337`). The "wallet it can pay from" doesn't work end-to-end.
- Creating an agent from the UI **never calls `registerAgentOnchain`**; `onchain` stays `'queued'` forever. The working `/api/arc/register-onchain` endpoint exists but isn't wired into the product flow.

> **Empirical verification (2026-07-09):** with `ARC_SIGNER_KEY` set (a funded wallet holding 20 test USDC), calling `/api/arc/register-onchain` **broadcast a real tx**: `0xfedb673a8eac15640a0b41c528b70cf60c87aca7b0ee8bdf04d43ea20b811046` (status `0x1`, block 50,832,171), minting ERC-8004 tokenId **849195**, with `ownerOf` = the signer wallet and `tokenURI` = the metadata sent. Conclusion: **the write path is not fake, it genuinely works** — the only problem is that it isn't wired to the product UI. This gap is "not connected," not "not functional."

### 7. The Wallet and Permissions screens are entirely fake
- **Wallet:** balances ($142.50) and transactions are hard-coded (`src/routes/app/Wallet.tsx:21-68`). A live-balance endpoint (`/api/wallet-balance`) exists, but this page never calls it.
- **Permissions:** the product's main control panel, but `src/routes/app/Permissions.tsx` is cosmetic top to bottom — toggles are just local `useState`, nothing is written to the backend, nothing is connected to the real policy engine. The limits a user sets have **no effect** on agent behavior.

### 8. The README instruction is wrong: the backend loads no `.env` file
The README "Going live" step says *"put that wallet's key in a local `.env` as `ARC_SIGNER_KEY`."* But the backend does **not** read it automatically:
- No `dotenv` in the code, no `--env-file` flag; only plain `process.env` reads (`mcp/src/arc-contracts.ts:76`).
- The `mcp:http` script starts the backend with `node mcp/dist/http.js` — with no env file injected (`package.json:12`).
- The root `.env.local` is read only by **Vite (frontend)**; it never reaches the backend.

Result: someone following the README literally puts the key in `.env` and real writes still won't work (this is exactly where we got stuck in this review). Correct usage: `ARC_SIGNER_KEY=0x... node mcp/dist/http.js` (inline) or `node --env-file=mcp/.env mcp/dist/http.js` (Node 20.6+). Fix: add `--env-file` or `dotenv` to the backend and update the README.

### 9. Minor finding: `totalSupply()` reverts on the contract
`readArcContracts` reads `totalSupply` from the identity registry and presents it as "registered agents" (`registeredAgents`) (`mcp/src/arc-contracts.ts:112`). But the live call **reverts** on this function (the registry isn't an enumerable ERC-721). Thanks to `Promise.allSettled`, the error is swallowed and the field silently returns `null` — so the "registered agents" figure never carries real data.

### 10. Production maturity
- **No tests** (only smoke scripts), no CI.
- Persistence is a single `platform.json` file, with no locking/concurrency protection.
- **The backend isn't deployable as-is:** `VITE_MCP_URL` defaults to `localhost:3399`. Even if the site is deployed, there's no hosted backend → everything shows as "offline/mock."

---

## Priority order

| # | Gap | Why it's critical |
|---|-----|-------------------|
| 1 | No backend auth, approval gate unprotected | The whole trust model can't be enforced |
| 2 | Instruction→payment flow disconnected from UI, always "simulated" | The product's core job doesn't work |
| 3 | Permissions screen does nothing | The main value prop is theater |
| 4 | KYA + reputation not real (mock) | The core of the brand promise |
| 5 | Private key generated server-side, rendered into the DOM | Security + contradicts the README |
| 6 | x402 doesn't exist | No code behind the sold rail |

**Fair note:** the README says this is a "hackathon MVP," and the live chain reads genuinely work — a good foundation. But right now the project is **more of a showcase that looks like it works than a working demo.** For a credible product, at minimum #1, #2, and #3 must be closed.

---

## Plain-language summary for a non-blockchain user

**What is A-Identity trying to do?**
For AI agents (software assistants that act for you) to pay each other and buy services, two things are needed:
1. **Identity (passport):** the answer to "is this agent trustworthy?"
2. **Wallet:** an account the agent can pay from within limits you set.

The app offers this: register the agent, give it a wallet, set spending limits, say "buy this," and have it ask you for large expenses.

**What's the actual state right now?** Think of it as **a model apartment you can walk through**:
- **The walls and doors are real:** the app really connects to a live blockchain (Arc testnet) and can say "the identity system is live." ✅
- **No water comes from the taps:** the money in the wallet ($142), the transaction history, the reputation score (742) — all decor, fake numbers. ❌
- **The security locks look installed but aren't wired:** you flip the switches on the limits screen, but nothing behind them is connected; the agent doesn't even see these settings. ❌
- **The pay button doesn't send real money:** when you hit "pay," the system says "I pretended to pay"; not a cent moves. ❌
- **Anyone can open the door:** it says "only you can approve," but technically anyone on the internet can give that approval; the login is fake too. ❌

**In one sentence:** the idea and design are strong, and the live blockchain connection is real; but the three things that do the product's actual job — **real payments, real security locks, and real user control** — aren't wired up yet. Right now it's closer to a polished demo model than a working product.
