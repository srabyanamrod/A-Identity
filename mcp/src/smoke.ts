/**
 * Smoke test: spin up the built server over stdio, list its tools, and call
 * each one. Exits non-zero on any failure so it can gate CI later.
 *
 * Run with: npm run build && npm run smoke
 */
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const serverPath = fileURLToPath(new URL('./index.js', import.meta.url))

type TextResult = { content: { type: string; text: string }[] }
const textOf = (r: TextResult) => r.content.map((c) => c.text).join('\n')

async function main() {
  const transport = new StdioClientTransport({
    command: process.execPath, // node
    args: [serverPath],
  })
  const client = new Client({ name: 'a-identity-smoke', version: '0.1.0' })
  await client.connect(transport)

  const { tools } = await client.listTools()
  const names = tools.map((t) => t.name).sort()
  console.log('tools:', names.join(', '))

  const expected = [
    'get_arc_status',
    'get_chain_status',
    'get_circle_status',
    'get_reputation',
    'list_agents',
    'list_capabilities',
    'resolve_agent',
  ]
  for (const name of expected) {
    if (!names.includes(name)) throw new Error(`missing tool: ${name}`)
  }

  const resolved = (await client.callTool({
    name: 'resolve_agent',
    arguments: { query: 'payments.a-identity.dev' },
  })) as TextResult
  console.log('\nresolve_agent(payments.a-identity.dev):')
  console.log(textOf(resolved))

  const rep = (await client.callTool({
    name: 'get_reputation',
    arguments: { agentId: 'eip155:1:8004/1' },
  })) as TextResult
  console.log('\nget_reputation(eip155:1:8004/1):')
  console.log(textOf(rep))

  const caps = (await client.callTool({
    name: 'list_capabilities',
    arguments: {},
  })) as TextResult
  console.log('\nlist_capabilities():')
  console.log(textOf(caps))

  // basic assertions
  if (!textOf(resolved).includes('"found": true')) throw new Error('resolve_agent did not resolve')
  const score = JSON.parse(textOf(rep)).reputation?.score
  if (typeof score !== 'number' || score <= 0) throw new Error('get_reputation returned no score')
  if (!textOf(caps).includes('ERC-8004')) throw new Error('list_capabilities missing identity standard')

  // determinism: a second identical call must return the same score
  const rep2 = (await client.callTool({
    name: 'get_reputation',
    arguments: { agentId: 'eip155:1:8004/1' },
  })) as TextResult
  if (JSON.parse(textOf(rep2)).reputation?.score !== score) {
    throw new Error('reputation not deterministic')
  }

  // multi-chain: all five chains must be reported
  const chainStatus = (await client.callTool({
    name: 'get_chain_status',
    arguments: {},
  })) as TextResult
  const chainIds = JSON.parse(textOf(chainStatus)).chains.map((c: { id: string }) => c.id)
  for (const id of ['arc', 'base', 'arbitrum', 'stellar', 'algorand']) {
    if (!chainIds.includes(id)) throw new Error(`get_chain_status missing chain: ${id}`)
  }

  // non-EVM resolution: Stellar and Algorand agents must resolve
  for (const q of ['stellar:pubnet:aid/8', 'algorand:mainnet:aid/9']) {
    const r = (await client.callTool({ name: 'resolve_agent', arguments: { query: q } })) as TextResult
    if (!textOf(r).includes('"found": true')) throw new Error(`resolve_agent failed for ${q}`)
  }

  // chain filter: a Base agent must NOT resolve when filtered to a different chain
  const mismatched = (await client.callTool({
    name: 'resolve_agent',
    arguments: { query: 'eip155:8453:8004/4', chain: 'arbitrum' },
  })) as TextResult
  if (textOf(mismatched).includes('"found": true')) {
    throw new Error('resolve_agent chain filter did not reject a cross-chain match')
  }

  // list_agents per chain
  const baseAgents = (await client.callTool({
    name: 'list_agents',
    arguments: { chain: 'base' },
  })) as TextResult
  const baseTotal = JSON.parse(textOf(baseAgents)).total
  if (baseTotal < 1) throw new Error('list_agents(base) returned no agents')

  await client.close()
  console.log(
    `\n✅ smoke test passed (score=${score}, 5 chains, non-EVM resolves, chain filter works, base agents=${baseTotal})`,
  )
}

main().catch((err) => {
  console.error('❌ smoke test failed:', err)
  process.exit(1)
})
