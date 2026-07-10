#!/usr/bin/env node
/**
 * Integration test for the Circle Agent Wallet layer. Adapts to whether Circle
 * credentials are present, exactly like the on-chain steps do:
 *
 *  - WITHOUT creds: proves the whole module no-ops cleanly (the additive/fallback
 *    guarantee) — provisioning declines, circlePay reports "unavailable" (NOT a
 *    policy rejection, so the caller falls back), reads report "not configured".
 *  - WITH creds (CIRCLE_API_KEY + CIRCLE_ENTITY_SECRET): provisions a real
 *    Developer-Controlled wallet on ARC-TESTNET, faucet-funds it, and reads live
 *    state. Set CIRCLE_TEST_RECIPIENT to also exercise a live screened transfer.
 *
 * Run:  cd mcp && node --env-file=.env scripts/test-circle.mjs
 */
import { circleEnabled, createAgentWallet, circlePay, readCircleWallet } from '../dist/circle-agent.js'

let pass = 0, fail = 0
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? `  — ${extra}` : ''}`)
  cond ? pass++ : fail++
}

const enabled = circleEnabled()
console.log('Circle configured:', enabled, '\n')

if (!enabled) {
  // ── credential-gated no-op path (this is what runs in local/CI/demo without keys) ──
  const w = await createAgentWallet({ name: 'test-agent', fund: false })
  ok('createAgentWallet declines cleanly without creds', w.provisioned === false, w.reason)

  const pay = await circlePay('fake-wallet-id', '0x0000000000000000000000000000000000000001', 0.5)
  ok(
    'circlePay is "unavailable" not "rejected" without creds (so callers fall back)',
    pay.executed === false && pay.rejected === false,
    pay.reason,
  )

  const rd = await readCircleWallet('fake-wallet-id')
  ok('readCircleWallet reports not configured without creds', rd.configured === false, rd.reason)

  console.log('\nNo Circle creds set — verified the additive no-op path.')
  console.log('Set CIRCLE_API_KEY + CIRCLE_ENTITY_SECRET in mcp/.env to exercise the live path.')
} else {
  // ── live path (real Circle Developer-Controlled wallet on ARC-TESTNET) ──
  const name = `a-identity-test-${Date.now().toString(36)}`
  const w = await createAgentWallet({ name, fund: true })
  ok('provision Circle Agent Wallet on ARC-TESTNET', w.provisioned === true, w.provisioned ? w.walletAddress : w.reason)
  if (!w.provisioned) process.exit(1)
  console.log('   wallet:', w.explorerUrl)
  console.log('   funded:', JSON.stringify(w.funded))

  const rd = await readCircleWallet(w.walletId)
  ok('read live Circle wallet state', rd.configured === true, rd.configured ? rd.state : rd.reason)
  if (rd.configured) console.log('   balances:', JSON.stringify(rd.balances))

  const recipient = process.env.CIRCLE_TEST_RECIPIENT
  if (recipient) {
    const p = await circlePay(w.walletId, recipient, 0.01)
    // Any of the three uniform outcomes is a pass; we only fail on a thrown/undefined result.
    ok(
      'circlePay returns a uniform result (executed | rejected | unavailable)',
      typeof p.executed === 'boolean',
      p.executed ? p.txHash : p.reason,
    )
  } else {
    console.log('   (set CIRCLE_TEST_RECIPIENT to also exercise a live screened transfer)')
  }
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
