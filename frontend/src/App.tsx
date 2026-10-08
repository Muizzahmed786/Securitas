import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

type User = { id: number; email: string; role: string }
type Document = { id: string; filename: string; file_size_bytes: number; classification: string; created_at: string }

async function request(path: string, options: RequestInit = {}, retry = true): Promise<Response> {
  const response = await fetch('/api' + path, { ...options, credentials: 'include' })
  if (response.status === 401 && retry && !['/auth/login', '/auth/register', '/auth/refresh-access-token'].includes(path)) {
    const refreshed = await fetch('/api/auth/refresh-access-token', { method: 'POST', credentials: 'include' })
    if (refreshed.ok) return request(path, options, false)
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(typeof error.message === 'string' ? error.message : `Request failed (${response.status})`)
  }
  return response
}
async function json(path: string, options: RequestInit = {}) {
  return (await request(path, options)).json()
}
const size = (bytes: number) => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [checking, setChecking] = useState(true)
  const [register, setRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [classification, setClassification] = useState('INTERNAL')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function loadDocuments() {
    const result = await json('/documents')
    setDocuments(result.data.documents)
  }
  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const identity = await json('/auth/get-current-user')
        if (!active) return
        setUser(identity.data)
        const result = await json('/documents')
        if (active) setDocuments(result.data.documents)
      } catch { /* An anonymous visitor sees the login form. */ }
      finally { if (active) setChecking(false) }
    })()
    return () => { active = false }
  }, [])

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true); setError(''); setNotice('')
    const options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }
    try {
      if (register) {
        await json('/auth/register', options)
        setRegister(false)
        setNotice('Account created. Sign in to open your workspace.')
        setPassword('')
      } else {
        const result = await json('/auth/login', options)
        setUser(result.data.user); setPassword('')
        await loadDocuments()
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to sign in') }
    finally { setBusy(false) }
  }
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file) return
    if (file.size > 20 * 1024 * 1024) { setError('Choose a file smaller than 20 MiB.'); return }
    setBusy(true); setError(''); setNotice('')
    const form = event.currentTarget
    try {
      const body = new FormData(); body.append('file', file); body.append('classification', classification)
      await json('/documents/upload', { method: 'POST', body })
      setFile(null); form.reset(); setClassification('INTERNAL')
      await loadDocuments()
      setNotice('Document encrypted and saved.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed') }
    finally { setBusy(false) }
  }
  async function download(document: Document) {
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await request(`/documents/${document.id}/download`)
      const url = URL.createObjectURL(await response.blob())
      const link = window.document.createElement('a'); link.href = url; link.download = document.filename
      window.document.body.appendChild(link); link.click(); link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 10000)
      setNotice(`${document.filename} downloaded.`)
    } catch (e) { setError(e instanceof Error ? e.message : 'Download failed') }
    finally { setBusy(false) }
  }
  async function provisionKey() {
    setBusy(true); setError(''); setNotice('')
    try {
      await json('/crypto-keys/wrapping', { method: 'POST' })
      setNotice('Document encryption is ready. You can now upload files.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Setup failed') }
    finally { setBusy(false) }
  }
  async function logout() {
    setBusy(true); setError('')
    try {
      await json('/auth/logout', { method: 'POST' })
      setUser(null); setDocuments([]); setNotice('Signed out.'); setFile(null)
    } catch (e) { setError(e instanceof Error ? e.message : 'Sign out failed') }
    finally { setBusy(false) }
  }
  return <div className="app">
    <header className="topbar"><a className="brand" href="/"><span className="brand-icon" aria-hidden="true">S</span>Securitas</a><span className="top-caption">YOUR DOCUMENTS, PROTECTED</span>
      {user && <button className="quiet" disabled={busy} onClick={() => void logout()}>Sign out</button>}</header>
    <main>
      {checking ? <p role="status">Opening your workspace…</p> : <>
        <div className="intro"><span className="eyebrow">SECURE DOCUMENT WORKSPACE</span><h1>{user ? 'Your private document vault.' : 'Keep your work in safe hands.'}</h1><p>{user ? 'Upload encrypted files and retrieve the originals when you need them.' : 'A private workspace for storing and accessing your documents.'}</p></div>
        {error && <div className="message error" role="alert">{error}</div>}
        {notice && <div className="message success" role="status">{notice}</div>}
        {!user ? <section className="auth-grid"><div className="card auth-card"><h2>{register ? 'Create your account' : 'Welcome back'}</h2><p className="muted">{register ? 'Your account can upload and manage its own documents.' : 'Sign in to access your documents.'}</p>
          <form onSubmit={authenticate}><label>Email<input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label><label>Password<input type="password" required minLength={register ? 12 : undefined} autoComplete={register ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} placeholder={register ? 'At least 12 characters' : 'Enter your password'} /></label><button className="primary" disabled={busy}>{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</button></form>
          <button className="text-button" disabled={busy} onClick={() => { setRegister(!register); setError(''); setNotice('') }}>{register ? 'Already have an account? Sign in' : 'New here? Create an account'}</button></div>
          <aside className="benefits"><span className="vault-art" aria-hidden="true">▣</span><h2>A workspace built around privacy.</h2><p>Files are encrypted before they are saved. Your document list and downloads are restricted to your account.</p><div className="benefit"><strong>Encrypted storage</strong><span>File contents stay protected on disk.</span></div><div className="benefit"><strong>Private access</strong><span>Only you can retrieve your uploads.</span></div></aside></section> : <>
          <div className="account"><span className="avatar">{user.email[0].toUpperCase()}</span><div><strong>{user.email}</strong><span>{user.role.replaceAll('_', ' ').toLowerCase()}</span></div><span className="badge">Private workspace</span></div>
          {user.role === 'ADMIN' && <div className="setup card"><div><strong>Storage setup</strong><p className="muted">Initialize document encryption once before the first upload.</p></div><button className="secondary" disabled={busy} onClick={() => void provisionKey()}>Initialize encryption</button></div>}
          <section className="card upload-card"><div><span className="eyebrow">ADD TO YOUR VAULT</span><h2>Upload a document</h2><p className="muted">TXT, PDF, DOC or DOCX · Up to 20 MiB</p></div><form onSubmit={upload}><label className="file-label">Choose a document<input type="file" required accept=".txt,.pdf,.doc,.docx" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label><label>Classification<select value={classification} onChange={e => setClassification(e.target.value)}>{['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'].map(value => <option key={value}>{value}</option>)}</select></label><button className="primary" disabled={busy || !file}>{busy ? 'Please wait…' : 'Encrypt & upload'}</button></form></section>
          <section className="card documents-card"><div className="section-title"><div><h2>My documents</h2><p className="muted">{documents.length} {documents.length === 1 ? 'document' : 'documents'} in your vault</p></div><button className="quiet" disabled={busy} onClick={() => void loadDocuments().catch(e => setError(e.message))}>Refresh</button></div>
            {documents.length === 0 ? <div className="empty"><span aria-hidden="true">▤</span><h3>Your vault is ready.</h3><p>Upload your first document to get started.</p></div> : <div className="table-scroll"><table><thead><tr><th>Document</th><th>Classification</th><th>Added</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{documents.map(document => <tr key={document.id}><td><strong>{document.filename}</strong><span className="file-meta">{size(document.file_size_bytes)}</span></td><td><span className="classification">{document.classification}</span></td><td>{new Date(document.created_at).toLocaleDateString()}</td><td><button className="secondary" disabled={busy} onClick={() => void download(document)}>Download</button></td></tr>)}</tbody></table></div>}
          </section></>}
      </>}
    </main><footer>Securitas · Secure document management</footer>
  </div>
}
