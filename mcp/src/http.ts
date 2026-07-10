#!/usr/bin/env node
/**
 * A-Identity MCP server - HTTP entry (Streamable HTTP + REST companion).
 *
 *   POST /mcp           to MCP Streamable HTTP (JSON-RPC 2.0, enableJsonResponse)
 *   GET  /health        to liveness probe
 *   GET  /api/agent     to REST: resolve agent (?q=<query>[&chain=<chain>])
 *   GET  /api/reputation to  REST: get reputation (?id=<agentId>)
 *   GET  /api/chains    to REST: list chains and agent counts
 *   GET  /api/agents    to REST: list agents (?chain=<chain>)
 */
import http from 'node:http'
import { URL } from 'node:url'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { buildServer } from './server.js'
import { resolveAgent, getHistory, listAgents, CHAIN_CONFIG } from './data.js'
import { computeReputation } from './reputation.js'
import { getArcStatus } from './arc.js'
import { getCircleStatus } from './circle.js'
import { readArcContracts, registerAgentOnchain, createJobOnchain } from './arc-contracts.js'
import {
  agentPolicy,
  agentReputation,
  anchorAgentOnchain,
  approveInstruction,
  assignWallet,
  createAgent,
  createInstruction,
  createWallet,
  recordWallet,
  executeInstruction,
  followAgent,
  getWalletBalance,
  listInstructions,
  listPlatformAgents,
  marketplace,
  updateAgentPermissions,
  type InstructionType,
} from './platform.js'
import { issueToken, verifyToken } from './auth.js'
import { randomBytes } from 'node:crypto'

// Render/most hosts inject PORT; fall back to our own var, then the local default.
const PORT = Number(process.env.PORT ?? process.env.A_IDENTITY_HTTP_PORT ?? 3399)

/** Short-lived sign-in nonces, keyed by lowercase wallet address (in-memory). */
const nonces = new Map<string, string>()

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c as Buffer))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve(undefined)
      try { resolve(JSON.parse(raw)) } catch (e) { reject(e) }
    })
    req.on('error', reject)
  })
}

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body, null, 2)
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) })
  res.end(payload)
}

/** Map a platform error message to an HTTP status. */
function errStatus(msg: string): number {
  return msg.startsWith('Forbidden') ? 403 : msg.startsWith('Unknown') ? 404 : 400
}

