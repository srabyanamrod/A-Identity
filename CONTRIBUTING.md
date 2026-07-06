# Contributing and team split

Two tracks, one repo.

| Track | Owner | Scope |
| --- | --- | --- |
| **Backend / networks** | Meris | `mcp/` end to end: Arc + Circle (done, extend), then Stellar. Contract calls, wallet management, on-chain reads/writes, REST endpoints. |
| **Product / GTM** | Aybars | `src/` frontend, `docs/`, pitch, BD, marketing, distribution, content, applications. |

Keep PRs small and scoped to one track where possible. `main` stays deployable.

## Where the backend lives

Everything is in `mcp/src`. The two entry points (`index.ts` stdio, `http.ts`
REST + MCP) share the same modules:

- `arc.ts` — live Arc testnet status (JSON-RPC block reads).
- `arc-contracts.ts` — the real ERC-8004 and ERC-8183 contracts. Verbatim
  addresses, minimal ABIs, live reads (no key) and env-gated writes
  (`ARC_SIGNER_KEY`). **This is the reference for how a network integrates.**
- `circle.ts` — Circle developer platform link (env-gated ping, `CIRCLE_API_KEY`).
- `platform.ts` — the write side: agents, wallets, instructions (policy engine),
  marketplace. JSON-persisted to `mcp/data/` (gitignored).
- `erc8004.ts` — multi-chain identity provider interface (mock + rpc).

Run `cd mcp && npm run build && npm run smoke` after any change.

## Adding a network (the Stellar pattern)

Networks are additive. To add Stellar, follow the shape of `arc-contracts.ts`:

1. **New module** `mcp/src/stellar.ts`. Export:
   - a `readStellarStatus()` that hits Horizon (`https://horizon-testnet.stellar.org`)
     and returns a live status object (no key), mirroring `getArcStatus()`.
   - `registerAgentStellar(...)` and payment/settlement functions, env-gated
     behind a Stellar signing secret. Stellar is not EVM, so use the
     `@stellar/stellar-sdk`, not viem. Identity is anchored via a Soroban
     contract or SEP-10 auth; the ERC-8004 passport is bridged, not native
     (see `docs/chains` for the framing).
2. **Wire REST** in `http.ts`: `GET /api/stellar`, `GET /api/stellar/contracts`,
   and any write endpoints, next to the Arc ones. Keep the prepared-vs-executed
   pattern (return the exact call when no key, broadcast when a key is present).
3. **Register MCP tools** in `server.ts` if agents should read Stellar state
   (`get_stellar_status`), matching the read-only rule (MCP is read-only; writes
   are REST-only).
4. **Config** in `.env.example`: document the Stellar RPC and signer vars.
5. **Frontend flips on** when the integration lands: set the chain `status` to
   `active` in `src/lib/chains.ts`. Until then it stays `planned` and the UI
   labels it honestly.

Golden rules that must hold for every network:

- **No autonomous key custody.** Keys are user-held; the server holds addresses,
  not secrets. Writes are env-gated and human-approved.
- **Honest status.** Live reads are labeled live; simulations are labeled
  simulated; anything unbuilt is labeled `planned`. Never fake traction.
- **Prepared-or-executed.** Every write function returns the exact call it would
  make when no signer is configured, and broadcasts only when one is.

## Env and secrets

Never commit `.env`. `.gitignore` already excludes `.env*` (except
`.env.example`), `mcp/data/`, `node_modules`, and `dist`. If a key ever lands in
a commit, rotate it immediately.

## Style

- Content rules for anything user-facing: plain ASCII punctuation only (no em
  dash, curly quotes, arrows, ellipsis, middle dot). Title Case for eyebrows,
  sentence case for body. Real stablecoins only.
- Backend: keep functions pure where possible; degrade gracefully when an RPC is
  unreachable (return a status object, do not throw into the request handler).
