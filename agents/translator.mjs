/**
 * A-Identity marketplace worker: a verified translation agent.
 *
 * It dogfoods @a-identity/marketplace-sdk end-to-end: signs in with its wallet, registers +
 * passes KYA (so it is hireable), then polls for funded tasks and delivers a translation for
 * each. The translation is done by Claude when ANTHROPIC_API_KEY is set (the official SDK,
 * loaded lazily so the worker runs with no key), else a deterministic stub - so the demo works
 * keyless, mirroring the whole repo's credential-gating pattern.
 *
 * Run:  node agents/translator.mjs
 * Env:  BASE (backend origin), WORKER_KEY (0x private key; a fresh one is generated if unset),
 *       ANTHROPIC_API_KEY (optional; real translation), WORKER_POLL_MS (default 5000),
 *       WORKER_MAX_CYCLES (default Infinity; set for a bounded run).
 */
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { MarketplaceClient } from '../sdk/dist/index.js'

const TRANSLATION_MODEL = 'claude-opus-4-8'

/**
 * Translate an instruction. With ANTHROPIC_API_KEY: Claude (the official SDK, loaded lazily so
 * the worker has no hard dependency on it). Without: a deterministic stub, clearly labeled.
 */
export async function translate(instruction, env = process.env) {
  const text = String(instruction ?? '').slice(0, 4000)
  if (!env.ANTHROPIC_API_KEY) {
    return `[stub translation - set ANTHROPIC_API_KEY for a real one] ${text}`
  }
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic()
  const msg = await client.messages.create({
    model: TRANSLATION_MODEL,
    max_tokens: 4096,
    system:
      'You are a professional translator. Do exactly what the request asks (translate the given ' +
      'text to the requested language). Output ONLY the translation, with no preamble or notes.',
    messages: [{ role: 'user', content: text }],
  })
  const out = msg.content.find((b) => b.type === 'text')
  return out?.text?.trim() || `[no translation produced] ${text}`
}

/**
 * Process every currently-funded task assigned to this agent: translate + deliver. Returns the
 * number delivered. Pure over its (mp, agentId) inputs, so it is drivable from a test.
 */
export async function processFundedTasks(mp, agentId, env = process.env) {
  const { tasks } = await mp.agentJobs(agentId)
  const funded = (tasks ?? []).filter((t) => t.status === 'funded')
  for (const task of funded) {
    const result = await translate(task.description || `Translate: ${task.service}`, env)
    await mp.deliver(task.id, result)
    console.error(`[translator] delivered task ${task.id}`)
  }
  return funded.length
}

/** Register this worker (owner + agent wallet are the same key) and pass KYA so it's hireable. */
export async function registerWorker(mp, account) {
  const sign = (m) => account.signMessage({ message: m })
  const reg = await mp.registerAndVerify({
    name: 'Lingua (translation worker)',
    description: 'An autonomous translation worker agent on the A-Identity marketplace.',
    category: 'Translation',
    capabilities: ['translation'],
    services: [{ name: 'translation', priceUsd: 2, unit: 'per doc' }],
    walletAddress: account.address,
    endpoint: process.env.WORKER_ENDPOINT,
    signMessage: sign,
  })
  return reg
}

async function main() {
  const base = process.env.BASE ?? 'https://a-identity-backend.onrender.com'
  const key = process.env.WORKER_KEY ?? generatePrivateKey()
  const account = privateKeyToAccount(key)
  const pollMs = Number(process.env.WORKER_POLL_MS ?? 5000)
  const maxCycles = Number(process.env.WORKER_MAX_CYCLES ?? Infinity)

  console.error(`[translator] worker wallet ${account.address}`)
  console.error(`[translator] backend ${base}`)
  console.error(`[translator] translation: ${process.env.ANTHROPIC_API_KEY ? `Claude (${TRANSLATION_MODEL})` : 'stub (no ANTHROPIC_API_KEY)'}`)

  const mp = await MarketplaceClient.withWallet({ baseUrl: base, address: account.address, signMessage: (m) => account.signMessage({ message: m }) })
  const reg = await registerWorker(mp, account)
  const agentId = reg.agent.id
  console.error(`[translator] registered + verified as ${agentId}. Waiting for tasks...`)

  let cycles = 0
  // A minimal sleep that also doesn't hard-block: resolve after pollMs.
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  while (cycles < maxCycles) {
    try {
      const done = await processFundedTasks(mp, agentId)
      if (done > 0) console.error(`[translator] processed ${done} task(s) this cycle`)
    } catch (e) {
      console.error('[translator] cycle error:', e?.message ?? e)
    }
    cycles += 1
    if (cycles < maxCycles) await sleep(pollMs)
  }
  console.error(`[translator] done after ${cycles} cycle(s)`)
}

// Run the poll loop only when invoked directly (not when imported by a test).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error('[translator] fatal:', e)
    process.exit(1)
  })
}
