import { Link } from "react-router-dom";
import {
  ShieldCheck,
  LockKeyhole,
  FileText,
  PenLine,
  ArrowRight,
  KeyRound,
} from "lucide-react";
export default function Landing() {
  return (
    <div className="min-h-screen bg-blue-50/40 text-slate-800">
      <header className="border-b border-blue-100 bg-white/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between p-5">
          <Link
            to="/home"
            className="flex items-center gap-2 text-xl font-bold"
          >
            <ShieldCheck className="text-blue-600" />
            Securitas
          </Link>
          <Link className="btn-secondary" to="/login">
            Sign in
            <ArrowRight size={15} />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="badge">SECURE DOCUMENT WORKSPACE</span>
            <h1 className="mt-6 text-4xl leading-tight font-bold tracking-tight sm:text-5xl">
              Your documents.
              <br />
              <span className="text-blue-600">Protected at every step.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-500">
              Encrypt sensitive documents, protect their keys, and verify
              authenticity with digital signatures.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register" className="btn-primary">
                Create your account
                <ArrowRight size={17} />
              </Link>
              <Link to="/login" className="btn-secondary">
                Open workspace
              </Link>
            </div>
          </div>
          <div className="rounded-3xl border border-blue-100 bg-white p-8 shadow-xl shadow-blue-100/60">
            <div className="mb-8 flex items-center gap-3">
              <span className="rounded-2xl bg-blue-50 p-4 text-blue-600">
                <ShieldCheck size={35} />
              </span>
              <div>
                <h2 className="text-lg font-bold">Secure document storage</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Confidentiality. Authenticity. Access control.
                </p>
              </div>
            </div>
            {[
              {
                icon: FileText,
                title: "Upload",
                desc: "Choose a PDF or Word document.",
              },
              {
                icon: LockKeyhole,
                title: "Encrypt",
                desc: "Protect contents with AES-GCM.",
              },
              {
                icon: PenLine,
                title: "Sign",
                desc: "Add and verify digital signatures.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="mt-4 flex items-center gap-4 rounded-xl border border-blue-100 bg-blue-50/20 p-4"
              >
                <Icon size={21} className="text-blue-500" />
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="mt-1 text-xs text-slate-400">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-20 grid gap-5 sm:grid-cols-3">
          {[
            {
              icon: LockKeyhole,
              title: "Encrypted uploads",
              desc: "Document contents are encrypted before storage.",
            },
            {
              icon: KeyRound,
              title: "Protected keys",
              desc: "RSA wrapping protects each document encryption key.",
            },
            {
              icon: PenLine,
              title: "Digital signatures",
              desc: "Check document authenticity with registered public keys.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <section
              key={title}
              className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm"
            >
              <Icon size={26} className="mb-4 text-blue-600" />
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">{desc}</p>
            </section>
          ))}
        </div>
      </main>
      <footer className="border-t border-blue-100 p-6 text-center text-xs text-slate-400">
        Securitas · Secure document management
      </footer>
    </div>
  );
}
