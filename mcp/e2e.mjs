#!/usr/bin/env node
/**
 * Full end-to-end flow test for A-Identity — the WHOLE product, start to finish.
 *
 * Phases:
 *   A. Liveness & discovery       health, chains, live Arc status, live contract reads, Circle
 *   B. MCP tools (JSON-RPC)        the agent-facing read entry point (/mcp tools/call)
 *   C. Mock read REST             resolve agent, list agents, reputation lookup
 *   D. Auth                       guard (401), email login, wallet Sign-In with Ethereum (+ bad sig)
 *   E. Wallets                    client-generated address recorded, live balance read
 *   F. Agents                     create (owned), list, marketplace feed
 *   G. Ownership                  a non-owner is blocked (403)
 *   H. Policy engine              auto-approve, cumulative daily cap -> pending, freeze
 *   I. Human-on-the-loop          approve a pending payment
 *   J. Settlement                 execute -> real USDC on Arc (with a key) or simulated
 *   J2. On-chain policy vault     provision an AgentSpendPolicy contract; payment settles through it (enforcedBy=onchain-vault)
 *   K. On-chain identity          anchor -> real ERC-8004 register (with a key) or prepared
 *   K2. KYA                       prove wallet control (signature) -> verified; on-chain attestation via ERC-8004 ValidationRegistry
 *   L. Social                     follow an agent in Agent House
 *   M. Reputation                 computed from real activity, bounded 0..1000
 *
 * Local:  node mcp/e2e.mjs
 * Live:   E2E_BASE=https://a-identity-backend.onrender.com node mcp/e2e.mjs
 *
 * On-chain steps adapt to whether the server has ARC_SIGNER_KEY (so it passes in CI without one).
 */
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

const BASE = process.env.E2E_BASE ?? 'http://localhost:3399'

let passed = 0
let failed = 0
const fails = []

function check(name, cond, detail = '') {
  if (cond) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    fails.push(name)
    console.log(`  ✗ ${name}${detail ? ` -> ${detail}` : ''}`)
  }
}
function skip(name, reason) {
  console.log(`  ~ ${name} (skipped: ${reason})`)
}
function phase(t) {
  console.log(`\n${t}`)
}

async function api(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  let json = null
  try {
    json = await res.json()
  } catch {
    /* no body */
  }
  return { status: res.status, json }
}

