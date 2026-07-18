#!/usr/bin/env node
/**
 * On-chain integration test for the Trust Oracle dogfood, against real Arc testnet.
 * A buyer agent pays ~$0.005 over x402 (a gasless Arc nanopayment via Circle Gateway)
 * and, once the payment settles, receives an ALLOW/WARN/DENY verdict on a counterparty —
 * the live "agent pays an agent for trust" loop, the consumer side of the same Trust
 * Oracle we list on Circle's Agent Marketplace.
 *
 * Run:  node --env-file=.env scripts/test-dogfood.mjs   (needs a funded ARC_SIGNER_KEY)
 */
import { runTrustOracleDogfood } from '../dist/trust-oracle.js'
import { privateKeyToAccount } from 'viem/accounts'

const signer = privateKeyToAccount(process.env.ARC_SIGNER_KEY).address
let pass = 0, fail = 0
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? `  — ${extra}` : ''}`)
  cond ? pass++ : fail++
}

console.log('buyer agent (signer):', signer, '\n')

// Buy a risk_check on the live ERC-8004 showcase agent Meridian (#849980) before transacting.
const res = await runTrustOracleDogfood({ agentId: '#849980', txContext: { amountUsd: 25, kind: 'payment' } })
ok('dogfood executed (payment + verdict)', res.executed === true, res.executed ? '' : res.reason)
if (!res.executed) process.exit(1)

console.log('   paid     :', res.payment.amountUsd, 'USDC over', res.payment.rail, 'on', res.payment.network)
console.log('   settle tx:', res.payment.explorerUrl ?? res.payment.transaction ?? '(batched, no direct hash)')
console.log('   verdict  :', res.riskCheck.decision, `(risk: ${res.riskCheck.risk})`)
console.log('   reasons  :', res.riskCheck.reasons.join(' | '))

ok('x402 nanopayment produced an authorization', !!res.payment.authorization?.from)
ok('the buyer paid a DISTINCT seller (no self-transfer)', res.payTo.toLowerCase() !== signer.toLowerCase(), res.payTo)
ok('a risk verdict was served after payment', ['ALLOW', 'WARN', 'DENY'].includes(res.riskCheck.decision), res.riskCheck.decision)
ok('the verdict names the counterparty', typeof res.riskCheck.agentId === 'string' && res.riskCheck.agentId.length > 0, res.riskCheck.agentId)
ok('reasons are always non-empty', Array.isArray(res.riskCheck.reasons) && res.riskCheck.reasons.length > 0)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
