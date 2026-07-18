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
import { CHAIN_CONFIG } from './data.js'
import { createIdentityProvider } from './erc8004.js'
import { getArcStatus } from './arc.js'
import { getCircleStatus } from './circle.js'
import { readArcContracts, registerAgentOnchain, createJobOnchain, runEscrowJobDemo } from './arc-contracts.js'
import {
  agentPolicy,
  agentReputation,
  anchorAgentOnchain,
  approveInstruction,
  assignWallet,
  createAgent,
  createInstruction,
  initState,
  recordWallet,
  executeInstruction,
  followAgent,
  getWalletBalance,
  listInstructions,
  listPlatformAgents,
  marketplace,
  updateAgentPermissions,
  provisionAgentVault,
  getAgentVault,
  provisionCircleWallet,
  getAgentCircleWallet,
  startKyaChallenge,
  verifyKya,
  getAgentKya,
  getAgentTreasury,
  startAgentAutoYield,
  stopAgentAutoYield,
  type InstructionType,
} from './platform.js'
import { issueToken, verifyToken, isVerified } from './auth.js'
import { magicEnabled, sendMagicLink, verifyMagicToken } from './magic.js'
import {
  x402PayTo, paymentRequirements, verifyPayment, premiumResource,
  issueX402Nonce, x402NonceValid, consumeX402Nonce, verifyPayerBinding,
} from './x402.js'
import { nanoPaymentRequirements, settleNano, nanoResource, runNanopayDemo } from './nanopay.js'
import { runGatewayDemo, gatewayBalance } from './gateway.js'
import { runCctpDemo } from './cctp.js'
import { runAgentRun } from './autopilot.js'
import { randomBytes } from 'node:crypto'

// Render/most hosts inject PORT; fall back to our own var, then the local default.
const PORT = Number(process.env.PORT ?? process.env.A_IDENTITY_HTTP_PORT ?? 3399)

// CORS: an explicit allowlist (comma-separated origins in ALLOWED_ORIGINS) locks the
// API to known frontends in production; unset → '*' for local Vite dev. Prod uses a
// same-origin Vercel proxy, so setting ALLOWED_ORIGINS to the site's origin(s) means
// only the real app can call the API cross-origin.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim().toLowerCase())
  .filter(Boolean)

/** Resolve the Access-Control-Allow-Origin value for a request's Origin header. */
function resolveCorsOrigin(origin: string | undefined): string {
  if (ALLOWED_ORIGINS.length === 0) return '*'
  if (origin && ALLOWED_ORIGINS.includes(origin.toLowerCase())) return origin
  return ALLOWED_ORIGINS[0] // a safe default so preflights still get a concrete allowed origin
}

/**
 * Short-lived Sign-In-with-Ethereum nonces, keyed by lowercase wallet address.
 * In-memory + a 10-minute TTL: a nonce expires if unused and stale entries can't pile
 * up. Correct for our single backend instance; a scaled deploy would move these (and
 * the KYA challenges in platform.ts, and the x402 nonces) to shared storage.
 */
const NONCE_TTL_MS = 10 * 60 * 1000
const nonces = new Map<string, { nonce: string; exp: number }>()

// ── basic per-IP rate limiting (in-memory, per-process) ──────────────────────────
// Fixed-window counters for sensitive/expensive endpoints, so a single client can't
// spam auth challenges, magic-link emails, or the on-chain demo runs. Process-local by
// design (same as the nonce / KYA / x402 stores); a horizontally-scaled deploy would move
// this (and those) to a shared store.
const rlBuckets = new Map<string, { count: number; resetAt: number }>()

function rateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const b = rlBuckets.get(key)
  if (!b || b.resetAt <= now) {
    rlBuckets.set(key, { count: 1, resetAt: now + windowMs })
    return false
  }
  b.count += 1
  return b.count > max
}

// Prune expired buckets occasionally so the map can't grow unbounded. unref() so this
// timer never keeps the process alive on its own.
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of rlBuckets) if (v.resetAt <= now) rlBuckets.delete(k)
}, 5 * 60 * 1000).unref()

