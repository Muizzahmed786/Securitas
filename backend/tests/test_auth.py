"""Integration tests use a random schema in TEST_DATABASE_URL, never production tables."""
import os
from pathlib import Path
import tempfile
import unittest
from uuid import UUID, uuid4

TEST_DATABASE_URL = os.getenv('TEST_DATABASE_URL')

@unittest.skipUnless(TEST_DATABASE_URL, 'Set TEST_DATABASE_URL for PostgreSQL/API tests')
class ProgressIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        os.environ.setdefault('DATABASE_URL', TEST_DATABASE_URL)
        os.environ.setdefault('ACCESS_TOKEN_SECRET', 'integration-access-secret-1234567890123456789')
        os.environ.setdefault('REFRESH_TOKEN_SECRET', 'integration-refresh-secret-1234567890123456789')
        self.old_env = {k: os.environ.get(k) for k in ['DOCUMENT_STORAGE_DIR', 'RSA_PRIVATE_KEY_DIR', 'RSA_PRIVATE_KEY_PASSPHRASE']}
        from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
        from httpx import AsyncClient, ASGITransport
        from app.main import app
        from app.database import get_db
        from app.crypto.key_manager import generate_rsa_key_pair
        from app.cryptoKeys.router import write_private_key
        from sqlalchemy import text
        self.text, self.app, self.get_db = text, app, get_db
        self.temp = tempfile.TemporaryDirectory()
        os.environ['DOCUMENT_STORAGE_DIR'] = self.temp.name + '/files'
        os.environ['RSA_PRIVATE_KEY_DIR'] = self.temp.name + '/keys'
        os.environ['RSA_PRIVATE_KEY_PASSPHRASE'] = 'integration-key-passphrase-123456789'
        self.schema = 'test_' + uuid4().hex
        self.engine = create_async_engine(TEST_DATABASE_URL, connect_args={'server_settings': {'search_path': self.schema}})
        async with self.engine.connect() as connection:
            raw = await connection.get_raw_connection()
            await raw.driver_connection.execute(f'CREATE SCHEMA {self.schema}')
            script = (Path(__file__).resolve().parents[2] / 'docsentinel_schema.sql').read_text()
            await raw.driver_connection.execute(script)
            await connection.commit()
        self.sessions = async_sessionmaker(self.engine)
        async def override():
            async with self.sessions() as session:
                yield session
        app.dependency_overrides[get_db] = override
        self.client = AsyncClient(transport=ASGITransport(app=app), base_url='http://test')
        key_id = uuid4()
        public, private = generate_rsa_key_pair(os.environ['RSA_PRIVATE_KEY_PASSPHRASE'])
        path = Path(self.temp.name) / 'keys' / f'{key_id}.pem'
        write_private_key(path, private)
        async with self.sessions() as session:
            await session.execute(text("""INSERT INTO crypto_keys (id,purpose,algorithm,public_key_pem,secret_ref)
                VALUES (:id,'KEY_WRAPPING','RSA-OAEP-SHA256',:public,:secret)"""),
                {'id': key_id, 'public': public, 'secret': str(path)})
            await session.commit()

    async def asyncTearDown(self):
        await self.client.aclose()
        self.app.dependency_overrides.pop(self.get_db, None)
        async with self.engine.begin() as connection:
            await connection.execute(self.text(f'DROP SCHEMA {self.schema} CASCADE'))
        await self.engine.dispose()
        self.temp.cleanup()
        for name, value in self.old_env.items():
            if value is None:
                os.environ.pop(name, None)
            else:
                os.environ[name] = value

    async def login(self, email='owner@example.com'):
        credentials = {'email': email, 'password': 'ProgressCheckPassword123!'}
        response = await self.client.post('/api/auth/register', json=credentials)
        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(response.json()['data']['role'], 'DOCUMENT_OWNER')
        response = await self.client.post('/api/auth/login', json=credentials)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()['data']

    async def upload(self):
        response = await self.client.post('/api/documents/upload',
            files={'file': ('progress.txt', b'Private lab document\n', 'text/plain')},
            data={'classification': 'CONFIDENTIAL'})
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()['data']['id']

    async def test_upload_list_download(self):
        await self.login()
        document_id = await self.upload()
        listing = await self.client.get('/api/documents')
        self.assertEqual(listing.status_code, 200, listing.text)
        self.assertEqual(listing.json()['data']['documents'][0]['id'], document_id)
        downloaded = await self.client.get(f'/api/documents/{document_id}/download')
        self.assertEqual(downloaded.status_code, 200, downloaded.text)
        self.assertEqual(downloaded.content, b'Private lab document\n')
        self.assertEqual(downloaded.headers['cache-control'], 'no-store')
        stored = Path(os.environ['DOCUMENT_STORAGE_DIR'], document_id + '.enc').read_bytes()
        self.assertNotIn(b'Private lab document', stored)
        async with self.sessions() as session:
            result = await session.execute(self.text('SELECT count(*) FROM audit_events WHERE document_id = :id'), {'id': UUID(document_id)})
            self.assertEqual(result.scalar_one(), 2)

    async def test_other_user_is_denied(self):
        await self.login()
        document_id = await self.upload()
        await self.client.post('/api/auth/logout')
        await self.login('other@example.com')
        listing = await self.client.get('/api/documents')
        self.assertEqual(listing.json()['data']['documents'], [])
        response = await self.client.get(f'/api/documents/{document_id}/download')
        self.assertEqual(response.status_code, 404, response.text)

    async def test_anonymous_denied(self):
        self.assertEqual((await self.client.get('/api/documents')).status_code, 401)
        response = await self.client.post('/api/documents/upload', files={'file': ('a.txt', b'hello')})
        self.assertEqual(response.status_code, 401)

    async def test_admin_self_registration_denied(self):
        response = await self.client.post('/api/auth/register', json={
            'email': 'admin@example.com', 'password': 'ProgressCheckPassword123!', 'role_id': 1})
        self.assertEqual(response.status_code, 400)

    async def test_logout_revokes_both_tokens(self):
        identity = await self.login()
        await self.client.post('/api/auth/logout')
        self.client.cookies.clear()
        response = await self.client.get('/api/auth/get-current-user', headers={'Authorization': 'Bearer ' + identity['accessToken']})
        self.assertEqual(response.status_code, 401)
        refreshed = await self.client.post('/api/auth/refresh-access-token', json={'refreshToken': identity['refreshToken']})
        self.assertEqual(refreshed.status_code, 401)

    async def test_invalid_files_rejected(self):
        await self.login()
        response = await self.client.post('/api/documents/upload', files={'file': ('fake.pdf', b'not PDF')})
        self.assertEqual(response.status_code, 415)
        response = await self.client.post('/api/documents/upload', files={'file': ('empty.txt', b'')})
        self.assertEqual(response.status_code, 400)
        response = await self.client.post('/api/documents/upload', files={'file': ('a.txt', b'ok')}, data={'classification': 'UNKNOWN'})
        self.assertEqual(response.status_code, 400)

    async def test_refresh(self):
        identity = await self.login()
        refreshed = await self.client.post('/api/auth/refresh-access-token')
        self.assertEqual(refreshed.status_code, 200, refreshed.text)
        self.assertEqual(refreshed.json()['data']['refreshToken'], identity['refreshToken'])
        self.assertEqual((await self.client.get('/api/auth/get-current-user')).status_code, 200)
