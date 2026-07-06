# @a-identity/mcp

The A-Identity **MCP server** - read-only tools any MCP-capable agent can call.

This is Phase 4 of the platform: a safe, read-only surface. **No private keys,
no funds, no chain writes.** Identity/reputation reads run against mock data and
are swapped for real ERC-8004 / chain adapters in a later phase.

## Tools

| Tool                | Input                          | Returns                                  |
| ------------------- | ------------------------------ | ---------------------------------------- |
| `resolve_agent`     | `query` (id / token / owner / domain) | matching ERC-8004 identity, or `found:false` |
| `get_reputation`    | `agentId`                      | deterministic score + breakdown          |
| `list_capabilities` | -                              | the A-Identity protocol surface          |

## Develop

```bash
npm install
npm run build        # tsc to dist/
npm run start        # run the server on stdio
npm run smoke        # spin up the server + exercise every tool
npm run start:http   # serve over Streamable HTTP (POST /mcp, GET /health)
npm run http-smoke   # exercise the tools over HTTP (server must be running)
```

Identity reads go through a swappable `IdentityProvider` (`src/erc8004.ts`):
the in-memory mock today, an RPC reader once `A_IDENTITY_RPC_URL` +
`ERC8004_IDENTITY_REGISTRY` are set. Reputation is computed deterministically
in `src/reputation.ts`.

## Connect from an MCP client

The server speaks MCP over **stdio**. Point any client at the built entry:

```jsonc
{
  "mcpServers": {
    "a-identity": {
      "command": "node",
      "args": ["./mcp/dist/index.js"]
    }
  }
}
```

For Claude Code specifically:

```bash
claude mcp add a-identity -- node ./mcp/dist/index.js
```

> stdout is reserved for the MCP wire protocol - the server logs only to stderr.

## Roadmap (this package)

1. **Read-only tools** ✅ (identity, reputation, capabilities - mock data).
2. Replace mock reads with real **ERC-8004** registry reads (RPC, read-only).
3. Add a **paid tool** via `x402-mcp` on a testnet (still no mainnet value).
4. Wire **Circle Agent Wallets** (sandbox) for the payment handshake.

Anything that deploys a contract, custodies a key, or moves real value stays
**human-on-the-loop**.