/** Per-path rate budget, or null when the path isn't limited. */
function rateBudget(method: string, pathname: string): { bucket: string; max: number; windowMs: number } | null {
  if (method !== 'POST') return null
  // Auth challenges + guest login: cheap to abuse, keep them tight.
  if (pathname === '/api/auth/nonce' || pathname === '/api/auth/verify' || pathname === '/api/auth/login')
    return { bucket: 'auth', max: 20, windowMs: 60_000 }
  // Passwordless email: sends a real email, so limit hardest.
  if (pathname === '/api/auth/magic/request') return { bucket: 'magic', max: 5, windowMs: 60_000 }
  // Expensive on-chain demo runs (each spends gas / moves real testnet value).
  if (pathname === '/api/arc/agent-run' || (pathname.startsWith('/api/arc/') && pathname.endsWith('-demo')))
    return { bucket: 'demo', max: 8, windowMs: 60_000 }
  return null
}

// Number of trusted reverse proxies in front of us (Render/Vercel terminate as 1 hop).
// The real client IP is the XFF entry `TRUSTED_PROXY_COUNT` from the END — NOT the first
// entry, which is fully attacker-controlled (a spoofed X-Forwarded-For would otherwise give
// each request a fresh rate-limit bucket and defeat the limiter entirely).
const TRUSTED_PROXY_COUNT = Math.max(1, Number(process.env.TRUSTED_PROXY_COUNT ?? 1))

function clientIpOf(req: http.IncomingMessage): string {
  const xff = req.headers['x-forwarded-for']
  if (typeof xff === 'string' && xff.length > 0) {
    const parts = xff.split(',').map((s) => s.trim()).filter(Boolean)
    // Take the hop just before our trusted proxy layer; clamp if fewer entries than expected.
    const idx = Math.max(0, parts.length - TRUSTED_PROXY_COUNT)
    if (parts[idx]) return parts[idx]
  }
  return req.socket.remoteAddress || 'unknown'
}

/** Hard cap on a request body. Every endpoint here takes a small JSON object; a bigger
 *  body is abuse (memory spike + it would balloon the single persisted state blob). */
const MAX_BODY_BYTES = 256 * 1024

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (c) => {
      size += (c as Buffer).length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('request body too large'))
        req.destroy()
        return
      }
      chunks.push(c as Buffer)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve(undefined)
      try { resolve(JSON.parse(raw)) } catch (e) { reject(e) }
    })
    req.on('error', reject)
  })
}

// ── small input validators (finite, bounded — no NaN/Infinity/negative slips through) ──
/** A finite, non-negative number no larger than `max` (USD amounts on a testnet demo). */
function validAmount(v: unknown, max = 1_000_000): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max
}
/** Clamp a client-supplied USD amount into [0, max]; non-numbers → `fallback`. */
function clampUsd(v: unknown, max: number, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : fallback
}
/** The on-chain demo endpoints spend the shared server signer. Cap client-chosen amounts
 *  so an internet caller can't force a large deposit/transfer from the house key. Returns
 *  `undefined` for a missing/invalid value so the runner falls back to its own small default. */
const MAX_DEMO_USD = 5
function cappedDemoUsd(v: unknown, max = MAX_DEMO_USD): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : undefined
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

/** The real agents this platform knows, in a public discovery shape. Shared by the
 *  REST /api/agents endpoint and the MCP `list_agents` tool. No mocks. */
function publicAgents() {
  return listPlatformAgents().map((a) => ({
    agentId: a.onchainAgentId ? `eip155:${a.chainId}:8004/${a.onchainAgentId}` : a.id,
    name: a.name,
    chain: a.chain,
    kya: a.kya,
    onchain: a.onchain,
    walletAddress: a.walletAddress,
    onchainExplorer: a.onchainExplorer,
  }))
}

