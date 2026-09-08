import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isEmailVerified } from '../lib/email-verification.ts'

const account = {
  email: 'member@example.com',
  email_confirmed_at: '2026-09-08T00:00:00Z',
  app_metadata: {},
}

test('enabling password login does not verify a deferred account', () => {
  assert.equal(isEmailVerified({ ...account, app_metadata: { email_verification_required: true } }), false)
})

test('verification belongs to the current email address', () => {
  const verified = { ...account, app_metadata: { email_verification_required: true, verified_email: account.email } }
  assert.equal(isEmailVerified(verified), true)
  assert.equal(isEmailVerified({ ...verified, email: 'changed@example.com' }), false)
  assert.equal(isEmailVerified({ ...verified, email: undefined }), false)
})

test('legacy accounts retain confirmed and unconfirmed states', () => {
  assert.equal(isEmailVerified(account), true)
  assert.equal(isEmailVerified({ ...account, email_confirmed_at: undefined }), false)
})

test('editable user metadata cannot claim email ownership', () => {
  assert.equal(isEmailVerified({
    ...account,
    app_metadata: { email_verification_required: true },
    user_metadata: { verified_email: account.email, email_verification_required: false },
  }), false)
})
