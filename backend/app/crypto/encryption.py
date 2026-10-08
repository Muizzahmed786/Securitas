"""AES-GCM encryption compatible with the existing upload format.

The document UUID is authenticated associated data. The final 16 bytes produced
by AESGCM are stored as authentication_tag, separately from the ciphertext.
No standalone hash/signature verification feature is exposed by this milestone.
"""
import hashlib
import secrets
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from app.crypto.key_manager import import_wrapping_public_key, wrap_key, unwrap_key


def encrypt_document(data: bytes, public_key_pem: str, document_id):
    public_key = import_wrapping_public_key(public_key_pem)
    dek, nonce = secrets.token_bytes(32), secrets.token_bytes(12)
    encrypted = AESGCM(dek).encrypt(nonce, data, str(document_id).encode("utf-8"))
    return {
        "ciphertext": encrypted[:-16], "nonce": nonce,
        "authentication_tag": encrypted[-16:], "encrypted_dek": wrap_key(dek, public_key),
        # Retained for schema compatibility; separate SHA-256 verification is deferred.
        "content_hash": hashlib.sha256(data).hexdigest(),
    }


def decrypt_document(ciphertext: bytes, metadata, private_key):
    dek = unwrap_key(bytes(metadata["encrypted_dek"]), private_key)
    return AESGCM(dek).decrypt(
        bytes(metadata["encryption_nonce"]),
        ciphertext + bytes(metadata["authentication_tag"]),
        str(metadata["id"]).encode("utf-8"),
    )