const server = http.createServer(async (req, res) => {
  // Permissive CORS - Vite dev frontend calls this directly.
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, mcp-session-id, mcp-protocol-version')

  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return }

  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)

  // Session identity from the bearer token (null if none / invalid).
  const authHeader = req.headers.authorization
  const caller = verifyToken(
    typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null,
  )

  // ── auth: login (public) ──────────────────────────────────────────────────────
  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    const body = (await readBody(req).catch(() => null)) as { email?: string; name?: string } | null
    if (!body?.email) { sendJson(res, 400, { error: 'email required' }); return }
    const email = String(body.email).trim().toLowerCase()
    sendJson(res, 200, {
      token: issueToken(email),
      user: { email, name: body.name?.trim() || email.split('@')[0] },
    })
    return
  }

  // ── auth: wallet nonce (public) — start Sign-In with Ethereum ─────────────────
  if (req.method === 'POST' && url.pathname === '/api/auth/nonce') {
    const body = (await readBody(req).catch(() => null)) as { address?: string } | null
    if (!body?.address || !/^0x[0-9a-fA-F]{40}$/.test(body.address)) {
      sendJson(res, 400, { error: 'valid address required' }); return
    }
    const addr = body.address.toLowerCase()
    const nonce = randomBytes(16).toString('hex')
    nonces.set(addr, nonce)
    const message = `A-Identity: sign in with your wallet.\n\nAddress: ${addr}\nNonce: ${nonce}`
    sendJson(res, 200, { message })
    return
  }

  // ── auth: wallet verify (public) — finish SIWE, issue a session token ─────────
  if (req.method === 'POST' && url.pathname === '/api/auth/verify') {
    const body = (await readBody(req).catch(() => null)) as
      | { address?: string; message?: string; signature?: string }
      | null
    if (!body?.address || !body?.message || !body?.signature) {
      sendJson(res, 400, { error: 'address, message, signature required' }); return
    }
    const addr = body.address.toLowerCase()
    const nonce = nonces.get(addr)
    if (!nonce || !body.message.includes(nonce)) {
      sendJson(res, 401, { error: 'stale or missing nonce; request a new one' }); return
    }
    try {
      const { verifyMessage } = await import('viem')
      const ok = await verifyMessage({
        address: addr as `0x${string}`,
        message: body.message,
        signature: body.signature as `0x${string}`,
      })
      if (!ok) { sendJson(res, 401, { error: 'signature does not match address' }); return }
    } catch {
      sendJson(res, 401, { error: 'signature verification failed' }); return
    }
    nonces.delete(addr)
    sendJson(res, 200, {
      token: issueToken(addr),
      user: { email: addr, name: `${addr.slice(0, 6)}...${addr.slice(-4)}` },
    })
    return
  }

  // Guard: every other mutating /api endpoint requires a valid session token.
  if (req.method === 'POST' && url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/auth/') && !caller) {
    sendJson(res, 401, { error: 'Authentication required. Log in first.' })
    return
  }

  // ── /health ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, {
      status: 'ok',
      server: 'a-identity-mcp',
      version: '0.2.0',
      transport: 'streamable-http',
      chains: CHAIN_CONFIG.map((c) => ({ id: c.id, status: c.status })),
    })
    return
  }

  // ── REST /api/agent ──────────────────────────────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/api/agent') {
    const q = url.searchParams.get('q') ?? ''
    if (!q) { sendJson(res, 400, { error: 'Missing ?q= parameter' }); return }
    const agent = resolveAgent(q)
    if (!agent) { sendJson(res, 404, { found: false, query: q, reason: 'No matching ERC-8004 registration' }); return }
    sendJson(res, 200, { found: true, source: 'mock', agent })
    return
  }

  // ── REST /api/reputation ─────────────────────────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/api/reputation') {
    const id = url.searchParams.get('id') ?? ''
    if (!id) { sendJson(res, 400, { error: 'Missing ?id= parameter' }); return }
    const history = getHistory(id)
    if (!history) { sendJson(res, 404, { found: false, agentId: id, reason: 'Unknown agent' }); return }
    sendJson(res, 200, { found: true, reputation: computeReputation(history) })
    return
  }

  // ── REST /api/chains ──────────────────────────────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/api/chains') {
    sendJson(res, 200, { chains: CHAIN_CONFIG })
    return
  }

  // ── REST /api/arc (live Circle Arc testnet status) ────────────────────────────
  if (req.method === 'GET' && url.pathname === '/api/arc') {
    const status = await getArcStatus()
    sendJson(res, status.online ? 200 : 503, status)
    return
  }

  // ── REST /api/circle (Circle developer platform link state) ──────────────────
  if (req.method === 'GET' && url.pathname === '/api/circle') {
    sendJson(res, 200, await getCircleStatus())
    return
  }

  // ── REST /api/arc/contracts (LIVE reads of real ERC-8004 + ERC-8183) ─────────
  if (req.method === 'GET' && url.pathname === '/api/arc/contracts') {
    const data = await readArcContracts()
    sendJson(res, data.reachable ? 200 : 503, data)
    return
  }

  // ── Real on-chain agent registration (ERC-8004). Env-gated; prepared w/o key ──
  if (req.method === 'POST' && url.pathname === '/api/arc/register-onchain') {
    const body = (await readBody(req).catch(() => null)) as { metadataUri?: string } | null
    const uri = body?.metadataUri ?? 'ipfs://bafkreibdi6623n3xpf7ymk62ckb4bo75o3qemwkpfvp5i25j66itxvsoei'
    sendJson(res, 200, await registerAgentOnchain(uri))
    return
  }

  // ── Real ERC-8183 job (escrow). Env-gated; prepared w/o key ──────────────────
  if (req.method === 'POST' && url.pathname === '/api/arc/create-job') {
    const body = (await readBody(req).catch(() => null)) as
      | { provider?: string; evaluator?: string; description?: string }
      | null
    if (!body?.provider || !body?.evaluator) { sendJson(res, 400, { error: 'provider and evaluator required' }); return }
    sendJson(res, 200, await createJobOnchain({
      provider: body.provider,
      evaluator: body.evaluator,
      description: body.description ?? 'A-Identity agentic-commerce job',
    }))
    return
  }

  // ── REST /api/agents ──────────────────────────────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/api/agents') {
    const chain = url.searchParams.get('chain') ?? undefined
    const agents = listAgents(chain)
    sendJson(res, 200, {
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
    return
  }

  // ── Platform: wallets ─────────────────────────────────────────────────────────
  if (req.method === 'POST' && url.pathname === '/api/wallets') {
    const body = (await readBody(req).catch(() => null)) as { address?: string } | null
    // Preferred: a client-generated address (server never sees the key).
    if (body?.address && /^0x[0-9a-fA-F]{40}$/.test(body.address)) {
      sendJson(res, 201, recordWallet(body.address))
      return
    }
    // Legacy fallback: server-side generation (key returned once, not stored).
    sendJson(res, 201, await createWallet())
    return
  }
  if (req.method === 'POST' && url.pathname === '/api/wallets/assign') {
    const body = (await readBody(req).catch(() => null)) as { address?: string; agentId?: string } | null
    if (!body?.address || !body?.agentId) { sendJson(res, 400, { error: 'address and agentId required' }); return }
    const w = assignWallet(body.address, body.agentId)
    sendJson(res, w ? 200 : 404, w ?? { error: 'wallet or agent not found' })
    return
  }
  if (req.method === 'GET' && url.pathname === '/api/wallet-balance') {
    const address = url.searchParams.get('address') ?? ''
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) { sendJson(res, 400, { error: 'valid ?address= required' }); return }
    sendJson(res, 200, await getWalletBalance(address))
    return
  }

  // ── Platform: agents ──────────────────────────────────────────────────────────
  if (req.method === 'POST' && url.pathname === '/api/agents') {
    const body = (await readBody(req).catch(() => null)) as {
      name?: string; description?: string; category?: string
      capabilities?: string[]; permissions?: Record<string, unknown>; walletAddress?: string
    } | null
    if (!body?.name) { sendJson(res, 400, { error: 'name required' }); return }
    const agent = createAgent({
      name: body.name,
      description: body.description ?? '',
      category: body.category ?? 'Other',
      capabilities: Array.isArray(body.capabilities) ? body.capabilities : [],
      permissions: (body.permissions ?? {}) as never,
      walletAddress: body.walletAddress,
      owner: caller ?? undefined,
    })
    sendJson(res, 201, { agent })
    return
  }
  if (req.method === 'GET' && url.pathname === '/api/platform-agents') {
    sendJson(res, 200, { agents: listPlatformAgents() })
    return
  }
  // Anchor an existing platform agent on-chain (real ERC-8004 register, env-gated)
  if (req.method === 'POST' && url.pathname === '/api/agents/anchor') {
    const body = (await readBody(req).catch(() => null)) as { agentId?: string } | null
    if (!body?.agentId) { sendJson(res, 400, { error: 'agentId required' }); return }
    const r = await anchorAgentOnchain(body.agentId, caller ?? undefined)
    if ('error' in r && typeof r.error === 'string') { sendJson(res, errStatus(r.error), r); return }
    sendJson(res, 200, r)
    return
  }
  // Reputation for one agent, computed from real activity
  if (req.method === 'GET' && url.pathname === '/api/agents/reputation') {
    const agentId = url.searchParams.get('agentId') ?? ''
    if (!agentId) { sendJson(res, 400, { error: 'agentId required' }); return }
    const r = agentReputation(agentId)
    sendJson(res, 'error' in r ? 404 : 200, r)
    return
  }
  // Live policy for one agent (limits + today's spend + reset time)
  if (req.method === 'GET' && url.pathname === '/api/agents/policy') {
    const agentId = url.searchParams.get('agentId') ?? ''
    if (!agentId) { sendJson(res, 400, { error: 'agentId required' }); return }
    const p = agentPolicy(agentId)
    sendJson(res, 'error' in p ? 404 : 200, p)
    return
  }
  // Update an agent's permissions (the real policy the engine enforces)
  if (req.method === 'POST' && url.pathname === '/api/agents/permissions') {
    const body = (await readBody(req).catch(() => null)) as { agentId?: string; permissions?: Record<string, unknown> } | null
    if (!body?.agentId || !body?.permissions) { sendJson(res, 400, { error: 'agentId and permissions required' }); return }
    const a = updateAgentPermissions(body.agentId, body.permissions as never, caller ?? undefined)
    sendJson(res, 'error' in a ? errStatus(a.error) : 200, { agent: a })
    return
  }

  // ── Platform: instructions (pay / purchase / rental / batch) ─────────────────
  if (req.method === 'POST' && url.pathname === '/api/instructions') {
    const body = (await readBody(req).catch(() => null)) as {
      agentId?: string; type?: InstructionType; amountUsd?: number
      count?: number; payee?: string; memo?: string
    } | null
    if (!body?.agentId || !body?.type || typeof body.amountUsd !== 'number' || !body?.payee) {
      sendJson(res, 400, { error: 'agentId, type, amountUsd, payee required' }); return
    }
    const ix = createInstruction({ ...body, caller: caller ?? undefined } as never)
    sendJson(res, 'error' in ix ? errStatus(ix.error) : 201, ix)
    return
  }
  if (req.method === 'GET' && url.pathname === '/api/instructions') {
    sendJson(res, 200, { instructions: listInstructions(url.searchParams.get('agentId') ?? undefined) })
    return
  }
  if (req.method === 'POST' && url.pathname === '/api/instructions/approve') {
    const body = (await readBody(req).catch(() => null)) as { id?: string } | null
    if (!body?.id) { sendJson(res, 400, { error: 'id required' }); return }
    const ix = approveInstruction(body.id, caller ?? undefined)
    sendJson(res, 'error' in ix ? errStatus(ix.error) : 200, ix)
    return
  }
  if (req.method === 'POST' && url.pathname === '/api/instructions/execute') {
    const body = (await readBody(req).catch(() => null)) as { id?: string } | null
    if (!body?.id) { sendJson(res, 400, { error: 'id required' }); return }
    const ix = await executeInstruction(body.id, caller ?? undefined)
    sendJson(res, 'error' in ix ? errStatus(ix.error) : 200, ix)
    return
  }

  // ── Platform: marketplace (Agent House) ──────────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/api/marketplace') {
    sendJson(res, 200, marketplace(url.searchParams.get('viewer') ?? undefined))
    return
  }
  if (req.method === 'POST' && url.pathname === '/api/follow') {
    const body = (await readBody(req).catch(() => null)) as { agentId?: string; follower?: string } | null
    if (!body?.agentId || !body?.follower) { sendJson(res, 400, { error: 'agentId and follower required' }); return }
    const r = followAgent(body.agentId, body.follower)
    sendJson(res, 'error' in r ? 404 : 200, r)
    return
  }

  // ── POST /mcp (MCP Streamable HTTP) ──────────────────────────────────────────
  if (req.method === 'POST' && url.pathname === '/mcp') {
    try {
      const body = await readBody(req)
      const mcp = buildServer()
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      })
      res.on('close', () => { transport.close(); void mcp.close() })
      await mcp.connect(transport)
      await transport.handleRequest(req, res, body)
    } catch (err) {
      console.error('[a-identity-mcp] request error:', err)
      if (!res.headersSent) {
        sendJson(res, 500, { jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null })
      }
    }
    return
  }

  sendJson(res, 404, { error: 'not found' })
})

