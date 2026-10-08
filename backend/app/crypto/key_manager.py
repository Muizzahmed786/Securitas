"""RSA key protection; private keys are encrypted PEM files outside the database."""
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa


def generate_rsa_key_pair(passphrase: str):
    if len(passphrase) < 32:
        raise ValueError("Private-key passphrase must contain at least 32 characters")
    key = rsa.generate_private_key(public_exponent=65537, key_size=3072)
    public = key.public_key().public_bytes(
        serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
    ).decode("ascii")
    private = key.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
        serialization.BestAvailableEncryption(passphrase.encode("utf-8")),
    )
    return public, private


def import_wrapping_public_key(public_key_pem):
    if isinstance(public_key_pem, bytes):
        public_key_pem = public_key_pem.decode("ascii")
    clean = public_key_pem.replace("\\r\\n", "\n").replace("\\n", "\n").strip()
    header, footer = "-----BEGIN PUBLIC KEY-----", "-----END PUBLIC KEY-----"
    if not clean.startswith(header) or not clean.endswith(footer):
        raise ValueError("Expected a public-key PEM")
    body = "".join(clean[len(header):-len(footer)].split())
    clean = header + "\n" + "\n".join(body[i:i+64] for i in range(0, len(body), 64)) + "\n" + footer
    key = serialization.load_pem_public_key(clean.encode("ascii"))
    if not isinstance(key, rsa.RSAPublicKey) or key.key_size < 2048:
        raise ValueError("Expected an RSA public key of at least 2048 bits")
    return key


def load_private_key(pem: bytes, passphrase: str):
    key = serialization.load_pem_private_key(pem, password=passphrase.encode("utf-8"))
    if not isinstance(key, rsa.RSAPrivateKey) or key.key_size < 2048:
        raise ValueError("Expected an RSA private key of at least 2048 bits")
    return key


def oaep_padding():
    return padding.OAEP(mgf=padding.MGF1(hashes.SHA256()), algorithm=hashes.SHA256(), label=None)


def wrap_key(dek: bytes, public_key):
    return public_key.encrypt(dek, oaep_padding())


def unwrap_key(wrapped: bytes, private_key):
    return private_key.decrypt(wrapped, oaep_padding())
