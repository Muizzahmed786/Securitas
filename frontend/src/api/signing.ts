/** Matches the backend's RSA-PSS-SHA256 with a 32-byte salt. */
export async function signLocally(original: File, privatePem: File): Promise<string> {
  if (original.size > 20 * 1024 * 1024 || original.size === 0) throw new Error('Choose the original document, no larger than 20 MiB.')
  if (privatePem.size > 65536) throw new Error('The private-key file is too large.')
  if (!window.crypto?.subtle) throw new Error('Local signing requires HTTPS or localhost.')
  const pem = await privatePem.text()
  if (pem.includes('ENCRYPTED PRIVATE KEY')) throw new Error('This key is passphrase-encrypted. Use the existing-signature option after signing locally with a compatible tool.')
  if (!pem.includes('-----BEGIN PRIVATE KEY-----')) throw new Error('Choose an unencrypted PKCS8 private-key PEM file.')
  let bytes: Uint8Array
  try { const raw = atob(pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '')); bytes = Uint8Array.from(raw, character => character.charCodeAt(0)) }
  catch { throw new Error('The private-key PEM could not be read.') }
  try {
    const key = await crypto.subtle.importKey('pkcs8', bytes.buffer as ArrayBuffer, { name: 'RSA-PSS', hash: 'SHA-256' }, false, ['sign'])
    const signature = new Uint8Array(await crypto.subtle.sign({ name: 'RSA-PSS', saltLength: 32 }, key, await original.arrayBuffer()))
    return btoa(String.fromCharCode(...signature))
  } catch { throw new Error('The document could not be signed with this key. Check the PEM format and key algorithm.') }
  finally { bytes.fill(0) }
}
