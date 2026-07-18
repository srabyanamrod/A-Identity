#!/usr/bin/env node
/**
 * On-chain integration test for the REAL ERC-4337 session key (idea C2), against Arc
 * testnet via the Pimlico bundler. Deploys a Kernel smart account, grants a session key
 * scoped to {cap, payee allowlist, expiry}, and proves the session key settles a payment
 * WITHIN bounds (a real UserOp) while a payment OUTSIDE bounds is rejected by the on-chain
 * policy validator — bounded authority on the standard AA primitive.
 *
 * Run:  node --env-file=.env scripts/test-aa-session.mjs
 *       (needs PIMLICO_API_KEY + a funded ARC_SIGNER_KEY)
 */
import { runSessionKeyDemo, aaEnabled } from '../dist/aa-wallet.js'

let pass = 0, fail = 0
const ok = (name, cond, extra = '') => { console.log(`${cond ? '✓' : '✗'} ${name}${extra ? `  — ${extra}` : ''}`); cond ? pass++ : fail++ }

console.log('aaEnabled:', aaEnabled(), '\n')
const res = await runSessionKeyDemo({ capUsd: 0.05 })
ok('session-key demo executed', res.executed === true, res.executed ? '' : res.reason)
if (!res.executed) process.exit(1)

console.log('   SCA        :', res.sca)
console.log('   session key:', res.sessionKey)
console.log('   scoped to  : cap $' + res.scopedTo.capUsd + ', allowlist ' + res.scopedTo.allowlist.slice(0, 10) + '…, expires ' + new Date(res.scopedTo.expiresAt * 1000).toISOString())
if (res.funded) console.log('   funded SCA :', res.funded.amountUsd, 'native USDC')
for (const a of res.attempts) console.log(`   • ${a.label}: ${a.settled ? 'SETTLED ' + (a.explorerUrl ?? '') : 'REJECTED (' + (a.rejectedReason ?? '') + ')'}`)

const inb = res.attempts.find((a) => a.label.startsWith('in-bounds'))
const oob = res.attempts.find((a) => a.label.startsWith('out-of-bounds'))
ok('the smart account address is deterministic (0x…)', /^0x[0-9a-fA-F]{40}$/.test(res.sca), res.sca)
ok('the session key is a distinct signer', /^0x[0-9a-fA-F]{40}$/.test(res.sessionKey) && res.sessionKey !== res.scopedTo.allowlist)
ok('IN-BOUNDS payment settled via a real UserOp', !!inb && inb.settled === true && !!inb.txHash, inb?.txHash)
ok('OUT-OF-BOUNDS payment was REJECTED by the on-chain policy', !!oob && oob.settled === false, oob?.rejectedReason)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
