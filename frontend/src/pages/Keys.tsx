import { useState } from 'react'
import { KeyRound, ShieldCheck, CheckCircle2 } from 'lucide-react'
import { createWrappingKey, errorMessage, saveBlob } from '../api/client'
import { Alert, Card, CopyId, PageHeading, Spinner } from '../components/UI'
export default function Keys() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [key, setKey] = useState<Awaited<ReturnType<typeof createWrappingKey>> | null>(null)
  async function create() {
    setBusy(true); setError('')
    try { setKey(await createWrappingKey()) }
    catch (e) { setError(errorMessage(e)) }
    finally { setBusy(false) }
  }
  return <><PageHeading eyebrow="Administrator tools" title="Encryption setup" description="Create the system RSA wrapping key used to protect document encryption keys." /><Alert message={error} /><div className="grid gap-6 lg:grid-cols-3"><Card className="lg:col-span-2"><span className="mb-4 inline-flex rounded-xl bg-blue-50 p-3 text-blue-600"><KeyRound size={28} /></span><h2 className="section-heading">Initialize document encryption</h2><p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">Run this once before the first document upload. The server creates an RSA key pair and stores the encrypted private key in its protected key directory.</p><div className="my-6 rounded-xl border border-blue-100 bg-blue-50/30 p-4 text-sm text-slate-500">If a wrapping key is already configured, the server will report that it exists. Existing keys are kept; this action does not rotate them.</div><button className="btn-primary" disabled={busy || !!key} onClick={() => void create()}>{busy ? <Spinner /> : <KeyRound size={17} />}{busy ? 'Creating key…' : 'Initialize encryption'}</button>{key && <div className="mt-6 space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-5"><p className="flex items-center gap-2 font-semibold text-emerald-700"><CheckCircle2 size={19} />Encryption initialized</p><CopyId value={key.id} /><p className="text-xs text-slate-500">{key.algorithm}</p><button className="btn-secondary" onClick={() => saveBlob(new Blob([key.public_key_pem], { type: 'text/plain' }), `wrapping-public-${key.id}.pem`)}>Save public key</button></div>}</Card><Card><ShieldCheck size={26} className="mb-4 text-blue-600" /><h2 className="section-heading">Private keys stay protected</h2><p className="mt-3 text-sm leading-6 text-slate-500">The wrapping private key is never returned to the browser. Your administrator must configure its storage directory and passphrase on the server before initialization.</p></Card></div></>
}
