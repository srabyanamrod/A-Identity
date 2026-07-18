/** Unit tests for the tokenURI SSRF guard — pure, offline. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isSafePublicHttpUrl } from './erc8004.js'

test('allows ordinary public http(s) URLs', () => {
  assert.equal(isSafePublicHttpUrl('https://example.com/agent.json'), true)
  assert.equal(isSafePublicHttpUrl('http://a-identity.xyz/meta'), true)
  assert.equal(isSafePublicHttpUrl('https://1.2.3.4/x'), true) // a public literal IP
})

test('blocks loopback, private ranges, and cloud metadata (SSRF)', () => {
  assert.equal(isSafePublicHttpUrl('http://169.254.169.254/latest/meta-data/'), false)
  assert.equal(isSafePublicHttpUrl('http://localhost:8545/'), false)
  assert.equal(isSafePublicHttpUrl('http://127.0.0.1/'), false)
  assert.equal(isSafePublicHttpUrl('http://10.0.0.5/'), false)
  assert.equal(isSafePublicHttpUrl('http://192.168.1.1/'), false)
  assert.equal(isSafePublicHttpUrl('http://172.16.0.1/'), false)
  assert.equal(isSafePublicHttpUrl('http://[::1]/'), false)
  assert.equal(isSafePublicHttpUrl('http://vault.internal/'), false)
})

test('blocks non-http(s) schemes and garbage', () => {
  assert.equal(isSafePublicHttpUrl('file:///etc/passwd'), false)
  assert.equal(isSafePublicHttpUrl('ftp://example.com/'), false)
  assert.equal(isSafePublicHttpUrl('data:application/json,{}'), false)
  assert.equal(isSafePublicHttpUrl('not a url'), false)
})