const server = http.createServer(async (req, res) => {
  // CORS: '*' for local dev, or the request's origin when it's on the ALLOWED_ORIGINS
  // allowlist (production lockdown). Vary: Origin keeps caches per-origin correct.
  const reqOrigin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined
  res.setHeader('Access-Control-Allow-Origin', resolveCorsOrigin(reqOrigin))
  if (ALLOWED_ORIGINS.length > 0) res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  // Includes the x402 payment headers (X-Payment*, PAYMENT-SIGNATURE); without them a
  // cross-origin caller's redemption preflight is blocked and shows as "Failed to fetch".
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Payment, X-Payment-Nonce, X-Payment-Payer, X-Payment-Sig, PAYMENT-SIGNATURE, mcp-session-id, mcp-protocol-version',
  )

  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return }

  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)

  // Rate-limit sensitive/expensive endpoints per client IP before doing any work.
  const budget = rateBudget(req.method ?? 'GET', url.pathname)
  if (budget && rateLimited(`${clientIpOf(req)}:${budget.bucket}`, budget.max, budget.windowMs)) {
    res.setHeader('Retry-After', String(Math.ceil(budget.windowMs / 1000)))
    sendJson(res, 429, { error: 'Too many requests. Slow down and try again in a minute.' })
    return
  }

  // Session identity from the bearer token (null if none / invalid).
  const authHeader = req.headers.authorization
  const caller = verifyToken(
    typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null,
  )
  // The subject string used for ownership checks (email or wallet address).
  const callerId = caller?.subject

  // ── auth: login (public) ──────────────────────────────────────────────────────
  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    const body = (await readBody(req).catch(() => null)) as { email?: string; name?: string } | null
    if (!body?.email) { sendJson(res, 400, { error: 'email required' }); return }
    const email = String(body.email).trim().toLowerCase()
    // Unverified, browse-only session: the email is NOT proven. This token is a
    // 'guest' — it cannot own agents or mutate. To act, sign in with a wallet or a
    // magic link (both verified). This is what closes the email-impersonation hole.
    sendJson(res, 200, {
      token: issueToken(email, 'guest'),
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
    nonces.set(addr, { nonce, exp: Date.now() + NONCE_TTL_MS })
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
    const entry = nonces.get(addr)
    if (entry && entry.exp <= Date.now()) nonces.delete(addr)
    const nonce = entry && entry.exp > Date.now() ? entry.nonce : undefined
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
    // Wallet ownership proven by signature → a verified session.
    sendJson(res, 200, {
      token: issueToken(addr, 'wallet'),
      user: { email: addr, name: `${addr.slice(0, 6)}...${addr.slice(-4)}` },
    })
    return
  }

  // ── auth: passwordless email magic-link (public; credential-gated behind Resend) ──
  if (req.method === 'POST' && url.pathname === '/api/auth/magic/request') {
    const body = (await readBody(req).catch(() => null)) as { email?: string } | null
    const email = body?.email?.trim().toLowerCase()
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      sendJson(res, 400, { error: 'A valid email is required' }); return
    }
    const err = await sendMagicLink(email)
    if (err) { sendJson(res, magicEnabled() ? 502 : 501, { sent: false, error: err }); return }
    sendJson(res, 200, { sent: true })
    return
  }
  if (req.method === 'POST' && url.pathname === '/api/auth/magic/verify') {
    const body = (await readBody(req).catch(() => null)) as { token?: string } | null
    const email = verifyMagicToken(body?.token)
    if (!email) { sendJson(res, 401, { error: 'This sign-in link is invalid or expired.' }); return }
    // Email ownership proven by the one-time link → a verified session.
    sendJson(res, 200, { token: issueToken(email, 'email'), user: { email, name: email.split('@')[0] } })
    return
  }

  // Guard: every other mutating /api endpoint requires a VERIFIED session. No token
  // → 401. A guest (unverified email) token → 403: guests are browse-only, so a
  // token minted for an arbitrary email can never act as an agent's owner.
  const isMutation =
    req.method === 'POST' && url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/auth/')
  if (isMutation && !caller) {
    sendJson(res, 401, { error: 'Authentication required. Sign in with a wallet or an email link.' })
    return
  }
  if (isMutation && !isVerified(caller)) {
    sendJson(res, 403, {
      error:
        'Verified sign-in required. Guest sessions are read-only — sign in with your wallet or an emailed magic link to act.',
    })
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

  // ── REST /api/agent — LIVE on-chain ERC-8004 resolve (Arc), no mocks ──────────
  if (req.method === 'GET' && url.pathname === '/api/agent') {
    const q = url.searchParams.get('q') ?? ''
    if (!q) { sendJson(res, 400, { error: 'Missing ?q= parameter' }); return }
    const provider = createIdentityProvider()
    const agent = await provider.resolve(q)
    if (!agent) { sendJson(res, 404, { found: false, query: q, reason: 'No matching ERC-8004 registration on-chain' }); return }
    sendJson(res, 200, { found: true, source: provider.kind, agent })
    return
  }

  // ── REST /api/reputation — real, from platform settlements + on-chain identity ──
  if (req.method === 'GET' && url.pathname === '/api/reputation') {
    const id = url.searchParams.get('id') ?? ''
    if (!id) { sendJson(res, 400, { error: 'Missing ?id= parameter' }); return }
    let rep = agentReputation(id)
    // Accept an on-chain id too (e.g. "eip155:5042002:8004/849980" or a bare token id):
    // map it to the platform agent anchored at that ERC-8004 token, then score it for real.
    if ('error' in rep) {
      const tokenId = id.match(/(\d+)\s*$/)?.[1]
      const anchored = tokenId ? listPlatformAgents().find((a) => a.onchainAgentId === tokenId) : undefined
      if (anchored) rep = agentReputation(anchored.id)
    }
    if ('error' in rep) { sendJson(res, 404, { found: false, agentId: id, reason: 'Unknown agent or no activity yet' }); return }
    sendJson(res, 200, { found: true, reputation: rep })
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

  // ── x402: pay-per-request paid resource (real on-chain USDC settlement) ───────
  if (req.method === 'GET' && url.pathname === '/api/x402/data') {
    const payTo = await x402PayTo()
    if (!payTo) { sendJson(res, 501, { error: 'x402 not configured (no payTo / signer key)' }); return }
    const proof = req.headers['x-payment']
    if (typeof proof !== 'string' || !proof) {
      // No payment yet -> 402 with machine-readable requirements + a fresh single-use
      // nonce. The client echoes this nonce in X-Payment-Nonce when it redeems.
      sendJson(res, 402, paymentRequirements(payTo, issueX402Nonce()))
      return
    }
    // Redeem: the payment must answer THIS challenge — a live nonce we issued, bound to
    // this resource. Without it, an unrelated USDC transfer can't blind-unlock the data.
    const nonce = typeof req.headers['x-payment-nonce'] === 'string' ? req.headers['x-payment-nonce'] : undefined
    if (!x402NonceValid(nonce)) {
      sendJson(res, 402, { ...paymentRequirements(payTo, issueX402Nonce()), verifyError: 'missing or stale payment nonce; re-quote to get a fresh one' })
      return
    }
    // Bind the redemption to the actual PAYER. The client proves control of the paying
    // wallet by signing the (nonce, payer) challenge; we then require the on-chain payment
    // to originate from that same wallet. This is what stops a front-runner who scraped the
    // tx hash off the public chain (or any unrelated transfer to payTo) from redeeming a
    // payment they did not make.
    const payer = typeof req.headers['x-payment-payer'] === 'string' ? req.headers['x-payment-payer'] : undefined
    const paySig = typeof req.headers['x-payment-sig'] === 'string' ? req.headers['x-payment-sig'] : undefined
    if (!payer || !/^0x[0-9a-fA-F]{40}$/.test(payer) || !paySig) {
      // Keep the same nonce live so the client can sign and retry without re-quoting.
      sendJson(res, 402, { ...paymentRequirements(payTo, nonce), verifyError: 'payer proof required: sign the x402 authorization with the paying wallet (X-Payment-Payer + X-Payment-Sig)' })
      return
    }
    if (!(await verifyPayerBinding(nonce!, payer, paySig))) {
      sendJson(res, 402, { ...paymentRequirements(payTo, nonce), verifyError: 'payer signature does not match the paying wallet' })
      return
    }
    const verified = await verifyPayment(proof, payTo, payer)
    if (!verified.ok) {
      // Keep the same nonce live (echo it back) so the client can retry while the
      // payment is still confirming; only a real failure/expiry forces a re-quote.
      sendJson(res, 402, { ...paymentRequirements(payTo, nonce), verifyError: verified.reason })
      return
    }
    consumeX402Nonce(nonce!) // one challenge unlocks the resource exactly once
    sendJson(res, 200, await premiumResource(proof))
    return
  }

  // ── x402 Nanopayments seller: gasless, Gateway-batched USDC (x402 v2) ─────────
  // Second x402 rail. No PAYMENT-SIGNATURE → 402 v2 with the GatewayWalletBatched
  // requirements; with one → settle through Circle Gateway and serve immediately.
  if (req.method === 'GET' && url.pathname === '/api/x402/nano/data') {
    const requirements = await nanoPaymentRequirements()
    if (!requirements) { sendJson(res, 501, { error: 'nanopayments not configured (no payTo / Gateway rail)' }); return }
    const proof = req.headers['payment-signature']
    if (typeof proof !== 'string' || !proof) {
      res.setHeader('PAYMENT-REQUIRED', Buffer.from(JSON.stringify(requirements)).toString('base64'))
      sendJson(res, 402, requirements)
      return
    }
    const settled = await settleNano(proof)
    if (!settled.ok) { sendJson(res, 402, { ...requirements, settleError: settled.reason }); return }
    res.setHeader('PAYMENT-RESPONSE', Buffer.from(JSON.stringify(settled.settle)).toString('base64'))
    sendJson(res, 200, nanoResource(settled.settle))
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

  // ── One-click ERC-8183 escrow lifecycle demo (create→…→complete, real txs) ────
  if (req.method === 'POST' && url.pathname === '/api/arc/job-demo') {
    const body = (await readBody(req).catch(() => null)) as { budgetUsd?: number; description?: string } | null
    sendJson(res, 200, await runEscrowJobDemo({ budgetUsd: body?.budgetUsd, description: body?.description }))
    return
  }

  // ── Circle Gateway: live unified USDC balance (public read) ───────────────────
  if (req.method === 'GET' && url.pathname === '/api/arc/gateway-balance') {
    const address = url.searchParams.get('address') ?? ''
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) { sendJson(res, 400, { error: 'valid ?address= required' }); return }
    sendJson(res, 200, await gatewayBalance(address))
    return
  }

  // ── Circle Gateway: one-click deposit + gasless cross-chain transfer (Arc→Base) ──
  if (req.method === 'POST' && url.pathname === '/api/arc/gateway-demo') {
    const body = (await readBody(req).catch(() => null)) as { amountUsd?: number } | null
    sendJson(res, 200, await runGatewayDemo({ amountUsd: cappedDemoUsd(body?.amountUsd) }))
    return
  }

  // ── Circle Nanopayments: one-click gasless, Gateway-batched USDC nanopayment ──
  if (req.method === 'POST' && url.pathname === '/api/arc/nanopay-demo') {
    const body = (await readBody(req).catch(() => null)) as { amountUsd?: number } | null
    sendJson(res, 200, await runNanopayDemo({ amountUsd: cappedDemoUsd(body?.amountUsd) }))
    return
  }

  // ── Circle CCTP: one-click native USDC bridge (burn-and-mint) Arc → Base Sepolia ──
  if (req.method === 'POST' && url.pathname === '/api/arc/cctp-demo') {
    const body = (await readBody(req).catch(() => null)) as { amountUsd?: number } | null
    sendJson(res, 200, await runCctpDemo({ amountUsd: cappedDemoUsd(body?.amountUsd) }))
    return
  }

  // ── Autonomous agent run: the agent pays a service on its own until it hits the
  //    human-set budget, then stops itself; a protocol fee is routed to the treasury.
  if (req.method === 'POST' && url.pathname === '/api/arc/agent-run') {
    const body = (await readBody(req).catch(() => null)) as { maxCalls?: number; amountUsd?: number; budgetUsd?: number } | null
    // Cap the client-chosen amounts: this run deposits/spends the shared server signer.
    sendJson(res, 200, await runAgentRun({
      maxCalls: body?.maxCalls,
      amountUsd: cappedDemoUsd(body?.amountUsd, 0.05),
      budgetUsd: cappedDemoUsd(body?.budgetUsd, MAX_DEMO_USD),
    }))
    return
  }

  // ── REST /api/agents — real agents this platform knows (no mocks) ─────────────
  if (req.method === 'GET' && url.pathname === '/api/agents') {
    const agents = publicAgents()
    sendJson(res, 200, { total: agents.length, source: 'platform', agents })
    return
  }

  // ── Platform: wallets ─────────────────────────────────────────────────────────
  if (req.method === 'POST' && url.pathname === '/api/wallets') {
    const body = (await readBody(req).catch(() => null)) as { address?: string } | null
    // No-custody by construction: the client generates the keypair in the browser and only
    // ever sends the public address. The server never generates or returns a private key
    // (the old server-side fallback returned a raw key over HTTP — removed).
    if (!body?.address || !/^0x[0-9a-fA-F]{40}$/.test(body.address)) {
      sendJson(res, 400, { error: 'a client-generated wallet address (0x…) is required; the server never creates or holds private keys' })
      return
    }
    sendJson(res, 201, recordWallet(body.address))
    return
  }
  if (req.method === 'POST' && url.pathname === '/api/wallets/assign') {
    const body = (await readBody(req).catch(() => null)) as { address?: string; agentId?: string } | null
    if (!body?.address || !body?.agentId) { sendJson(res, 400, { error: 'address and agentId required' }); return }
    const w = assignWallet(body.address, body.agentId, callerId)
    if ('error' in w) { sendJson(res, errStatus(w.error), w); return }
    sendJson(res, 200, w)
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
      owner: callerId,
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
    const r = await anchorAgentOnchain(body.agentId, callerId)
    if ('error' in r && typeof r.error === 'string') { sendJson(res, errStatus(r.error), r); return }
    sendJson(res, 200, r)
    return
  }
  // Provision an on-chain policy vault for an agent (deploy + optional funding, env-gated)
  if (req.method === 'POST' && url.pathname === '/api/agents/vault') {
    const body = (await readBody(req).catch(() => null)) as { agentId?: string; fundUsd?: number; ownerAddress?: string } | null
    if (!body?.agentId) { sendJson(res, 400, { error: 'agentId required' }); return }
    // fundUsd is deposited from the shared server signer — cap it like the other demo spends.
    const r = await provisionAgentVault(body.agentId, { fundUsd: cappedDemoUsd(body.fundUsd), caller: callerId, ownerAddress: body.ownerAddress })
    if ('error' in r && typeof r.error === 'string') { sendJson(res, errStatus(r.error), r); return }
    sendJson(res, 200, r)
    return
  }
  // Read an agent's live on-chain vault policy + balance
  if (req.method === 'GET' && url.pathname === '/api/agents/vault') {
    const agentId = url.searchParams.get('agentId') ?? ''
    if (!agentId) { sendJson(res, 400, { error: 'agentId required' }); return }
    const r = await getAgentVault(agentId)
    if ('error' in r && typeof r.error === 'string') { sendJson(res, errStatus(r.error), r); return }
    sendJson(res, 200, r)
    return
  }
  // Provision a Circle Agent Wallet for an agent (hosted policy layer, credential-gated)
  if (req.method === 'POST' && url.pathname === '/api/agents/circle-wallet') {
    const body = (await readBody(req).catch(() => null)) as { agentId?: string; fund?: boolean } | null
    if (!body?.agentId) { sendJson(res, 400, { error: 'agentId required' }); return }
    const r = await provisionCircleWallet(body.agentId, { fund: body.fund, caller: callerId })
    if ('error' in r && typeof r.error === 'string') { sendJson(res, errStatus(r.error), r); return }
    sendJson(res, 200, r)
    return
  }
  // Read an agent's live Circle Agent Wallet state + balances
  if (req.method === 'GET' && url.pathname === '/api/agents/circle-wallet') {
    const agentId = url.searchParams.get('agentId') ?? ''
    if (!agentId) { sendJson(res, 400, { error: 'agentId required' }); return }
    const r = await getAgentCircleWallet(agentId)
    if ('error' in r && typeof r.error === 'string') { sendJson(res, errStatus(r.error), r); return }
    sendJson(res, 200, r)
    return
  }
  // ── Treasury: idle-balance auto-yield into USYC (Circle's yield-bearing token) ──
  // Live multi-asset balances + deployable idle + projected USYC earnings (read-only)
  if (req.method === 'GET' && url.pathname === '/api/agents/treasury') {
    const agentId = url.searchParams.get('agentId') ?? ''
    if (!agentId) { sendJson(res, 400, { error: 'agentId required' }); return }
    const capParam = url.searchParams.get('cap')
    const cap = capParam !== null && Number.isFinite(Number(capParam)) ? Number(capParam) : undefined
    const r = await getAgentTreasury(agentId, cap)
    if ('error' in r && typeof r.error === 'string') { sendJson(res, errStatus(r.error), r); return }
    sendJson(res, 200, r)
    return
  }
  // Owner authorizes (or turns off) auto-yield at a working-capital cap
  if (req.method === 'POST' && url.pathname === '/api/agents/treasury') {
    const body = (await readBody(req).catch(() => null)) as { agentId?: string; capUsd?: number; enabled?: boolean } | null
    if (!body?.agentId) { sendJson(res, 400, { error: 'agentId required' }); return }
    const r =
      body.enabled === false
        ? stopAgentAutoYield(body.agentId, callerId)
        : await startAgentAutoYield(body.agentId, typeof body.capUsd === 'number' ? body.capUsd : 25, callerId)
    if ('error' in r && typeof r.error === 'string') { sendJson(res, errStatus(r.error), r); return }
    sendJson(res, 200, r)
    return
  }
  // ── KYA (Know Your Agent): prove the agent controls its wallet ─────────────────
  // Start a challenge for the agent to sign (owner-only)
  if (req.method === 'POST' && url.pathname === '/api/agents/kya/challenge') {
    const body = (await readBody(req).catch(() => null)) as { agentId?: string } | null
    if (!body?.agentId) { sendJson(res, 400, { error: 'agentId required' }); return }
    const r = startKyaChallenge(body.agentId, callerId)
    if ('error' in r) { sendJson(res, errStatus(r.error), r); return }
    sendJson(res, 200, r)
    return
  }
  // Finish KYA: verify the wallet signature, mark verified, attest on-chain (best-effort)
  if (req.method === 'POST' && url.pathname === '/api/agents/kya/verify') {
    const body = (await readBody(req).catch(() => null)) as { agentId?: string; message?: string; signature?: string } | null
    if (!body?.agentId || !body?.message || !body?.signature) {
      sendJson(res, 400, { error: 'agentId, message, signature required' }); return
    }
    const r = await verifyKya(body.agentId, body.message, body.signature, callerId)
    if ('error' in r) { sendJson(res, errStatus(r.error), r); return }
    sendJson(res, 200, r)
    return
  }
  // Read an agent's KYA status + live on-chain validation
  if (req.method === 'GET' && url.pathname === '/api/agents/kya') {
    const agentId = url.searchParams.get('agentId') ?? ''
    if (!agentId) { sendJson(res, 400, { error: 'agentId required' }); return }
    const r = await getAgentKya(agentId)
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
    const a = await updateAgentPermissions(body.agentId, body.permissions as never, callerId)
    sendJson(res, 'error' in a ? errStatus(a.error) : 200, { agent: a })
    return
  }

  // ── Platform: instructions (pay / purchase / rental / batch) ─────────────────
  if (req.method === 'POST' && url.pathname === '/api/instructions') {
    const body = (await readBody(req).catch(() => null)) as {
      agentId?: string; type?: InstructionType; amountUsd?: number
      count?: number; payee?: string; memo?: string
    } | null
    if (!body?.agentId || !body?.type || !body?.payee) {
      sendJson(res, 400, { error: 'agentId, type, amountUsd, payee required' }); return
    }
    if (!validAmount(body.amountUsd)) {
      // Reject negative/NaN/Infinity here: a negative amount would otherwise subtract from
      // the agent's daily spend, letting an owner rewind their own safety cap.
      sendJson(res, 400, { error: 'amountUsd must be a finite number between 0 and 1000000' }); return
    }
    if (body.count !== undefined && !(Number.isFinite(body.count) && body.count! >= 1 && body.count! <= 1000)) {
      sendJson(res, 400, { error: 'count must be an integer between 1 and 1000' }); return
    }
    const ix = createInstruction({ ...body, caller: callerId } as never)
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
    const ix = approveInstruction(body.id, callerId)
    sendJson(res, 'error' in ix ? errStatus(ix.error) : 200, ix)
    return
  }
  if (req.method === 'POST' && url.pathname === '/api/instructions/execute') {
    const body = (await readBody(req).catch(() => null)) as { id?: string } | null
    if (!body?.id) { sendJson(res, 400, { error: 'id required' }); return }
    const ix = await executeInstruction(body.id, callerId)
    sendJson(res, 'error' in ix ? errStatus(ix.error) : 200, ix)
    return
  }

  // ── Platform: marketplace (Agent House) ──────────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/api/marketplace') {
    const includeAll = url.searchParams.get('all') === '1'
    sendJson(res, 200, marketplace(url.searchParams.get('viewer') ?? undefined, includeAll))
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
      const mcp = buildServer({ listAgents: publicAgents, getReputation: (id) => agentReputation(id) })
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

// Load persisted state (Postgres or JSON) before we start serving.
await initState()

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
