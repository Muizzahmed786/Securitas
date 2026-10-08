import logging
import os
from pathlib import Path
from uuid import uuid4

from Cryptodome.PublicKey import RSA
from dotenv import load_dotenv
from fastapi import APIRouter, Depends
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import text

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
