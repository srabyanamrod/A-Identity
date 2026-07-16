/**
 * A-Identity — Agent Trust Oracle: the OKX.AI ASP (A2MCP) gateway.
 *
 * A thin public HTTPS service that sells four pay-per-call tools, each a wrapper over
 * A-Identity's existing live engine (see ./asp/tools.ts). OKX x402 charges per call on
 * X Layer when credentials are set (./asp/payment.ts); otherwise it serves free so the
 * service is always deployable and testable.
 *
 * Run: `npm run build && npm run start:asp` (PORT / ASP_PORT selects the port).
 *
 *   GET  /health           free — liveness + service card (discovery)
 *   POST /tools/verify_agent      $0.001 — ERC-8004 identity + KYA
 *   POST /tools/reputation_score  $0.002 — 0-1000 on-chain reputation
 *   POST /tools/risk_check        $0.005 — ALLOW/WARN/DENY pre-tx risk
 *   POST /tools/agent_passport    $0.01  — full agent passport
 */
import express, { type Request, type Response } from 'express'
import { initState } from './platform.js'
import { verifyAgent, reputationScore, riskCheck, agentPassport, type TxContext } from './asp/tools.js'
import { applyOkxX402, type PaymentStatus } from './asp/payment.js'

const SERVICE = 'A-Identity — Agent Trust Oracle'
const PORT = Number(process.env.ASP_PORT ?? process.env.PORT ?? 4000)

/** Pull a required string `agentId` from a request body, or explain what's missing. */
function requireAgentId(req: Request): { agentId: string } | { error: string } {
  const id = req.body?.agentId ?? req.body?.agent_id
  if (typeof id !== 'string' || id.trim() === '') {
    return { error: 'Body must include a non-empty string "agentId" (platform id, ERC-8004 token id like "#849980", or owner address).' }
  }
  return { agentId: id.trim() }
}

/** Run a tool handler, translating errors into a clean 400/500 JSON envelope. */
function handle(fn: (req: Request) => Promise<unknown>) {
  return async (req: Request, res: Response) => {
    try {
      const out = await fn(req)
      if (out && typeof out === 'object' && typeof (out as { error?: unknown }).error === 'string') {
        res.status(400).json(out)
        return
      }
      res.json(out)
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) })
    }
  }
}

function serviceCard(payment: PaymentStatus) {
  return {
    service: SERVICE,
    positioning: 'The identity & reputation oracle for the agent economy.',
    type: 'A2MCP',
    payment: { mode: payment.mode, network: payment.network, payTo: payment.payTo },
    tools: [
      { name: 'verify_agent', method: 'POST /tools/verify_agent', price: payment.prices['POST /tools/verify_agent'], desc: 'Verify an AI agent identity (ERC-8004 / KYA status).' },
      { name: 'reputation_score', method: 'POST /tools/reputation_score', price: payment.prices['POST /tools/reputation_score'], desc: 'On-chain 0-1000 reputation score for an agent.' },
      { name: 'risk_check', method: 'POST /tools/risk_check', price: payment.prices['POST /tools/risk_check'], desc: 'Pre-transaction counterparty risk: ALLOW / WARN / DENY.' },
      { name: 'agent_passport', method: 'POST /tools/agent_passport', price: payment.prices['POST /tools/agent_passport'], desc: 'Full agent passport (identity + reputation + KYA + risk).' },
    ],
    docs: 'https://a-identity.xyz',
  }
}

async function main() {
  await initState()

  const app = express()
  app.use(express.json())

  // Free discovery endpoints — never charged (payment middleware only guards POST /tools/*).
  const health = (payment: PaymentStatus) => (_req: Request, res: Response) =>
    res.json({ ok: true, ...serviceCard(payment), paymentReason: payment.reason })

  // Register the OKX x402 middleware (paid mode iff creds present) BEFORE the tool routes.
  const payment = await applyOkxX402(app)

  app.get('/health', health(payment))
  app.get('/', health(payment))

  // The four paid tools.
  app.post('/tools/verify_agent', handle(async (req) => {
    const v = requireAgentId(req); if ('error' in v) return v
    return verifyAgent(v.agentId)
  }))
  app.post('/tools/reputation_score', handle(async (req) => {
    const v = requireAgentId(req); if ('error' in v) return v
    return reputationScore(v.agentId)
  }))
  app.post('/tools/risk_check', handle(async (req) => {
    const v = requireAgentId(req); if ('error' in v) return v
    const txContext = (req.body?.txContext ?? req.body?.tx_context ?? null) as TxContext | null
    return riskCheck(v.agentId, txContext)
  }))
  app.post('/tools/agent_passport', handle(async (req) => {
    const v = requireAgentId(req); if ('error' in v) return v
    return agentPassport(v.agentId)
  }))

  app.listen(PORT, () => {
    console.log(`[asp-gateway] ${SERVICE} listening on :${PORT}`)
    console.log(`[asp-gateway] payment: ${payment.mode} (${payment.reason})`)
  })
}

main().catch((e) => {
  console.error('[asp-gateway] fatal:', e)
  process.exit(1)
})
