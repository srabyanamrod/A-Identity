# Circle Agent Marketplace — listing the A-Identity Trust Oracle

This directory holds the service manifest for listing **A-Identity — Agent Trust Oracle**
on Circle's Agent Marketplace (`agents.circle.com/services`), the same x402 service we already
sell on OKX.AI (Agent #6271).

- **`circle-agent-marketplace.json`** — the service descriptor (name, tools, prices, x402
  networks, provider ERC-8004 identity, discovery links). This is the single source of truth;
  the live ASP serves it at **`GET https://a-identity-asp.onrender.com/.well-known/agent.json`**
  (and `/manifest`), which is what `circle services inspect "<url>"` and the marketplace read.

## Listing checklist (a Circle-account action — done once, by the account owner)

Registering a service on `agents.circle.com` is an account/console action; it can't be done
headlessly. Steps:

1. **Install the Circle CLI** and sign in with the Circle account:
   `npm install -g @circle-fin/cli` → `circle login`.
2. **Accept the marketplace Terms** (show the live values, don't hardcode them):
   `circle terms show --init --output json` → review → `circle terms accept --output json`.
3. **Confirm the service is discoverable** — the manifest must resolve publicly:
   `curl -s https://a-identity-asp.onrender.com/.well-known/agent.json | jq .`
4. **Submit the listing** on `agents.circle.com/services` (web console) using the fields from
   `circle-agent-marketplace.json`: service URL `https://a-identity-asp.onrender.com`, the four
   tools + prices, x402 payment (USDC), and the provider identity (ERC-8004 Meridian #849980).
5. **Verify it's searchable** once approved: `circle services search "trust oracle" --output json`
   should return the service; `circle services inspect "https://a-identity-asp.onrender.com" --output json`
   should return the manifest above.

## Dogfooding it (already wired, no account needed)

The same `risk_check` tool is bought by one of our own agents over x402 on **Arc testnet**
(Circle Gateway nanopayment) via `POST /api/arc/trust-oracle-demo` on the main backend — an agent
pays ~$0.005 and gets an ALLOW/WARN/DENY verdict before it transacts. See
`mcp/scripts/test-dogfood.mjs` (real on-chain proof) and the "Trust Oracle" panel in the app.
