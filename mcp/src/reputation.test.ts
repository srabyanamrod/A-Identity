import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeAgentReputation } from './reputation.js'

// Tests the SAME function production uses (platform.ts repOf delegates to it).
const asOf = new Date('2026-07-10T00:00:00Z')

test('same input + asOf is deterministic', () => {
  const s = { settledCount: 20, rejected: 5, onchainRegistered: true, createdAt: '2026-01-01' }
  assert.deepEqual(computeAgentReputation(s, asOf), computeAgentReputation(s, asOf))
})

test('score is bounded 0..1000', () => {
  const r = computeAgentReputation(
    { settledCount: 100000, rejected: 0, onchainRegistered: true, createdAt: '2020-01-01' },
    asOf,
  )
  assert.ok(r.score >= 0 && r.score <= 1000, `score out of range: ${r.score}`)
})

test('more settled actions => higher settlement score', () => {
  const low = computeAgentReputation({ settledCount: 2, rejected: 0, onchainRegistered: false, createdAt: '2026-07-01' }, asOf)
  const high = computeAgentReputation({ settledCount: 40, rejected: 0, onchainRegistered: false, createdAt: '2026-07-01' }, asOf)
  assert.ok(high.breakdown.settlement > low.breakdown.settlement)
})

test('a verified on-chain identity adds a settlement credit', () => {
  const off = computeAgentReputation({ settledCount: 1, rejected: 0, onchainRegistered: false, createdAt: '2026-07-01' }, asOf)
  const on = computeAgentReputation({ settledCount: 1, rejected: 0, onchainRegistered: true, createdAt: '2026-07-01' }, asOf)
  assert.ok(on.breakdown.settlement > off.breakdown.settlement)
})

test('rejections lower the validation score', () => {
  const clean = computeAgentReputation({ settledCount: 10, rejected: 0, onchainRegistered: false, createdAt: '2026-07-01' }, asOf)
  const rejected = computeAgentReputation({ settledCount: 10, rejected: 10, onchainRegistered: false, createdAt: '2026-07-01' }, asOf)
  assert.ok(rejected.breakdown.validation < clean.breakdown.validation)
})

test('a brand-new agent with no activity and no on-chain id scores 0', () => {
  const r = computeAgentReputation({ settledCount: 0, rejected: 0, onchainRegistered: false, createdAt: '2026-07-10' }, asOf)
  assert.equal(r.score, 0)
})

test('settledUsd is carried through, settledOnchain mirrors the count', () => {
  const r = computeAgentReputation({ settledCount: 3, rejected: 0, onchainRegistered: true, createdAt: '2026-07-01', settledUsd: 12.5 }, asOf)
  assert.equal(r.settledOnchain, 3)
  assert.equal(r.settledUsd, 12.5)
})

test('an unparseable createdAt yields tenure 0 and a finite score (no NaN bypass)', () => {
  // A NaN score would slip past every downstream `score < threshold` risk comparison.
  const r = computeAgentReputation({ settledCount: 0, rejected: 0, onchainRegistered: true, createdAt: 'soon' }, asOf)
  assert.ok(Number.isFinite(r.score), `score must be finite, got ${r.score}`)
  assert.equal(r.breakdown.tenure, 0)
})

test('a future createdAt never produces negative tenure', () => {
  const r = computeAgentReputation({ settledCount: 1, rejected: 0, onchainRegistered: false, createdAt: '2999-01-01' }, asOf)
  assert.equal(r.breakdown.tenure, 0)
})
