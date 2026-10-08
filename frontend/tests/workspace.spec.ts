import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { generateKeyPairSync, verify, constants } from 'node:crypto'

const documentId = 'c2f31b50-0459-4b66-b17f-051babc929d4'
const keyId = 'f8d33713-23d0-4bb9-8ab0-644baaf8389e'
const permissionNames = ['documents.upload', 'documents.sign', 'documents.verify', 'crypto_keys.create']
const user = { id: 7, email: 'suraj@example.com', role: 'DOCUMENT_OWNER', role_id: 2, is_active: true, created_at: '2026-10-08T12:00:00Z' }
const envelope = (data: unknown, message = 'Success') => ({ data, message, statusCode: 200, success: true })

async function mock(page: Page, permissions = permissionNames) {
  let signedIn = false
  const pair = generateKeyPairSync('rsa', { modulusLength: 3072,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } })
  const state = { generateCount: 0, uploadBody: '', signatureBody: null as { signing_key_id: string; signature_base64: string } | null, registerBody: null as { role_id: number } | null, generateFails: false }
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    const send = (data: unknown, status = 200) => route.fulfill({ status, json: data })
    if (path === '/api/auth/login') { signedIn = true; return send(envelope({ user })) }
    if (path === '/api/auth/register') { state.registerBody = request.postDataJSON(); return send(envelope(user), 201) }
    if (path === '/api/auth/logout') { signedIn = false; return send(envelope({})) }
    if (path === '/api/auth/refresh-access-token') return send({ message: 'Unauthorized request' }, 401)
    if (path === '/api/auth/get-current-user') return signedIn ? send(envelope(user)) : send({ message: 'Unauthorized request' }, 401)
    if (path === '/api/rbac/get-my-permissions') return send(envelope({ permissions: permissions.map((name, id) => ({ id, name, description: null })) }))
    if (path === '/api/documents/upload') {
      state.uploadBody = request.postDataBuffer()?.toString() || ''
      return send(envelope({ id: documentId, filename: 'original.pdf', mime_type: 'application/pdf', classification: 'CONFIDENTIAL', file_size_bytes: 25, created_at: '2026-10-08T13:00:00Z' }), 201)
    }
    if (path === '/api/signatures/keys') return send(envelope([{ id: keyId, algorithm: 'RSA-PSS-SHA256', public_key_pem: pair.publicKey, status: 'ACTIVE', created_at: '2026-10-08T13:00:00Z', usable_for_signing: true }]))
    if (path === '/api/signatures/keys/generate') {
      state.generateCount++
      if (state.generateFails) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Signing key service unavailable' }) })
      return route.fulfill({ status: 201, contentType: 'application/octet-stream', body: pair.privateKey,
        headers: { 'X-Signing-Key-Id': keyId, 'Content-Disposition': `attachment; filename="signing-${keyId}.pem"` } })
    }
    if (path === `/api/signatures/documents/${documentId}`) { state.signatureBody = request.postDataJSON(); return send(envelope({ id: 'saved-signature' }), 201) }
    if (path === `/api/signatures/documents/${documentId}/verify`) return send(envelope({ document_id: documentId, document_integrity_valid: true, has_signatures: true, signatures: [{ id: 'signature-1', signer_id: 7, signing_key_id: keyId, signed_at: '2026-10-08T13:00:00Z', cryptographically_valid: true, key_status: 'ACTIVE', key_usable_now: true }] }))
    if (path === '/api/crypto-keys/wrapping') return send(envelope({ id: keyId, algorithm: 'RSA-OAEP-SHA256', public_key_pem: pair.publicKey, created_at: '2026-10-08T13:00:00Z' }), 201)
    throw new Error(`Unexpected API request: ${request.method()} ${path}`)
  })
  return { state, pair }
}
async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email address').fill(user.email)
  await page.getByLabel('Password', { exact: true }).fill('DemoPassword123!')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your secure workspace' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Document Upload' })).toBeVisible()
}