server.listen(PORT, () => {
  console.error(`[a-identity-mcp] HTTP on http://localhost:${PORT}`)
  console.error(`  POST /mcp               MCP JSON-RPC (tools/call, etc.)`)
  console.error(`  GET  /health            liveness probe`)
  console.error(`  GET  /api/agent?q=...   resolve agent by id/address/domain`)
  console.error(`  GET  /api/reputation?id=... reputation score`)
  console.error(`  GET  /api/chains        supported chains`)
  console.error(`  GET  /api/arc           live Circle Arc testnet status`)
  console.error(`  GET  /api/circle        Circle platform link (wallets, gateway, USDC)`)
  console.error(`  GET  /api/agents        list agents (?chain=base|arbitrum|ethereum)`)
})

// Keep-alive: free-tier hosts (e.g. Render) idle-sleep after ~15 min without inbound
// traffic. When RENDER_EXTERNAL_URL is present, ping our own public /health every 10
// minutes so the service stays awake. No-op locally and in CI (the var is unset there).
const keepAliveUrl = process.env.RENDER_EXTERNAL_URL
if (keepAliveUrl) {
  setInterval(() => {
    fetch(`${keepAliveUrl}/health`).catch(() => {})
  }, 10 * 60 * 1000)
  console.error(`[a-identity-mcp] keep-alive self-ping every 10m -> ${keepAliveUrl}/health`)
}
