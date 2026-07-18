# Circle Agent Marketplace — listing the A-Identity Trust Oracle

This directory holds the service manifest for listing **A-Identity — Agent Trust Oracle**
on Circle's Agent Marketplace (`agents.circle.com/services`), the same x402 service we already
sell on OKX.AI (Agent #6271).

- **`circle-agent-marketplace.json`** — the service descriptor (name, tools, prices, x402
  networks, provider ERC-8004 identity, discovery links). This is the single source of truth;
  the live ASP serves it at **`GET https://a-identity-asp.onrender.com/.well-known/agent.json`**
  (and `/manifest`), which is what `circle services inspect "<url>"` and the marketplace read.

## Listing checklist (a Circle-account action — done once, by the account owner)

**Reality check (researched 2026-07-19):** Circle does **not** publish a documented self-serve
"submit your service" form or CLI command. `agents.circle.com` only exposes "Browse the marketplace"
(buyer side); the `@circle-fin/cli` is buyer-side only (`circle services search/inspect/pay` — there
is **no** `circle services publish`). So listing is **not** a headless step — it goes through Circle.

Our side is fully ready: the service is x402-compliant and serves an inspectable manifest at
`https://a-identity-asp.onrender.com/.well-known/agent.json`.

To get listed:

1. Go to the **Circle / Encode hackathon Discord** (or the Circle Developer Discord) and request the
   listing in the marketplace / support / sponsor channel. Paste the service details:
   - Service URL: `https://a-identity-asp.onrender.com`
   - Manifest: `https://a-identity-asp.onrender.com/.well-known/agent.json`
   - Tools (USDC/x402): `verify_agent` $0.001 · `reputation_score` $0.002 · `risk_check` $0.005 · `agent_passport` $0.01
   - Provider identity: ERC-8004 (Meridian #849980) on Arc testnet · app https://a-identity.xyz
2. If the marketplace **auto-indexes** discoverable x402 services, ours is already ready — check with
   `npm i -g @circle-fin/cli && circle login`, then `circle services search "trust oracle" --output json`.
3. Once listed, verify: `circle services inspect "https://a-identity-asp.onrender.com" --output json`.

## Dogfooding it (already wired, no account needed)

The same `risk_check` tool is bought by one of our own agents over x402 on **Arc testnet**
(Circle Gateway nanopayment) via `POST /api/arc/trust-oracle-demo` on the main backend — an agent
pays ~$0.005 and gets an ALLOW/WARN/DENY verdict before it transacts. See
`mcp/scripts/test-dogfood.mjs` (real on-chain proof) and the "Trust Oracle" panel in the app.
