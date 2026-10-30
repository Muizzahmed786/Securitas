import logging
import os
import time
import statistics
from pathlib import Path
from uuid import uuid4

from Cryptodome.Cipher import AES, PKCS1_OAEP
from Cryptodome.Hash import SHA256
from Cryptodome.PublicKey import RSA
from Cryptodome.Random import get_random_bytes
from Cryptodome.Signature import pss
from fastapi import APIRouter, Depends
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import text

from app.auth.router import verify_jwt
from app.database import get_db
from app.rbac.dependency import require_permission
from app.utils.ApiError import ApiError
from app.utils.ApiResponse import ApiResponse


BACKEND_DIRECTORY = Path(__file__).resolve().parents[2]
router = APIRouter()
logger = logging.getLogger(__name__)
RSA_KEY_BITS = 3072


def get_private_key_settings():
    passphrase = os.getenv("RSA_PRIVATE_KEY_PASSPHRASE", "")
    if len(passphrase) < 32 or passphrase.startswith("REPLACE_"):
        raise ApiError(
            503,
            "Set RSA_PRIVATE_KEY_PASSPHRASE to a random secret of at least 32 characters",
        )

    configured_path = os.getenv("RSA_PRIVATE_KEY_DIR", "./private_keys").strip()
    if not configured_path:
        raise ApiError(503, "RSA_PRIVATE_KEY_DIR cannot be empty")

    directory = Path(configured_path).expanduser()
    if not directory.is_absolute():
        directory = BACKEND_DIRECTORY / directory

    return passphrase, directory.resolve()


def generate_rsa_key_pair(passphrase: str):
    """Return a public PEM and a password-encrypted private PEM."""
    key = RSA.generate(RSA_KEY_BITS)
    public_pem = key.publickey().export_key(format="PEM").decode("ascii")
    private_pem = key.export_key(
        format="PEM",
        pkcs=8,
        passphrase=passphrase,
        protection="PBKDF2WithHMAC-SHA512AndAES256-CBC",
        prot_params={"iteration_count": 131072},
    )
    return public_pem, private_pem


def write_private_key(path: Path, private_pem: bytes):
    """Save exclusively; never overwrite another key."""
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(descriptor, "wb") as output:
            output.write(private_pem)
            output.flush()
            os.fsync(output.fileno())
    except BaseException:
        path.unlink(missing_ok=True)
        raise


def benchmark_cryptography():
    """Benchmark pure CPU cryptographic operations across file sizes up to upload limit."""
    rsa_key = RSA.generate(2048)
    rsa_pub = rsa_key.publickey()

    sizes = [64 * 1024, 512 * 1024, 2 * 1024 * 1024, 8 * 1024 * 1024]
    aes_metrics = []

    for size in sizes:
        data = os.urandom(size)
        enc_times = []
        dec_times = []
        for _ in range(3):
            t0 = time.perf_counter()
            dek = get_random_bytes(32)
            nonce = get_random_bytes(12)
            cipher = AES.new(dek, AES.MODE_GCM, nonce=nonce, mac_len=16)
            ct, tag = cipher.encrypt_and_digest(data)
            enc_times.append((time.perf_counter() - t0) * 1000)

            t0 = time.perf_counter()
            dec_cipher = AES.new(dek, AES.MODE_GCM, nonce=nonce, mac_len=16)
            _ = dec_cipher.decrypt_and_verify(ct, tag)
            dec_times.append((time.perf_counter() - t0) * 1000)

        mean_enc = statistics.mean(enc_times)
        mean_dec = statistics.mean(dec_times)
        aes_metrics.append({
            "size_bytes": size,
            "size_label": f"{size // 1024} KB" if size < 1024 * 1024 else f"{size // (1024 * 1024)} MB",
            "encrypt_ms": round(mean_enc, 3),
            "decrypt_ms": round(mean_dec, 3),
            "encrypt_throughput_mb_s": round((size / (1024 * 1024)) / (mean_enc / 1000), 1) if mean_enc > 0 else 0,
            "decrypt_throughput_mb_s": round((size / (1024 * 1024)) / (mean_dec / 1000), 1) if mean_dec > 0 else 0,
        })

    wrap_times = []
    unwrap_times = []
    for _ in range(3):
        dek = get_random_bytes(32)
        t0 = time.perf_counter()
        wrapped = PKCS1_OAEP.new(rsa_pub, hashAlgo=SHA256).encrypt(dek)
        wrap_times.append((time.perf_counter() - t0) * 1000)

        t0 = time.perf_counter()
        _ = PKCS1_OAEP.new(rsa_key, hashAlgo=SHA256).decrypt(wrapped)
        unwrap_times.append((time.perf_counter() - t0) * 1000)

    sign_times = []
    verify_times = []
    for _ in range(3):
        digest = SHA256.new(b"benchmark document digest payload")
        t0 = time.perf_counter()
        sig = pss.new(rsa_key).sign(digest)
        sign_times.append((time.perf_counter() - t0) * 1000)

        t0 = time.perf_counter()
        try:
            pss.new(rsa_pub).verify(digest, sig)
            verify_times.append((time.perf_counter() - t0) * 1000)
        except Exception:
            pass

    return {
        "iterations": 3,
        "payload_limit_bytes": 20 * 1024 * 1024,
        "tested_sizes": aes_metrics,
        "key_wrapping_rsa_oaep": {
            "payload": "32-byte AES DEK",
            "key_size_bits": 2048,
            "wrap_ms": round(statistics.mean(wrap_times), 3),
            "unwrap_ms": round(statistics.mean(unwrap_times), 3),
            "note": "RSA-OAEP encrypts only the 32-byte symmetric AES-256 DEK. It never processes document content."
        },
        "digital_signatures_rsa_pss": {
            "payload": "32-byte SHA-256 Digest",
            "key_size_bits": 2048,
            "sign_ms": round(statistics.mean(sign_times), 3),
            "verify_ms": round(statistics.mean(verify_times), 3),
            "note": "RSA-PSS signs only the 32-byte SHA-256 hash. Document payload is digested locally."
        }
    }