test('login, multipart upload, receipt, and logout use the backend contract', async ({ page }) => {
  const { state } = await mock(page)
  await login(page)
  await page.getByRole('link', { name: 'Document Upload' }).click()
  await page.getByLabel('Choose document').setInputFiles({ name: 'original.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 private document') })
  await page.getByLabel('Document classification').selectOption('CONFIDENTIAL')
  await page.getByRole('button', { name: 'Encrypt & upload', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('uploaded and encrypted')
  expect(state.uploadBody).toContain('name="file"')
  expect(state.uploadBody).toContain('name="classification"')
  expect(state.uploadBody).toContain('CONFIDENTIAL')
  await expect(page.getByText(documentId, { exact: true })).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save receipt' }).click()
  expect((await download).suggestedFilename()).toBe(`receipt-${documentId}.json`)
  await page.screenshot({ path: 'test-results/upload-desktop.png', fullPage: true })
  await page.getByRole('button', { name: 'Sign Out' }).click()
  await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible()
})

test('registration sends a numeric role and does not expose Admin registration', async ({ page }) => {
  const { state } = await mock(page)
  await page.goto('/register')
  await page.getByLabel('Email address').fill('new@example.com')
  await page.getByLabel('Password', { exact: true }).fill('DemoPassword123!')
  await expect(page.getByRole('option', { name: 'Admin', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect(state.registerBody?.role_id).toBe(2)
})

test('browser signs exact original bytes with RSA-PSS and sends no private key', async ({ page }) => {
  const { state, pair } = await mock(page)
  await login(page)
  await page.getByRole('link', { name: 'Digital Signatures', exact: true }).click()
  await page.getByRole('button', { name: 'Sign Document', exact: true }).click()
  await page.getByLabel('Document ID', { exact: true }).fill(documentId)
  await page.getByLabel('Signing key', { exact: true }).selectOption(keyId)
  const original = Buffer.from('%PDF-1.4 original document bytes')
  await page.getByLabel('Original document', { exact: true }).setInputFiles({ name: 'original.pdf', mimeType: 'application/pdf', buffer: original })
  await page.getByLabel('Signing private-key PEM').setInputFiles({ name: 'private.pem', mimeType: 'text/plain', buffer: Buffer.from(pair.privateKey) })
  await page.getByRole('button', { name: 'Sign & submit', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('verified by the server and saved')
  expect(Object.keys(state.signatureBody || {}).sort()).toEqual(['signature_base64', 'signing_key_id'])
  expect(verify('sha256', original, { key: pair.publicKey, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 }, Buffer.from(state.signatureBody!.signature_base64, 'base64'))).toBe(true)
  await page.getByRole('button', { name: 'Verify Signatures', exact: true }).click()
  await page.getByRole('button', { name: 'Verify signatures', exact: true }).last().click()
  await expect(page.getByText('Signature valid', { exact: true })).toBeVisible()
})

test('private-key generation downloads once and displays JSON blob failures', async ({ page }) => {
  const { state } = await mock(page)
  await login(page)
  await page.getByRole('link', { name: 'Digital Signatures', exact: true }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Create & download private key' }).click()
  expect((await download).suggestedFilename()).toBe(`signing-${keyId}.pem`)
  await expect(page.getByRole('status')).toContainText('Signing key created')
  expect(state.generateCount).toBe(1)
  state.generateFails = true
  await page.getByRole('button', { name: 'Create & download private key' }).click()
  await expect(page.getByRole('alert')).toHaveText('Signing key service unavailable')
  expect(state.generateCount).toBe(2)
})

test('permission gates hide unsupported actions and mobile sidebar works', async ({ page }) => {
  await mock(page, ['documents.verify'])
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/login')
  await page.getByLabel('Email address').fill(user.email)
  await page.getByLabel('Password', { exact: true }).fill('DemoPassword123!')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your secure workspace' })).toBeVisible()
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await expect(page.getByRole('link', { name: 'Document Upload' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Encryption Setup' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Digital Signatures', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Sign Document' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false')
  await page.screenshot({ path: 'test-results/signatures-mobile.png', fullPage: true })
})
