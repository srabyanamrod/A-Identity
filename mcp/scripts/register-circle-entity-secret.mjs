#!/usr/bin/env node
/**
 * ONE-TIME Circle setup: generate an entity secret, register its ciphertext with
 * Circle (needs CIRCLE_API_KEY), save the recovery file, and write
 * CIRCLE_ENTITY_SECRET into mcp/.env.
 *
 *   cd mcp && node --env-file=.env scripts/register-circle-entity-secret.mjs
 *
 * The entity secret is NEVER printed (goes straight to the gitignored .env). Keep
 * mcp/circle-recovery.dat somewhere safe (password manager) — it recovers the entity
 * secret if lost. Re-registering rotates the secret and orphans wallets created with
 * the old one, so this refuses to run if a secret is already present.
 */
import { registerEntitySecretCiphertext } from '@circle-fin/developer-controlled-wallets'
import { randomBytes } from 'node:crypto'
import { writeFileSync, appendFileSync, readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const apiKey = process.env.CIRCLE_API_KEY
if (!apiKey) {
  console.error('✗ CIRCLE_API_KEY is not set. Add it to mcp/.env, then run with --env-file=.env')
  process.exit(1)
}
if (process.env.CIRCLE_ENTITY_SECRET) {
  console.error('✗ CIRCLE_ENTITY_SECRET is already set — refusing to re-register (would orphan existing wallets).')
  process.exit(1)
}

const mcpDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = join(mcpDir, '.env')
const recoveryPath = join(mcpDir, 'circle-recovery.dat')

if (existsSync(envPath) && /^\s*CIRCLE_ENTITY_SECRET=/m.test(readFileSync(envPath, 'utf8'))) {
  console.error('✗ mcp/.env already has CIRCLE_ENTITY_SECRET — refusing to overwrite.')
  process.exit(1)
}

const entitySecret = randomBytes(32).toString('hex') // 64 hex chars, Circle's expected format
const res = await registerEntitySecretCiphertext({ apiKey, entitySecret })
const recoveryFile = res.data?.recoveryFile
if (!recoveryFile) {
  console.error('✗ Circle returned no recovery file — check the API key and try again.')
  process.exit(1)
}

writeFileSync(recoveryPath, recoveryFile)
appendFileSync(envPath, `\nCIRCLE_ENTITY_SECRET=${entitySecret}\n`)

console.log('✓ Entity secret registered with Circle.')
console.log('✓ CIRCLE_ENTITY_SECRET written to mcp/.env (value not printed).')
console.log('✓ Recovery file saved to mcp/circle-recovery.dat — MOVE it to a password manager.')
console.log('\nNext:  node --env-file=.env scripts/test-circle.mjs')
