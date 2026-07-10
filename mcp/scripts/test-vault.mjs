#!/usr/bin/env node
/**
 * On-chain integration test for the AgentSpendPolicy vault, against real Arc
 * testnet. Deploys a vault, funds it, and proves every policy gate is enforced
 * ON-CHAIN (real tx hashes; rejects revert via simulate, costing no gas).
 * Payments cycle back to the signer and the remainder is withdrawn, so only gas
 * is spent.
 *
 * Run:  node --env-file=.env scripts/test-vault.mjs   (needs a funded ARC_SIGNER_KEY)
 */
import {
  deployPolicyVault, payUsdcOnchain, policyPay, policyOwnerPay,
  policySetFrozen, readPolicyVault, policyWithdraw,
} from '../dist/arc-contracts.js'
import { privateKeyToAccount } from 'viem/accounts'

const signer = privateKeyToAccount(process.env.ARC_SIGNER_KEY).address
let pass = 0, fail = 0
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? `  — ${extra}` : ''}`)
  cond ? pass++ : fail++
}

console.log('signer / owner / operator:', signer, '\n')

// 1. Deploy: daily cap $5, auto-approve ceiling $1.
const dep = await deployPolicyVault({ dailyCapUsd: 5, autoApproveUsd: 1 })
ok('deploy vault', dep.executed === true, dep.executed ? dep.vault : dep.reason)
if (!dep.executed) process.exit(1)
const vault = dep.vault
console.log('   vault:', dep.explorerUrl)

// 2. Fund the vault with $6 USDC.
const fund = await payUsdcOnchain(vault, 6)
ok('fund vault with $6 USDC', fund.executed === true, fund.executed ? fund.txHash : fund.reason)

// 3. Agent pays $0.50 — under the $1 ceiling, under the cap -> settles on-chain.
const p1 = await policyPay(vault, signer, 0.5)
ok('pay $0.50 settles on-chain', p1.executed === true, p1.executed ? p1.txHash : p1.reason)

// 4. Agent pays $3 — above the $1 auto-approve ceiling -> reverts on-chain.
const p2 = await policyPay(vault, signer, 3)
ok('pay $3 reverts AboveAutoApprove', p2.executed === false && p2.reverted === true && p2.reason === 'AboveAutoApprove', p2.reason)

// 5. Owner settles the $3 the human approved -> succeeds (override).
const p3 = await policyOwnerPay(vault, signer, 3)
ok('ownerPay $3 settles (human override)', p3.executed === true, p3.executed ? p3.txHash : p3.reason)

// 6. Owner freezes -> the agent cannot spend at all.
const fz = await policySetFrozen(vault, true)
ok('setFrozen(true)', fz.executed === true, fz.executed ? fz.txHash : fz.reason)
const p4 = await policyPay(vault, signer, 0.5)
ok('pay reverts IsFrozen while frozen', p4.executed === false && p4.reason === 'IsFrozen', p4.reason)
await policySetFrozen(vault, false)

// 7. Daily cap: spent so far $0.50 + $3.00 = $3.50. A $1 pay -> $4.50 (ok);
//    another $1 -> $5.50 > $5 cap -> reverts.
const p5 = await policyPay(vault, signer, 1)
ok('pay $1 settles (cumulative $4.50 <= $5 cap)', p5.executed === true, p5.executed ? p5.txHash : p5.reason)
const p6 = await policyPay(vault, signer, 1)
ok('pay $1 reverts DailyCapExceeded ($4.50 + $1 > $5)', p6.executed === false && p6.reason === 'DailyCapExceeded', p6.reason)

// 8. Read the live on-chain state.
const st = await readPolicyVault(vault)
console.log('\nvault state:', JSON.stringify(st, null, 2), '\n')
ok('spentToday == $4.50', Math.abs(st.spentTodayUsd - 4.5) < 1e-6, `$${st.spentTodayUsd}`)
ok('cap $5 / auto-approve $1 on-chain', st.dailyCapUsd === 5 && st.autoApproveUsd === 1)

// 9. Recover the remaining balance to the signer.
const w = await policyWithdraw(vault, signer, st.balanceUsd)
ok('withdraw remaining to signer', w.executed === true, w.executed ? w.txHash : w.reason)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
