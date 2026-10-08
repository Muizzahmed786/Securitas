import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { KeyRound, PenLine, ShieldCheck, RefreshCw, Download, Ban, CheckCircle2, AlertTriangle } from 'lucide-react'
import { signatures, errorMessage, saveBlob } from '../api/client'
import type { SigningKey, Verification } from '../api/client'
import { signLocally } from '../api/signing'
import { useAuth } from '../context/AuthContext'
import { Alert, Card, CopyId, Empty, PageHeading, Spinner, formatDate, validUUID } from '../components/UI'

export default function Signatures() {
  const { can, receipts } = useAuth()
  const canSign = can('documents.sign'), canVerify = can('documents.verify')
  const [tab, setTab] = useState<'keys' | 'sign' | 'verify'>(canSign ? 'keys' : 'verify')
  const [keys, setKeys] = useState<SigningKey[]>([])
  const [keyId, setKeyId] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [documentId, setDocumentId] = useState('')
  const [original, setOriginal] = useState<File | null>(null)
  const [privateFile, setPrivateFile] = useState<File | null>(null)
  const [external, setExternal] = useState(false)
  const [signature, setSignature] = useState('')
  const [verification, setVerification] = useState<Verification | null>(null)
  const [busy, setBusy] = useState(false)
  const [loadingKeys, setLoadingKeys] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    let active = true
    if (canSign) {
      setLoadingKeys(true)
      signatures.keys().then(result => { if (active) { setKeys(result); setKeyId(result.find(key => key.usable_for_signing)?.id || '') } })
        .catch(e => { if (active) setError(errorMessage(e)) }).finally(() => { if (active) setLoadingKeys(false) })
    }
    return () => { active = false }
  }, [canSign])
  async function reload() {
    setLoadingKeys(true)
    try { const result = await signatures.keys(); setKeys(result); setKeyId(previous => result.some(key => key.id === previous && key.usable_for_signing) ? previous : result.find(key => key.usable_for_signing)?.id || '') }
    catch (e) { setError(errorMessage(e)) }
    finally { setLoadingKeys(false) }
  }
  async function generate(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try {
      const length = new TextEncoder().encode(passphrase).length
      if (passphrase && (length < 12 || length > 128)) throw new Error('Passphrase must contain 12–128 UTF-8 bytes.')
      const response = await signatures.generate(passphrase)
      const id = response.headers['x-signing-key-id'] as string | undefined
      saveBlob(response.data, `signing-${id || 'private-key'}.pem`)
      setPassphrase(''); setNotice('Signing key created. Keep the downloaded private-key file safe; it cannot be downloaded again.')
      await reload()
    } catch (e) { setError(errorMessage(e)) }
    finally { setBusy(false) }
  }
  async function revoke(key: SigningKey) {
    if (!window.confirm('Revoke this signing key? It will no longer be usable for new signatures. Existing signatures and the public key are retained.')) return
    setBusy(true); setError(''); setNotice('')
    try { await signatures.revoke(key.id); setNotice('Signing key revoked.'); await reload() }
    catch (e) { setError(errorMessage(e)) }
    finally { setBusy(false) }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); const form = event.currentTarget as HTMLFormElement; setBusy(true); setError(''); setNotice('')
    try {
      if (!validUUID(documentId)) throw new Error('Enter a valid document ID from an upload receipt.')
      if (!keyId) throw new Error('Select an active signing key first.')
      let signed = signature.trim()
      if (!external) {
        if (!original || !privateFile) throw new Error('Choose the original document and your private-key PEM.')
        signed = await signLocally(original, privateFile)
      }
      if (!signed || signed.length > 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(signed)) throw new Error('Enter a standard Base64 signature of at most 1024 characters.')
      await signatures.submit(documentId.trim(), keyId, signed)
      setNotice('Signature verified by the server and saved for this document.')
      setSignature(''); setOriginal(null); setPrivateFile(null)
      form.querySelectorAll<HTMLInputElement>('input[type="file"]').forEach(input => { input.value = '' })
    } catch (e) { setError(errorMessage(e)) }
    finally { setBusy(false) }
  }
  async function verify(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice(''); setVerification(null)
    try {
      if (!validUUID(documentId)) throw new Error('Enter a valid document ID from an upload receipt.')
      setVerification(await signatures.verify(documentId.trim()))
    } catch (e) { setError(errorMessage(e)) }
    finally { setBusy(false) }
  }
  function changeTab(next: typeof tab) { setTab(next); setError(''); setNotice(''); setVerification(null); setPrivateFile(null); setOriginal(null); setSignature('') }
  const tabs = [{ key: 'keys' as const, label: 'Signing Keys', icon: KeyRound, show: canSign }, { key: 'sign' as const, label: 'Sign Document', icon: PenLine, show: canSign }, { key: 'verify' as const, label: 'Verify Signatures', icon: ShieldCheck, show: canVerify }].filter(item => item.show)
  const documentField = <label className="field-label">Document ID<input aria-label="Document ID" className="input-style font-mono text-xs" required placeholder="UUID from an upload receipt" value={documentId} onChange={e => { setDocumentId(e.target.value); setVerification(null) }} list="session-document-ids" /><datalist id="session-document-ids">{receipts.map(receipt => <option key={receipt.id} value={receipt.id}>{receipt.filename}</option>)}</datalist></label>
  return <><PageHeading eyebrow="Document authenticity" title="Digital signatures" description="Create personal signing keys, sign your documents, and check stored signatures." /><div className="flex flex-wrap gap-2 rounded-xl border border-blue-100 bg-white p-2">{tabs.map(({ key, label, icon: Icon }) => <button key={key} disabled={busy} onClick={() => changeTab(key)} className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold ${tab === key ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-blue-50'}`}><Icon size={16} />{label}</button>)}</div><Alert message={error} /><Alert message={notice} success />
    {tab === 'keys' && canSign && <><Card><div className="mb-5 flex items-center gap-3"><span className="rounded-xl bg-violet-50 p-3 text-violet-600"><KeyRound size={23} /></span><div><h2 className="section-heading">Create a signing key</h2><p className="mt-1 text-xs text-slate-400">The public key is registered. The private key is downloaded once.</p></div></div><form onSubmit={generate} className="space-y-4"><label className="field-label">Private-key passphrase <span className="font-normal text-slate-400">(optional)</span><input className="input-style" type="password" autoComplete="new-password" placeholder="Leave blank for browser signing" value={passphrase} onChange={e => setPassphrase(e.target.value)} /></label><p className="max-w-3xl text-xs leading-5 text-slate-500">An empty passphrase creates a PEM key usable by the browser signing tool. A passphrase protects the downloaded file, but signing with it requires a compatible local tool and the existing-signature option.</p><button disabled={busy} className="btn-primary">{busy ? <Spinner /> : <Download size={17} />}{busy ? 'Generating key…' : 'Create & download private key'}</button></form></Card><Card><div className="flex items-center justify-between gap-3"><h2 className="section-heading">Your signing keys</h2><button className="btn-secondary" disabled={busy || loadingKeys} onClick={() => void reload()}><RefreshCw size={15} />Refresh</button></div>{loadingKeys ? <p role="status" className="mt-6 flex items-center gap-2 text-sm text-slate-400"><Spinner />Loading signing keys…</p> : keys.length ? <div className="mt-5 overflow-x-auto"><table className="data-table"><thead><tr><th>Key ID</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody>{keys.map(key => <tr key={key.id}><td><CopyId value={key.id} /><p className="text-xs text-slate-400">{key.algorithm}</p></td><td><span className={`badge ${key.usable_for_signing ? '!bg-emerald-50 !text-emerald-700' : '!bg-slate-100 !text-slate-500'}`}>{key.status}</span>{!key.usable_for_signing && key.status === 'ACTIVE' && <p className="mt-1 text-xs text-slate-400">Not usable for signing</p>}</td><td>{formatDate(key.created_at)}</td><td><div className="flex gap-2"><button className="btn-secondary" onClick={() => saveBlob(new Blob([key.public_key_pem], { type: 'text/plain' }), `signing-public-${key.id}.pem`)}><Download size={14} />Public key</button>{key.usable_for_signing && <button disabled={busy} className="btn-secondary !text-red-500" onClick={() => void revoke(key)}><Ban size={14} />Revoke</button>}</div></td></tr>)}</tbody></table></div> : <Empty title="No signing keys yet" description="Create a signing key to sign your documents." />}</Card></>}
    {tab === 'sign' && canSign && <Card><form onSubmit={submit} className="max-w-3xl space-y-5">{documentField}<label className="field-label">Signing key<select aria-label="Signing key" className="input-style" required value={keyId} onChange={e => setKeyId(e.target.value)}><option value="">Select an active key</option>{keys.filter(key => key.usable_for_signing).map(key => <option key={key.id} value={key.id}>{key.id}</option>)}</select></label><div className="flex flex-wrap gap-2"><button type="button" className={external ? 'btn-secondary' : 'btn-primary'} disabled={busy} onClick={() => setExternal(false)}>Sign in this browser</button><button type="button" className={external ? 'btn-primary' : 'btn-secondary'} disabled={busy} onClick={() => setExternal(true)}>Submit existing signature</button></div>{external ? <label className="field-label">Base64 signature<textarea className="input-style min-h-32 font-mono text-xs" required maxLength={1024} value={signature} onChange={e => setSignature(e.target.value)} placeholder="Paste an RSA-PSS-SHA256 signature with a 32-byte salt" /></label> : <><label className="field-label">Original document<input className="input-style" type="file" required accept=".pdf,.doc,.docx" onChange={e => setOriginal(e.target.files?.[0] || null)} /></label><label className="field-label">Signing private-key PEM<input className="input-style" type="file" required accept=".pem" onChange={e => setPrivateFile(e.target.files?.[0] || null)} /></label><p className="rounded-xl border border-blue-100 bg-blue-50/30 p-4 text-xs leading-5 text-slate-500">Use the exact original file that was uploaded. The document and private key are read locally in your browser. Only the resulting signature and key ID are submitted; the server checks the signature against its stored document.</p></>}<button className="btn-primary" disabled={busy || loadingKeys || !keyId}>{busy ? <Spinner /> : <PenLine size={17} />}{busy ? 'Signing & submitting…' : external ? 'Submit signature' : 'Sign & submit'}</button></form></Card>}
    {tab === 'verify' && canVerify && <><Card><form onSubmit={verify} className="max-w-3xl space-y-5">{documentField}<button className="btn-primary" disabled={busy}>{busy ? <Spinner /> : <ShieldCheck size={17} />}{busy ? 'Checking signatures…' : 'Verify signatures'}</button></form></Card>{verification && <Card><div className="mb-4 flex items-center gap-3"><ShieldCheck size={25} className="text-blue-600" /><h2 className="section-heading">Verification results</h2></div><CopyId value={verification.document_id} />{verification.has_signatures ? <div className="mt-5 space-y-4">{verification.signatures.map(item => <div key={item.id} className="rounded-xl border border-slate-200 p-4"><p className={`flex items-center gap-2 text-sm font-semibold ${item.cryptographically_valid ? 'text-emerald-700' : 'text-red-600'}`}>{item.cryptographically_valid ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}{item.cryptographically_valid ? 'Signature valid' : 'Signature invalid'}</p><div className="mt-3"><CopyId value={item.signing_key_id} /></div><p className="mt-2 text-xs text-slate-400">Signed {formatDate(item.signed_at)} · Key status: {item.key_status}</p>{!item.key_usable_now && <p className="mt-2 text-xs text-amber-600">This key cannot create new signatures. Its historical signature result is shown above.</p>}</div>)}</div> : <Empty title="No signatures on this document" description="The document was accessible, but no signatures have been recorded." />}</Card>}</>}
  </>
}
