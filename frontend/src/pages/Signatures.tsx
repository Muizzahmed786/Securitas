import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { KeyRound, PenLine, ShieldCheck, RefreshCw, Download, Ban, CheckCircle2, AlertTriangle } from 'lucide-react';
import { signatures, errorMessage, saveBlob } from '../api/client';
import type { SigningKey, Verification } from '../api/client';
import { normalizeSignature, signLocally } from '../api/signing';
import { useAuth } from '../context/AuthContext';
import { Alert, Card, CopyId, Empty, PageHeading, Spinner, formatDate, validUUID } from '../components/UI';

type Tab = 'keys' | 'sign' | 'verify';

export default function Signatures() {
  const { can, receipts } = useAuth();
  const canSign = can('documents.sign'), canVerify = can('documents.verify');
  const [tab, setTab] = useState<Tab>('keys');
  const activeTab = tab === 'verify' ? (canVerify ? 'verify' : 'keys') : (canSign ? tab : 'verify');
  const [keys, setKeys] = useState<SigningKey[]>([]);
  const [keyId, setKeyId] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [original, setOriginal] = useState<File | null>(null);
  const [privateFile, setPrivateFile] = useState<File | null>(null);
  const [external, setExternal] = useState(false);
  const [signature, setSignature] = useState('');
  const [verification, setVerification] = useState<Verification | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [fileVersion, setFileVersion] = useState(0);
  const actionLock = useRef(false);
  const keyRequest = useRef(0);

  const chooseKey = useCallback((result: SigningKey[], preferred?: string) => {
    setKeys(result);
    setKeyId(previous => {
      const candidate = preferred || previous;
      return result.some(key => key.id === candidate && key.usable_for_signing)
        ? candidate : result.find(key => key.usable_for_signing)?.id || '';
    });
  }, []);
  useEffect(() => {
    const request = ++keyRequest.current;
    let active = true;
    if (!canSign) { setKeys([]); setKeyId(''); setLoadingKeys(false); return; }
    setLoadingKeys(true);
    signatures.keys().then(result => {
      if (active && request === keyRequest.current) chooseKey(result);
    }).catch(e => {
      if (active && request === keyRequest.current) setError(errorMessage(e));
    }).finally(() => {
      if (active && request === keyRequest.current) setLoadingKeys(false);
    });
    return () => { active = false; };
  }, [canSign, chooseKey]);

  async function reload(preferred?: string) {
    const request = ++keyRequest.current;
    setLoadingKeys(true);
    try {
      const result = await signatures.keys();
      if (request === keyRequest.current) chooseKey(result, preferred);
    } catch (e) {
      if (request === keyRequest.current) setError(`Could not refresh signing keys: ${errorMessage(e)}`);
    } finally {
      if (request === keyRequest.current) setLoadingKeys(false);
    }
  }
  function begin() {
    if (actionLock.current) return false;
    actionLock.current = true;
    setBusy(true); setError(''); setNotice('');
    return true;
  }
  function finish() { actionLock.current = false; setBusy(false); }
  function clearFiles() { setOriginal(null); setPrivateFile(null); setSignature(''); setFileVersion(v => v + 1); }
  function changeTab(next: Tab) {
    setTab(next); setError(''); setNotice(''); setVerification(null); setPassphrase(''); clearFiles();
  }
  async function generate(event: FormEvent) {
    event.preventDefault();
    if (!begin()) return;
    try {
      const length = new TextEncoder().encode(passphrase).length;
      if (passphrase && (length < 12 || length > 128)) throw new Error('Passphrase must contain 12–128 UTF-8 bytes.');
      const response = await signatures.generate(passphrase);
      const headerId = String(response.headers['x-signing-key-id'] || '').trim();
      const disposition = String(response.headers['content-disposition'] || '');
      const filenameId = disposition.match(/signing-([0-9a-f-]{36})\.pem/i)?.[1] || '';
      const id = validUUID(headerId) ? headerId : validUUID(filenameId) ? filenameId : '';
      saveBlob(response.data, id ? `signing-${id}.pem` : 'signing-private-key.pem');
      setPassphrase('');
      setNotice('Key created and download requested. Confirm the PEM is saved; the server cannot provide it again.' +
        (id ? '' : ' The key ID header was unavailable; select the new key from the refreshed list.'));
      await reload(id);
    } catch (e) { setError(errorMessage(e)); }
    finally { finish(); }
  }
  async function revoke(key: SigningKey) {
    if (!window.confirm('Revoke this signing key? Its public key and existing signatures will be retained.')) return;
    if (!begin()) return;
    try {
      await signatures.revoke(key.id);
      setNotice('Signing key revoked.');
      await reload();
    } catch (e) { setError(errorMessage(e)); }
    finally { finish(); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!begin()) return;
    try {
      const id = documentId.trim();
      if (!validUUID(id)) throw new Error('Enter a valid document ID.');
      const selected = keys.find(key => key.id === keyId && key.usable_for_signing);
      if (!selected || selected.algorithm !== 'RSA-PSS-SHA256') throw new Error('Select an active RSA-PSS-SHA256 signing key.');
      let signed: string;
      if (external) signed = normalizeSignature(signature);
      else {
        if (!original || !privateFile) throw new Error('Choose the original document and your private-key PEM.');
        signed = await signLocally(original, privateFile, selected.public_key_pem);
      }
      await signatures.submit(id, selected.id, signed);
      setNotice('The server verified your signature against its stored document and saved it.');
      setVerification(null); clearFiles();
    } catch (e) { setError(errorMessage(e)); }
    finally { finish(); }
  }
  async function verify(event: FormEvent) {
    event.preventDefault();
    if (!begin()) return;
    setVerification(null);
    try {
      if (!validUUID(documentId.trim())) throw new Error('Enter a valid document ID.');
      setVerification(await signatures.verify(documentId.trim()));
    } catch (e) { setError(errorMessage(e)); }
    finally { finish(); }
  }

  const tabs = [
    { key: 'keys' as const, label: 'Signing Keys', icon: KeyRound, show: canSign },
    { key: 'sign' as const, label: 'Sign Document', icon: PenLine, show: canSign },
    { key: 'verify' as const, label: 'Verify Signatures', icon: ShieldCheck, show: canVerify },
  ].filter(item => item.show);
  const documentField = <label className="field-label">Document ID
    <input className="input-style font-mono text-xs" required placeholder="UUID from an upload receipt" value={documentId}
      onChange={e => { setDocumentId(e.target.value); setVerification(null); }} list="session-document-ids" />
    <datalist id="session-document-ids">{receipts.map(receipt => <option key={receipt.id} value={receipt.id}>{receipt.filename}</option>)}</datalist>
  </label>;

  return <>
    <PageHeading eyebrow="Document authenticity" title="Digital signatures"
      description="Download your signing key once, sign locally after upload, and verify stored documents." />
    {!tabs.length && <Empty title="Signatures unavailable" description="Your account has no signing or verification permission." />}
    <div className="flex flex-wrap gap-2 rounded-xl border border-blue-100 bg-white p-2">
      {tabs.map(({key, label, icon: Icon}) => <button key={key} disabled={busy} onClick={() => changeTab(key)}
        className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold ${activeTab === key ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-blue-50'}`}>
        <Icon size={16} />{label}</button>)}
    </div>
    <Alert message={error} /><Alert message={notice} success />
    {activeTab === 'keys' && canSign && <>
      <Card>
        <h2 className="section-heading">Create a signing key</h2>
        <p className="my-3 text-sm text-slate-500">The server stores your public key. Save the private PEM download on your device.</p>
        <form onSubmit={generate}><fieldset disabled={busy} className="space-y-4">
          <label className="field-label">Private-key passphrase (optional)
            <input className="input-style" type="password" autoComplete="new-password" placeholder="Leave blank for browser signing"
              value={passphrase} onChange={e => setPassphrase(e.target.value)} /></label>
          <p className="text-xs leading-5 text-slate-500">Leave blank to sign with the browser tool. A passphrase encrypts the PEM; use a compatible local tool and Submit existing signature for encrypted keys. Protect an unencrypted PEM on your device.</p>
          <button className="btn-primary">{busy ? <Spinner /> : <Download size={17} />}Create & download private key</button>
        </fieldset></form>
      </Card>
      <Card>
        <div className="flex items-center justify-between"><h2 className="section-heading">Your signing keys</h2>
          <button className="btn-secondary" disabled={busy || loadingKeys} onClick={() => void reload()}><RefreshCw size={15} />Refresh</button></div>
        {loadingKeys ? <p role="status" className="mt-5 flex gap-2"><Spinner />Loading keys…</p> : keys.length ?
          <div className="mt-5 overflow-x-auto"><table className="data-table"><thead><tr><th>Key ID</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>{keys.map(key => <tr key={key.id}>
              <td><CopyId value={key.id} /><p className="text-xs text-slate-400">{key.algorithm}</p></td>
              <td>{key.status}{!key.usable_for_signing && <p className="text-xs text-slate-400">Not usable for new signatures</p>}</td>
              <td>{formatDate(key.created_at)}</td><td><div className="flex flex-wrap gap-2">
                <button className="btn-secondary" onClick={() => saveBlob(new Blob([key.public_key_pem], {type: 'text/plain'}), `signing-public-${key.id}.pem`)}><Download size={14} />Public key</button>
                {key.usable_for_signing && <button className="btn-secondary" disabled={busy} onClick={() => { changeTab('sign'); setKeyId(key.id); }}><PenLine size={14} />Use key</button>}
                {key.status !== 'REVOKED' && <button className="btn-secondary !text-red-500" disabled={busy} onClick={() => void revoke(key)}><Ban size={14} />Revoke</button>}
              </div></td></tr>)}</tbody></table></div> : <Empty title="No signing keys yet" description="Create a key and save the downloaded private PEM." />}
      </Card>
    </>}
    {activeTab === 'sign' && canSign && <Card>
      <form onSubmit={submit}><fieldset disabled={busy} className="max-w-3xl space-y-5">
        {documentField}
        <label className="field-label">Signing key<select className="input-style" required value={keyId} onChange={e => setKeyId(e.target.value)}>
          <option value="">Select an active key</option>{keys.filter(key => key.usable_for_signing).map(key => <option key={key.id} value={key.id}>{key.id}</option>)}
        </select></label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={external ? 'btn-secondary' : 'btn-primary'} onClick={() => { setExternal(false); clearFiles(); }}>Sign in this browser</button>
          <button type="button" className={external ? 'btn-primary' : 'btn-secondary'} onClick={() => { setExternal(true); clearFiles(); }}>Submit existing signature</button>
        </div>
        {external ? <label className="field-label">Base64 signature
          <textarea className="input-style min-h-32 font-mono text-xs" required maxLength={2048} value={signature} onChange={e => setSignature(e.target.value)} placeholder="RSA-PSS / SHA-256, 32-byte salt; sign the original file bytes" />
        </label> : <div key={fileVersion} className="space-y-5">
          <label className="field-label">Original document<input className="input-style" type="file" required accept=".pdf,.doc,.docx" onChange={e => setOriginal(e.target.files?.[0] || null)} /></label>
          <label className="field-label">Downloaded private-key PEM<input className="input-style" type="file" required accept=".pem" onChange={e => setPrivateFile(e.target.files?.[0] || null)} /></label>
          <p className="rounded-xl border border-blue-100 bg-blue-50/30 p-4 text-xs leading-5 text-slate-500">Choose the exact original file you uploaded and the private PEM matching your selected key. Both files stay in this browser. Only the signature and key ID are sent for this document ID.</p>
        </div>}
        <button className="btn-primary" disabled={busy || loadingKeys || !keyId}>{busy ? <Spinner /> : <PenLine size={17} />}{busy ? 'Processing signature…' : external ? 'Submit signature' : 'Sign locally & submit'}</button>
      </fieldset></form>
    </Card>}
    {activeTab === 'verify' && canVerify && <>
      <Card><form onSubmit={verify}><fieldset disabled={busy} className="max-w-3xl space-y-5">{documentField}
        <button className="btn-primary">{busy ? <Spinner /> : <ShieldCheck size={17} />}{busy ? 'Checking…' : 'Verify stored document'}</button>
      </fieldset></form></Card>
      {verification && <Card>
        <h2 className="section-heading">Verification results</h2><CopyId value={verification.document_id} />
        <p className={`my-4 font-semibold ${verification.document_integrity_valid ? 'text-emerald-700' : 'text-red-600'}`}>
          {verification.document_integrity_valid ? 'Stored document integrity verified' : 'Stored document integrity check failed'}</p>
        {verification.has_signatures ? <div className="space-y-4">{verification.signatures.map(item => <div key={item.id} className="rounded-xl border border-slate-200 p-4">
          <p className={`flex items-center gap-2 font-semibold ${item.cryptographically_valid ? 'text-emerald-700' : 'text-red-600'}`}>
            {item.cryptographically_valid ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}{item.cryptographically_valid ? 'Signature valid' : 'Signature invalid'}</p>
          <CopyId value={item.signing_key_id} />
          <p className="mt-2 text-xs text-slate-400">Recorded {formatDate(item.signed_at)} · Key status: {item.key_status}</p>
          {!item.key_usable_now && <p className="mt-2 text-xs text-amber-600">This key cannot create new signatures. The historical signature result is shown above.</p>}
        </div>)}</div> : <Empty title="No signatures recorded" description="An unsigned document does not have a signature to verify." />}
      </Card>}
    </>}
  </>;
}
