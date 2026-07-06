/**
 * Builds the A-Identity MCP server and registers its read-only tools.
 * Shared by the stdio entry (index.ts) and the HTTP entry (http.ts).
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getHistory, listAgents, listCapabilities, CHAIN_CONFIG } from './data.js'
import { createIdentityProvider } from './erc8004.js'
import { computeReputation } from './reputation.js'
import { getArcStatus } from './arc.js'
import { getCircleStatus } from './circle.js'

const json = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
})

export function buildServer(): McpServer {
  const server = new McpServer({ name: 'a-identity-mcp', version: '0.2.0' })
  const identity = createIdentityProvider()

  server.registerTool(
    'resolve_agent',
    {
      title: 'Resolve agent identity',
      description:
        "Resolve an agent's identity by agent id (CAIP-10), token id, owner address, or domain. Supports Ethereum, Base, Arbitrum (ERC-8004 native), plus Stellar and Algorand (identity bridged). Read-only.",
      inputSchema: {
        query: z
          .string()
          .describe(
            'Agent id (e.g. "eip155:1:8004/1", "stellar:pubnet:aid/8", "algorand:mainnet:aid/9"), token id ("#2"), owner address, or domain',
          ),
        chain: z
          .enum(['ethereum', 'base', 'arbitrum', 'stellar', 'algorand'])
          .optional()
          .describe('Optional chain filter. Omit to search all chains.'),
      },
    },
    async ({ query, chain }) => {
      const agent = await identity.resolve(query)
      if (!agent) return json({ found: false, query, reason: 'No matching registration' })
      if (chain && agent.chain !== chain) {
        return json({
          found: false,
          query,
          reason: `Agent resolved on "${agent.chain}", not the requested chain "${chain}"`,
        })
      }
      return json({ found: true, source: identity.kind, agent })
    },
  )

  server.registerTool(
    'get_reputation',
    {
      title: 'Get agent reputation',
      description:
        "Compute an agent's deterministic reputation score (0-1000) and breakdown by agent id. Works across all supported chains (Arc, Base, Arbitrum, Stellar, Algorand). Read-only.",
      inputSchema: {
        agentId: z
          .string()
          .describe(
            'The agent id (CAIP-10, e.g. "eip155:1:8004/1", "eip155:8453:8004/4") or token id ("#1")',
          ),
      },
    },
    async ({ agentId }) => {
      const history = getHistory(agentId)
      if (!history) return json({ found: false, agentId, reason: 'Unknown agent or no history yet' })
      return json({ found: true, reputation: computeReputation(history) })
    },
  )

  server.registerTool(
    'list_agents',
    {
      title: 'List registered agents',
      description:
        'List all registered agents, optionally filtered by chain. Returns agentId, domain, valid status, and chain.',
      inputSchema: {
        chain: z
          .enum(['ethereum', 'base', 'arbitrum', 'stellar', 'algorand'])
          .optional()
          .describe('Filter by chain. Omit to list all chains.'),
      },
    },
    async ({ chain }) => {
      const agents = listAgents(chain)
      return json({
        total: agents.length,
        chain: chain ?? 'all',
        agents: agents.map((a) => ({
          agentId: a.agentId,
          domain: a.domain,
          valid: a.valid,
          chain: a.chain,
          registeredAt: a.registeredAt,
        })),
      })
    },
  )

  server.registerTool(
    'get_chain_status',
    {
      title: 'Get supported chain status',
      description:
        'List the chains A-Identity supports for identity and x402 payments (Arc, Base, Arbitrum, Stellar, Algorand), with identity standard, x402 support, status, and registered agent counts.',
      inputSchema: {},
    },
    async () => {
      return json({ chains: CHAIN_CONFIG })
    },
  )

  server.registerTool(
    'get_arc_status',
    {
      title: 'Get live Circle Arc status',
      description:
        'Connect to the Circle Arc testnet over JSON-RPC and read live chain state (chainId, latest block). Arc pays gas in USDC with sub-second finality. Read-only, no keys.',
      inputSchema: {},
    },
    async () => json(await getArcStatus()),
  )

  server.registerTool(
    'get_circle_status',
    {
      title: 'Get Circle platform status',
      description:
        'Report the Circle developer platform link: wallets (W3S), Gateway (unified balance), USDC. Performs a real authenticated ping when CIRCLE_API_KEY is set; otherwise explains what to configure. Read-only.',
      inputSchema: {},
    },
    async () => json(await getCircleStatus()),
  )

  server.registerTool(
    'list_capabilities',
    {
      title: 'List A-Identity capabilities',
      description:
        'Describe the full A-Identity protocol surface: identity, payments, connectivity, reputation, and supported chains.',
      inputSchema: {},
    },
    async () => json(listCapabilities()),
  )

  return server
}
