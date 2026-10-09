/** Local-only signing. This module never makes network requests. */

const algorithm = {
  name: "RSA-PSS",
  hash: "SHA-256",
};

const pss = {
  name: "RSA-PSS",
  saltLength: 32,
};

function pemBytes(
  pem: string,
  label: "PRIVATE KEY" | "PUBLIC KEY",
): ArrayBuffer {
  const header = `-----BEGIN ${label}-----`;
  const footer = `-----END ${label}-----`;
  const clean = pem.trim();

  if (!clean.startsWith(header) || !clean.endsWith(footer)) {
    throw new Error(`Expected a ${label} PEM file.`);
  }

  const body = clean
    .slice(header.length, -footer.length)
    .replace(/\s/g, "");

  if (
    !body ||
    body.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(body)
  ) {
    throw new Error("The PEM contains invalid Base64.");
  }

  try {
    const raw = atob(body);
    const bytes = new Uint8Array(raw.length);

    for (let index = 0; index < raw.length; index++) {
      bytes[index] = raw.charCodeAt(index);
    }

    return bytes.buffer;
  } catch {
    throw new Error("The PEM could not be decoded.");
  }
}

export function normalizeSignature(value: string): string {
  const clean = value.replace(/\s/g, "");

  if (
    !clean ||
    clean.length > 1024 ||
    clean.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(clean)
  ) {
    throw new Error("Enter a standard Base64 RSA signature.");
  }

  let length: number;

  try {
    length = atob(clean).length;
  } catch {
    throw new Error("The signature is not valid Base64.");
  }

  if (length < 256 || length > 512) {
    throw new Error(
      "Expected a signature from a 2048–4096-bit RSA key.",
    );
  }

  return clean;
}

export async function signLocally(
  original: File,
  privatePem: File,
  registeredPublicPem: string,
): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Local signing requires HTTPS or localhost.");
  }

  if (!original.size || original.size > 20 * 1024 * 1024) {
    throw new Error(
      "Choose the exact original document, no larger than 20 MiB.",
    );
  }

  if (!privatePem.size || privatePem.size > 65536) {
    throw new Error(
      "Choose a valid private PEM file no larger than 64 KiB.",
    );
  }

  const pem = await privatePem.text();

  if (pem.includes("-----BEGIN ENCRYPTED PRIVATE KEY-----")) {
    throw new Error(
      "This PEM is encrypted. Sign with a compatible local tool " +
        "and use Submit existing signature.",
    );
  }

  const privateBytes = pemBytes(pem, "PRIVATE KEY");

  let privateKey: CryptoKey;
  let publicKey: CryptoKey;

  try {
    privateKey = await crypto.subtle.importKey(
      "pkcs8",
      privateBytes,
      algorithm,
      false,
      ["sign"],
    );

    publicKey = await crypto.subtle.importKey(
      "spki",
      pemBytes(registeredPublicPem, "PUBLIC KEY"),
      algorithm,
      false,
      ["verify"],
    );
  } catch {
    throw new Error(
      "Could not import the signing keys. Use an unencrypted " +
        "PKCS#8 RSA private PEM and its registered public key.",
    );
  } finally {
    // Best effort only; browser memory cannot be securely erased.
    new Uint8Array(privateBytes).fill(0);
  }

  const size = (
    privateKey.algorithm as RsaHashedKeyAlgorithm
  ).modulusLength;

  if (size < 2048 || size > 4096) {
    throw new Error("Use a 2048–4096-bit RSA signing key.");
  }

  const data = await original.arrayBuffer();

  const signature = await crypto.subtle.sign(
    pss,
    privateKey,
    data,
  );

  const matches = await crypto.subtle.verify(
    pss,
    publicKey,
    signature,
    data,
  );

  if (!matches) {
    throw new Error(
      "This private PEM does not match the selected signing key. " +
        "Select its matching key ID.",
    );
  }

  return btoa(
    String.fromCharCode(...new Uint8Array(signature)),
  );
}