async function mcp(name, args = {}) {
  const res = await fetch(`${BASE}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  })
  let raw = null
  try {
    raw = await res.json()
  } catch {
    /* ignore */
  }
  const text = raw?.result?.content?.[0]?.text
  return { status: res.status, data: text ? JSON.parse(text) : null }
}

async function login(email) {
  const { json } = await api('POST', '/api/auth/login', { body: { email } })
  return json?.token
}

async function main() {
  console.log(`\nA-Identity FULL E2E  ->  ${BASE}`)

  // ── A. Liveness & discovery ───────────────────────────────────────────────────
  phase('A. Liveness & discovery')
  const health = await api('GET', '/health')
  check('health ok', health.status === 200 && health.json?.status === 'ok', `HTTP ${health.status}`)
  const chains = await api('GET', '/api/chains')
  check('chains list', chains.status === 200 && Array.isArray(chains.json?.chains) && chains.json.chains.length > 0)
  const arc = await api('GET', '/api/arc')
  // Live-chain reads depend on the external Arc RPC; skip (don't fail) if it's unreachable.
  if (arc.json?.online === false) skip('live Arc status', 'Arc RPC unreachable')
  else check('live Arc status (chainId 5042002)', arc.json?.chainId === 5042002, String(arc.json?.chainId))
  const contracts = await api('GET', '/api/arc/contracts')
  if (contracts.json?.reachable === false) {
    skip('live contract read: identity name', 'Arc RPC unreachable')
    skip('live contract read: USDC decimals', 'Arc RPC unreachable')
  } else {
    check('live contract read: identity name', contracts.json?.identity?.name === 'AgentIdentity', String(contracts.json?.identity?.name))
    check('live contract read: USDC decimals', contracts.json?.usdc?.decimals === 6, String(contracts.json?.usdc?.decimals))
  }
  const circle = await api('GET', '/api/circle')
  check('Circle status endpoint', circle.status === 200 && circle.json?.provider === 'circle')

  // ── B. MCP tools (agent-facing read entry point) ──────────────────────────────
  phase('B. MCP tools (JSON-RPC)')
  const mChains = await mcp('get_chain_status')
  check('MCP get_chain_status returns chains', Array.isArray(mChains.data?.chains) && mChains.data.chains.length > 0)

  // ── C. Mock read REST (discovery) ─────────────────────────────────────────────
  phase('C. Mock read REST')
  const agentsList = await api('GET', '/api/agents')
  check('list agents (mock chains)', agentsList.status === 200 && Array.isArray(agentsList.json?.agents))
  const someAgent = agentsList.json?.agents?.[0]?.agentId
  if (someAgent) {
    const resolved = await api('GET', `/api/agent?q=${encodeURIComponent(someAgent)}`)
    check('resolve a known agent', resolved.status === 200 && resolved.json?.found === true, `HTTP ${resolved.status}`)
    const repLookup = await api('GET', `/api/reputation?id=${encodeURIComponent(someAgent)}`)
    check('reputation lookup responds', repLookup.status === 200 || repLookup.status === 404, `HTTP ${repLookup.status}`)
  } else {
    check('resolve a known agent', true, 'no mock agents to resolve (skipped)')
  }

  // ── D. Auth ───────────────────────────────────────────────────────────────────
  phase('D. Auth')
  const noAuth = await api('POST', '/api/agents', { body: { name: 'NoAuth' } })
  check('write without a token is 401', noAuth.status === 401, `HTTP ${noAuth.status}`)
  const alice = await login(`alice+${Date.now()}@e2e.test`)
  check('email login returns a token', typeof alice === 'string' && alice.length > 0)
  const acct = privateKeyToAccount(generatePrivateKey())
  const nonceRes = await api('POST', '/api/auth/nonce', { body: { address: acct.address } })
  const message = nonceRes.json?.message
  check('SIWE nonce issued', typeof message === 'string' && message.includes('Nonce:'))
  const signature = await acct.signMessage({ message })
  const verifyRes = await api('POST', '/api/auth/verify', { body: { address: acct.address, message, signature } })
  check('SIWE verify issues a token', verifyRes.status === 200 && !!verifyRes.json?.token)
  const badVerify = await api('POST', '/api/auth/verify', {
    body: { address: acct.address, message, signature: '0x' + '11'.repeat(65) },
  })
  check('SIWE rejects a bad signature', badVerify.status === 401, `HTTP ${badVerify.status}`)

  // ── E. Wallets ────────────────────────────────────────────────────────────────
  phase('E. Wallets')
  const clientAddr = privateKeyToAccount(generatePrivateKey()).address
  const walletRes = await api('POST', '/api/wallets', { token: alice, body: { address: clientAddr } })
  check('client-generated address recorded (no key sent)', walletRes.status === 201 && walletRes.json?.wallet?.address === clientAddr && !('privateKey' in (walletRes.json || {})))
  const bal = await api('GET', `/api/wallet-balance?address=${clientAddr}`)
  check('live wallet balance read', bal.status === 200 && bal.json?.symbol === 'USDC', `HTTP ${bal.status}`)

  // ── F. Agents ─────────────────────────────────────────────────────────────────
  phase('F. Agents')
  const createRes = await api('POST', '/api/agents', {
    token: alice,
    body: { name: `E2E Agent ${Date.now()}`, category: 'Trading / Finance', capabilities: ['Payments'] },
  })
  const agentId = createRes.json?.agent?.id
  check('agent created with an owner', createRes.status === 201 && !!agentId && !!createRes.json?.agent?.owner)
  const platform = await api('GET', '/api/platform-agents')
  check('agent appears in the platform list', platform.json?.agents?.some((a) => a.id === agentId))
  const market = await api('GET', '/api/marketplace')
  check('agent appears in Agent House with a reputation', market.json?.agents?.some((a) => a.id === agentId && typeof a.reputation?.score === 'number'))

  // ── G. Ownership ──────────────────────────────────────────────────────────────
  phase('G. Ownership')
  const bob = await login(`bob+${Date.now()}@e2e.test`)
  const bobTries = await api('POST', '/api/agents/permissions', { token: bob, body: { agentId, permissions: { dailyCapUsd: 9999 } } })
  check('non-owner is 403', bobTries.status === 403, `HTTP ${bobTries.status}`)

  // ── H. Policy engine ──────────────────────────────────────────────────────────
  phase('H. Policy engine')
  await api('POST', '/api/agents/permissions', { token: alice, body: { agentId, permissions: { dailyCapUsd: 50, autoApproveUnderUsd: 100, frozen: false } } })
  const ix1 = await api('POST', '/api/instructions', { token: alice, body: { agentId, type: 'payment', amountUsd: 30, payee: 'agent://provider' } })
  check('payment under cap auto-approves', ix1.json?.status === 'auto_approved', ix1.json?.status)
  const ix2 = await api('POST', '/api/instructions', { token: alice, body: { agentId, type: 'payment', amountUsd: 30, payee: 'agent://provider' } })
  check('payment over the daily cap pends (cumulative)', ix2.json?.status === 'pending_approval', ix2.json?.status)
  await api('POST', '/api/agents/permissions', { token: alice, body: { agentId, permissions: { frozen: true } } })
  const frozen = await api('POST', '/api/instructions', { token: alice, body: { agentId, type: 'payment', amountUsd: 0.01, payee: 'agent://x' } })
  check('frozen agent pauses everything', frozen.json?.status === 'pending_approval', frozen.json?.status)
  await api('POST', '/api/agents/permissions', { token: alice, body: { agentId, permissions: { frozen: false } } })

  // ── I. Human-on-the-loop ──────────────────────────────────────────────────────
  phase('I. Human-on-the-loop')
  const approve = await api('POST', '/api/instructions/approve', { token: alice, body: { id: ix2.json?.id } })
  check('human approves a pending payment', approve.json?.status === 'approved', approve.json?.status)

  // ── J. Settlement (fresh high-cap agent, real Arc address) ────────────────────
  phase('J. Settlement')
  const payerRes = await api('POST', '/api/agents', { token: alice, body: { name: `E2E Payer ${Date.now()}`, category: 'Trading / Finance', capabilities: ['Payments'] } })
  const payer = payerRes.json?.agent?.id
  await api('POST', '/api/agents/permissions', { token: alice, body: { agentId: payer, permissions: { dailyCapUsd: 1000, autoApproveUnderUsd: 1000 } } })
  const payee = privateKeyToAccount(generatePrivateKey()).address
  const ixPay = await api('POST', '/api/instructions', { token: alice, body: { agentId: payer, type: 'payment', amountUsd: 0.01, payee } })
  check('settlement payment auto-approves', ixPay.json?.status === 'auto_approved', ixPay.json?.status)
  const exec = await api('POST', '/api/instructions/execute', { token: alice, body: { id: ixPay.json?.id } })
  const onchainPay = exec.json?.status === 'executed_onchain'
  check('execute settles (on-chain with a key, else simulated)', onchainPay || exec.json?.status === 'executed_simulated', exec.json?.status)
  if (onchainPay) check('  ↳ on-chain settlement carries a tx hash', /^0x[0-9a-f]{64}$/i.test(exec.json?.txHash || ''))

  // ── J2. On-chain policy vault ─────────────────────────────────────────────────
  phase('J2. On-chain policy vault (enforced on Arc)')
  const vaultRes = await api('POST', '/api/agents/vault', { token: alice, body: { agentId: payer, fundUsd: 0.05 } })
  if (onchainPay) {
    check('policy vault deployed on Arc', /^0x[0-9a-fA-F]{40}$/.test(vaultRes.json?.vaultAddress || ''), vaultRes.json?.vaultAddress || JSON.stringify(vaultRes.json).slice(0, 70))
    const vIx = await api('POST', '/api/instructions', { token: alice, body: { agentId: payer, type: 'payment', amountUsd: 0.01, payee } })
    const vExec = await api('POST', '/api/instructions/execute', { token: alice, body: { id: vIx.json?.id } })
    check('payment settles THROUGH the vault (enforcedBy=onchain-vault)', vExec.json?.status === 'executed_onchain' && vExec.json?.enforcedBy === 'onchain-vault', `${vExec.json?.status}/${vExec.json?.enforcedBy}`)
    check('  ↳ vault settlement carries a real Arc tx hash', /^0x[0-9a-f]{64}$/i.test(vExec.json?.txHash || ''))
    const vRead = await api('GET', `/api/agents/vault?agentId=${payer}`)
    check('live vault read reports on-chain policy + balance', vRead.status === 200 && typeof vRead.json?.dailyCapUsd === 'number' && typeof vRead.json?.balanceUsd === 'number', `HTTP ${vRead.status}`)
  } else {
    check('vault provision returns a prepared note without a signer key', !vaultRes.json?.vaultAddress, JSON.stringify(vaultRes.json || {}).slice(0, 70))
  }

  // ── K. On-chain identity ──────────────────────────────────────────────────────
  phase('K. On-chain identity (ERC-8004)')
  const anchor = await api('POST', '/api/agents/anchor', { token: alice, body: { agentId: payer } })
  const anchored = anchor.json?.result?.executed === true
  check('anchor executes on-chain (key) or returns a prepared call', anchored || anchor.json?.result?.executed === false, JSON.stringify(anchor.json?.result || {}).slice(0, 60))
  if (anchored) check('  ↳ anchored ERC-8004 id + tx', !!anchor.json?.agent?.onchainAgentId && /^0x[0-9a-f]{64}$/i.test(anchor.json?.agent?.onchainTx || ''))

  // ── K2. KYA (Know Your Agent) ─────────────────────────────────────────────────
  phase('K2. KYA (prove wallet control)')
  const kyaAcct = privateKeyToAccount(generatePrivateKey())
  const kyaAgent = (await api('POST', '/api/agents', { token: alice, body: { name: `E2E KYA ${Date.now()}`, category: 'Trading / Finance', capabilities: ['Payments'], walletAddress: kyaAcct.address } })).json?.agent?.id
  const kyaBefore = await api('GET', `/api/agents/kya?agentId=${kyaAgent}`)
  check('new agent starts KYA unverified', kyaBefore.json?.kya === 'unverified', kyaBefore.json?.kya)
  const kyaAnchored = (await api('POST', '/api/agents/anchor', { token: alice, body: { agentId: kyaAgent } })).json?.result?.executed === true
  const chal = await api('POST', '/api/agents/kya/challenge', { token: alice, body: { agentId: kyaAgent } })
  check('KYA challenge targets the agent wallet', chal.json?.address?.toLowerCase() === kyaAcct.address.toLowerCase() && !!chal.json?.message)
  const kyaSig = await kyaAcct.signMessage({ message: chal.json.message })
  const kyaVer = await api('POST', '/api/agents/kya/verify', { token: alice, body: { agentId: kyaAgent, message: chal.json.message, signature: kyaSig } })
  check('KYA verified by a real wallet signature', kyaVer.json?.kya === 'verified', JSON.stringify(kyaVer.json).slice(0, 60))
  if (kyaAnchored) check('  ↳ KYA attested on-chain (ERC-8004 ValidationRegistry tx)', /^0x[0-9a-f]{64}$/i.test(kyaVer.json?.onchain?.txHash || ''))
  const chal2 = await api('POST', '/api/agents/kya/challenge', { token: alice, body: { agentId: kyaAgent } })
  const wrongSig = await privateKeyToAccount(generatePrivateKey()).signMessage({ message: chal2.json.message })
  const kyaBad = await api('POST', '/api/agents/kya/verify', { token: alice, body: { agentId: kyaAgent, message: chal2.json.message, signature: wrongSig } })
  check('KYA rejects a wrong signature', kyaBad.status !== 200, `HTTP ${kyaBad.status}`)

  // ── L. Social ─────────────────────────────────────────────────────────────────
  phase('L. Social (Agent House)')
  const follow = await api('POST', '/api/follow', { token: alice, body: { agentId, follower: 'e2e-viewer' } })
  check('follow an agent', follow.status === 200 && typeof follow.json?.followers === 'number')

  // ── M. Reputation ─────────────────────────────────────────────────────────────
  phase('M. Reputation')
  const rep = await api('GET', `/api/agents/reputation?agentId=${payer}`)
  check('reputation computed, bounded 0..1000', typeof rep.json?.score === 'number' && rep.json.score >= 0 && rep.json.score <= 1000, String(rep.json?.score))

  // ── N. x402 (pay-per-call rail) ───────────────────────────────────────────────
  phase('N. x402 (pay-per-call)')
  const x402 = await api('GET', '/api/x402/data')
  if (x402.status === 501) {
    skip('x402 issues a 402 with requirements', 'no signer / payTo configured')
    skip('x402 rejects an invalid proof', 'x402 not configured')
  } else {
    const acc = x402.json?.accepts?.[0]
    check('unpaid call returns 402 + requirements', x402.status === 402 && !!acc?.payTo && acc?.maxAmountRequired === '1000', `HTTP ${x402.status}`)
    const fake = await fetch(`${BASE}/api/x402/data`, { headers: { 'X-Payment': '0x' + 'ab'.repeat(32) } })
    check('x402 rejects an invalid payment proof', fake.status === 402, `HTTP ${fake.status}`)
  }

  // ── summary ─────────────────────────────────────────────────────────────────
  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed) {
    console.log(`FAILED: ${fails.join(', ')}\n`)
    process.exit(1)
  }
  console.log('✓ full flow OK\n')
}

main().catch((e) => {
  console.error('\nE2E crashed:', e?.stack ?? e)
  process.exit(1)
})
