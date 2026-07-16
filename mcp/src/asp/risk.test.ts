/**
 * Unit tests for the ASP risk engine (assessRisk) — pure, offline, deterministic.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assessRisk, type RiskSignals } from './risk.js'

const strong: RiskSignals = { onchainVerified: true, kyaVerified: true, reputationScore: 720, tenureDays: 90 }

test('ALLOW: verified identity + KYA + strong reputation', () => {
  const r = assessRisk(strong)
  assert.equal(r.decision, 'ALLOW')
  assert.equal(r.risk, 'low')
  assert.ok(r.reasons.length >= 1)
})

test('DENY: no on-chain identity', () => {
  const r = assessRisk({ ...strong, onchainVerified: false })
  assert.equal(r.decision, 'DENY')
  assert.equal(r.risk, 'high')
  assert.ok(r.reasons.some((x) => /on-chain identity/i.test(x)))
})

test('DENY: reputation below the safe floor', () => {
  const r = assessRisk({ ...strong, reputationScore: 150 })
  assert.equal(r.decision, 'DENY')
  assert.ok(r.reasons.some((x) => /below the safe threshold/i.test(x)))
})

test('DENY: high-value tx to a low-reputation agent', () => {
  const r = assessRisk({ ...strong, reputationScore: 300 }, { amountUsd: 500 })
  assert.equal(r.decision, 'DENY')
  assert.ok(r.reasons.some((x) => /High-value transaction/i.test(x)))
})

test('WARN: KYA not attested (identity still verified)', () => {
  const r = assessRisk({ ...strong, kyaVerified: false })
  assert.equal(r.decision, 'WARN')
  assert.equal(r.risk, 'medium')
  assert.ok(r.reasons.some((x) => /KYA/i.test(x)))
})

test('WARN: moderate reputation', () => {
  const r = assessRisk({ ...strong, reputationScore: 350 })
  assert.equal(r.decision, 'WARN')
  assert.ok(r.reasons.some((x) => /Moderate reputation/i.test(x)))
})

test('WARN: new agent (short tenure)', () => {
  const r = assessRisk({ ...strong, tenureDays: 2 })
  assert.equal(r.decision, 'WARN')
  assert.ok(r.reasons.some((x) => /New agent/i.test(x)))
})

test('WARN: large transaction amount even for a strong agent', () => {
  const r = assessRisk(strong, { amountUsd: 5000 })
  assert.equal(r.decision, 'WARN')
  assert.ok(r.reasons.some((x) => /Large transaction/i.test(x)))
})

test('txContext is echoed back in signals', () => {
  const ctx = { amountUsd: 42, payee: '0xabc' }
  const r = assessRisk(strong, ctx)
  assert.deepEqual(r.signals.txContext, ctx)
})

test('DENY reasons include triggered WARN reasons too', () => {
  const r = assessRisk({ onchainVerified: false, kyaVerified: false, reputationScore: 100, tenureDays: 1 })
  assert.equal(r.decision, 'DENY')
  // both deny (no identity, low rep) and warn (kya, new agent) reasons collected
  assert.ok(r.reasons.length >= 3)
})