_last_benchmark_result = None
_last_benchmark_time = 0.0

@router.get("/benchmark")
async def get_crypto_benchmark(user=Depends(verify_jwt)):
    """Measure pure CPU cryptographic latency and throughput across file sizes (cached for 10s to prevent DoS)."""
    global _last_benchmark_result, _last_benchmark_time
    now = time.time()
    if _last_benchmark_result is not None and (now - _last_benchmark_time) < 10.0:
        return ApiResponse(200, _last_benchmark_result, "Cryptographic performance benchmark completed")

    data = await run_in_threadpool(benchmark_cryptography)
    _last_benchmark_result = data
    _last_benchmark_time = now
    return ApiResponse(200, data, "Cryptographic performance benchmark completed")


@router.post("/wrapping", status_code=201)
async def create_wrapping_key(
    user=Depends(require_permission("crypto_keys.create")),
    db=Depends(get_db),
):
    """Provision one active system key; this endpoint does not rotate keys."""
    key_id = uuid4()
    file_written = False
    commit_attempted = False
    private_key_path = None

    try:
        passphrase, directory = get_private_key_settings()
        private_key_path = directory / f"{key_id}.pem"

        # Requests using this endpoint serialize until commit or rollback.
        # The shared lock numbers must remain identical in every app worker.
        await db.execute(text("SELECT pg_advisory_xact_lock(734821, 1)"))

        result = await db.execute(text("""
            SELECT id
            FROM crypto_keys
            WHERE owner_id IS NULL
              AND purpose = 'KEY_WRAPPING'
              AND algorithm = 'RSA-OAEP-SHA256'
              AND status = 'ACTIVE'
              AND revoked_at IS NULL
              AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
            LIMIT 1
        """))
        if result.scalar_one_or_none() is not None:
            raise ApiError(409, "An active document wrapping key already exists")

        public_pem, private_pem = await run_in_threadpool(
            generate_rsa_key_pair, passphrase
        )

        result = await db.execute(
            text("""
                INSERT INTO crypto_keys (
                    id, owner_id, purpose, algorithm, public_key_pem,
                    secret_ref, status, created_at, expires_at, revoked_at
                )
                VALUES (
                    :id, NULL, 'KEY_WRAPPING', 'RSA-OAEP-SHA256',
                    :public_key_pem, :secret_ref, 'ACTIVE',
                    CURRENT_TIMESTAMP, NULL, NULL
                )
                RETURNING created_at
            """),
            {
                "id": key_id,
                "public_key_pem": public_pem,
                "secret_ref": str(private_key_path),
            },
        )
        created_at = result.scalar_one()

        # Publish the database row only after the private file is saved.
        await run_in_threadpool(write_private_key, private_key_path, private_pem)
        file_written = True
        del private_pem

        commit_attempted = True
        await db.commit()

    except BaseException as error:
        try:
            await db.rollback()
        except Exception:
            logger.exception("Failed to roll back key creation")

        if file_written and not commit_attempted:
            try:
                await run_in_threadpool(private_key_path.unlink, missing_ok=True)
            except Exception:
                logger.exception("Could not clean up private key %s", key_id)

        # On an uncertain commit, preserve the key: the row may have committed.
        if not isinstance(error, Exception) or isinstance(error, ApiError):
            raise
        logger.exception("Wrapping key creation failed: %s", key_id)
        raise ApiError(500, "Could not create document wrapping key") from error

    return ApiResponse(
        201,
        {
            "id": str(key_id),
            "purpose": "KEY_WRAPPING",
            "algorithm": "RSA-OAEP-SHA256",
            "key_size_bits": RSA_KEY_BITS,
            "status": "ACTIVE",
            "public_key_pem": public_pem,
            "created_at": created_at.isoformat(),
        },
        "Document wrapping key created successfully",
    )
