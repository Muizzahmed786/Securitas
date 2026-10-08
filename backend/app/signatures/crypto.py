"""PyCryptodomeX-only RSA-PSS and stored-document decryption."""
import base64
import binascii
import hmac
from pathlib import Path

from Cryptodome.Cipher import AES, PKCS1_OAEP
from Cryptodome.Hash import SHA256
from Cryptodome.PublicKey import RSA
from Cryptodome.Signature import pss

ALGORITHM = "RSA-PSS-SHA256"
MAX_FILE_SIZE = 20 * 1024 * 1024


def generate_key_pair(passphrase=None):
    private = RSA.generate(3072)
    options = {"format": "PEM", "pkcs": 8}
    if passphrase:
        options.update(passphrase=passphrase.encode("utf-8"),
                       protection="PBKDF2WithHMAC-SHA512AndAES256-CBC",
                       prot_params={"iteration_count": 210000})
    private_pem = private.export_key(**options)
    public_pem = private.public_key().export_key(format="PEM").decode("ascii")
    return private_pem, public_pem


def decode_signature(value):
    try:
        signature = base64.b64decode(value, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise ValueError("Signature must be standard Base64") from exc
    if not 256 <= len(signature) <= 512:
        raise ValueError("Invalid RSA signature length")
    return signature


def verify_signature(public_pem, signature, data):
    key = RSA.import_key(public_pem)
    if key.has_private() or not 2048 <= key.size_in_bits() <= 4096:
        raise ValueError("Invalid RSA signing public key")
    try:
        pss.new(key, salt_bytes=32).verify(SHA256.new(data), signature)
        return True
    except (ValueError, TypeError):
        return False


def decrypt_document(document, wrapping_key, storage_root, passphrase=None):
    root = Path(storage_root).resolve()
    path = Path(document["storage_path"]).resolve()
    if not path.is_relative_to(root):
        raise ValueError("Document path is outside DOCUMENT_STORAGE_DIR")
    if document["encryption_algorithm"] != "AES-256-GCM":
        raise ValueError("Unsupported document encryption")
    if wrapping_key["purpose"] != "KEY_WRAPPING" or wrapping_key["algorithm"] != "RSA-OAEP-SHA256":
        raise ValueError("Invalid wrapping key purpose or algorithm")
    private_path = Path(wrapping_key["secret_ref"])
    if not private_path.is_absolute():
        raise ValueError("Wrapping private key path must be absolute")
    with private_path.open("rb") as source:
        pem = source.read(65537)
    if len(pem) > 65536:
        raise ValueError("Wrapping private key file too large")
    private = RSA.import_key(pem, passphrase=passphrase.encode("utf-8") if passphrase else None)
    if not private.has_private() or private.size_in_bits() < 2048:
        raise ValueError("Invalid wrapping private key")
    dek = PKCS1_OAEP.new(private, hashAlgo=SHA256).decrypt(bytes(document["encrypted_dek"]))
    if len(dek) != 32:
        raise ValueError("Invalid AES-256 key length")
    with path.open("rb") as source:
        ciphertext = source.read(MAX_FILE_SIZE + 1)
    if len(ciphertext) > MAX_FILE_SIZE or len(ciphertext) != document["file_size_bytes"]:
        raise ValueError("Stored file size mismatch")
    nonce, tag = bytes(document["encryption_nonce"]), bytes(document["authentication_tag"])
    if len(nonce) != 12 or len(tag) != 16:
        raise ValueError("Invalid AES-GCM nonce or tag length")
    cipher = AES.new(dek, AES.MODE_GCM, nonce=nonce, mac_len=16)
    cipher.update(str(document["id"]).encode("utf-8"))
    plaintext = cipher.decrypt_and_verify(ciphertext, tag)
    if not hmac.compare_digest(SHA256.new(plaintext).hexdigest(), document["content_hash"]):
        raise ValueError("Stored content hash mismatch")
    return plaintext
