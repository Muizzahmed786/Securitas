import { useRef, useState } from 'react'
import type { FormEvent, DragEvent } from 'react'
import { CloudUpload, FileText, ShieldCheck, Upload as UploadIcon, CheckCircle2, X, Download } from 'lucide-react'
import { uploadDocument, errorMessage, saveBlob } from '../api/client'
import type { UploadReceipt } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { Alert, Card, PageHeading, CopyId, Empty, Spinner, formatDate, formatSize } from '../components/UI'
export default function Upload() {
  const { receipts, addReceipt } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [classification, setClassification] = useState('INTERNAL')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const input = useRef<HTMLInputElement>(null)
  function choose(selected?: File) {
    if (!selected) return
    setSuccess(''); setError('')
    if (!/\.(pdf|doc|docx)$/i.test(selected.name)) { setError('Choose a PDF, DOC or DOCX document.'); return }
    if (!selected.size || selected.size > 20 * 1024 * 1024) { setError('Choose a nonempty document no larger than 20 MiB.'); return }
    setFile(selected)
  }
  function drop(event: DragEvent) { event.preventDefault(); setDragging(false); if (!busy) choose(event.dataTransfer.files[0]) }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!file) return
    setBusy(true); setError(''); setSuccess('')
    try {
      const receipt = await uploadDocument(file, classification)
      addReceipt(receipt); setFile(null); if (input.current) input.current.value = ''
      setSuccess('Your document was uploaded and encrypted successfully. Save its receipt to keep the document ID.')
    } catch (e) { setError(errorMessage(e)) }
    finally { setBusy(false) }
  }
  function exportReceipt(receipt: UploadReceipt) { saveBlob(new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' }), `receipt-${receipt.id}.json`) }
  return <><PageHeading eyebrow="Document protection" title="Upload a document" description="Store a PDF or Word document with AES encryption and an RSA-protected encryption key." /><Alert message={error} /><Alert message={success} success /><div className="grid gap-6 lg:grid-cols-3"><Card className="lg:col-span-2"><form className="space-y-5" onSubmit={submit}><div className={`relative flex min-h-56 flex-col items-center justify-center rounded-xl border-2 border-dashed p-7 text-center transition ${dragging ? 'border-indigo-400 bg-indigo-50' : 'border-blue-200 bg-blue-50/20 hover:bg-blue-50/50'}`} onDragOver={e => { e.preventDefault(); if (!busy) setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={drop}><input ref={input} aria-label="Choose document" type="file" accept=".pdf,.doc,.docx" disabled={busy} onChange={e => choose(e.target.files?.[0])} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" /><span className="mb-4 rounded-2xl bg-blue-100/70 p-4 text-blue-600"><CloudUpload size={32} /></span><h2 className="font-semibold text-slate-700">Click to choose or drag & drop</h2><p className="mt-2 text-sm text-slate-400">PDF, DOC and DOCX · Maximum 20 MiB</p></div>{file && <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/30 p-4"><FileText className="shrink-0 text-blue-500" size={24} /><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-700">{file.name}</p><p className="mt-1 text-xs text-slate-400">{formatSize(file.size)}</p></div><button type="button" disabled={busy} aria-label="Remove selected document" className="ml-auto p-2 text-slate-400" onClick={() => { setFile(null); if (input.current) input.current.value = '' }}><X size={18} /></button></div>}<label className="field-label">Document classification<select className="input-style" value={classification} disabled={busy} onChange={e => setClassification(e.target.value)}>{['PUBLIC','INTERNAL','CONFIDENTIAL','RESTRICTED'].map(value => <option key={value}>{value}</option>)}</select></label><button className="btn-primary w-full" disabled={busy || !file}>{busy ? <Spinner /> : <UploadIcon size={17} />}{busy ? 'Uploading & encrypting…' : 'Encrypt & upload'}</button></form></Card><Card><ShieldCheck size={28} className="mb-4 text-blue-600" /><h2 className="section-heading">What happens to your file?</h2><div className="mt-5 space-y-5">{[['01','Validate','The server checks the file format, size and classification.'],['02','Encrypt','A fresh encryption key protects the document contents.'],['03','Store','Ciphertext is saved while metadata stays in the database.']].map(([number,title,description]) => <div key={number} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[11px] font-bold text-blue-600">{number}</span><div><h3 className="text-sm font-semibold text-slate-700">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-400">{description}</p></div></div>)}</div></Card></div><Card><h2 className="section-heading">Upload receipts</h2><p className="mt-1 text-xs leading-5 text-slate-400">Receipts shown here belong to this browser session. Save one to retain the document ID for signing or verification.</p>{receipts.length ? <div className="mt-5 overflow-x-auto"><table className="data-table"><thead><tr><th>Document</th><th>Classification</th><th>Uploaded</th><th>Receipt</th></tr></thead><tbody>{receipts.map(receipt => <tr key={receipt.id}><td><div className="flex items-center gap-2"><CheckCircle2 size={17} className="shrink-0 text-emerald-500" /><strong>{receipt.filename}</strong></div><CopyId value={receipt.id} /></td><td><span className="badge">{receipt.classification}</span></td><td>{formatDate(receipt.created_at)}</td><td><button className="btn-secondary" onClick={() => exportReceipt(receipt)}><Download size={15} />Save receipt</button></td></tr>)}</tbody></table></div> : <Empty title="No upload receipts yet" description="Successfully uploaded documents will appear here." />}</Card></>
}
