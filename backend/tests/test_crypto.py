import unittest
from uuid import uuid4
from app.crypto.encryption import encrypt_document, decrypt_document
from app.crypto.key_manager import generate_rsa_key_pair, load_private_key

class CryptoTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.secret = 'test-only-private-key-passphrase-123456789'
        cls.public, cls.private = generate_rsa_key_pair(cls.secret)
        cls.key = load_private_key(cls.private, cls.secret)

    def roundtrip(self, original, public=None):
        document_id = uuid4()
        encrypted = encrypt_document(original, public or self.public, document_id)
        metadata = {'id': document_id, 'encryption_nonce': encrypted['nonce'],
                    'authentication_tag': encrypted['authentication_tag'], 'encrypted_dek': encrypted['encrypted_dek']}
        self.assertEqual(decrypt_document(encrypted['ciphertext'], metadata, self.key), original)
        self.assertNotEqual(encrypted['ciphertext'], original)
        self.assertEqual(len(encrypted['nonce']), 12)
        self.assertEqual(len(encrypted['authentication_tag']), 16)
        self.assertEqual(len(encrypted['encrypted_dek']), 384)

    def test_binary_and_unicode_roundtrip(self):
        self.roundtrip(bytes(range(256)) * 64 + 'Confidential: नमस्ते'.encode())

    def test_maximum_file_size(self):
        self.roundtrip(b'x' * (20 * 1024 * 1024))

    def test_legacy_escaped_public_key(self):
        self.roundtrip(b'legacy public key', self.public.replace('\n', '\\n'))

    def test_distinct_keys_and_nonces(self):
        first = encrypt_document(b'same content', self.public, uuid4())
        second = encrypt_document(b'same content', self.public, uuid4())
        for field in ['nonce', 'encrypted_dek', 'ciphertext']:
            self.assertNotEqual(first[field], second[field])

    def test_private_key_requires_passphrase(self):
        self.assertIn(b'BEGIN ENCRYPTED PRIVATE KEY', self.private)
        with self.assertRaises(ValueError):
            load_private_key(self.private, 'incorrect-passphrase')
