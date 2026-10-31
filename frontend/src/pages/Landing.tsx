import { useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  XCircle,
  ChevronRight,
  Menu,
  X,
  Shield,
} from "lucide-react";
import ComparisonGraphs, {
  COMPARISON_DATA,
} from "../components/landing/ComparisonGraphs";

export default function Landing() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [timeFilter, setTimeFilter] = useState<"24H" | "7D" | "30D" | "ALL">("30D");
  const [interactiveRisk, setInteractiveRisk] = useState<"low" | "medium" | "high">("low");
  const [comparisonView, setComparisonView] = useState<"both" | "graphs" | "table">("both");
  const [selectedDimensionId, setSelectedDimensionId] = useState<string>("custody");

  const workflowSteps = [
    {
      step: "01",
      name: "Ingest & DEK Generation",
      tag: "AES-256-GCM",
      title: "Ephemeral Encryption at Rest",
      desc: "When a document is uploaded, an ephemeral 256-bit Data Encryption Key (DEK) is generated via cryptographically secure RNG. The payload is encrypted with AES-256-GCM, yielding ciphertext and a 128-bit authentication tag.",
      guarantee: "Zero plaintext is ever written to disk or database tables.",
      code: `const dek = crypto.randomBytes(32);
const { ciphertext, tag } =
  await AES_GCM.encrypt(file, dek);`,
    },
    {
      step: "02",
      name: "Envelope Key Wrapping",
      tag: "RSA-OAEP-SHA256",
      title: "Master KEK Protection",
      desc: "The unique DEK is wrapped using the tenant's active RSA-OAEP Key Encryption Key (KEK). The raw DEK is purged from memory, and only the wrapped key is stored alongside the ciphertext.",
      guarantee: "Decryption requires explicit, auditable authorization with the isolated KEK.",
      code: `const wrappedDek = await RSA_OAEP
  .encrypt(dek, kekPublicKey);
memory.shred(dek);`,
    },
    {
      step: "03",
      name: "Client-Side Digital Signature",
      tag: "RSA-PSS-SHA256",
      title: "Zero-Knowledge Non-Repudiation",
      desc: "Using browser WebCrypto (SubtleCrypto), the client computes the document's SHA-256 digest and signs it locally using their unexported RSA-PSS private key. The private key never leaves the client device.",
      guarantee: "True non-repudiation: neither the server nor any administrator can forge a user signature.",
      code: `const digest = await crypto.subtle
  .digest("SHA-256", fileData);
const sig = await crypto.subtle
  .sign(pssParams, privateKey, digest);`,
    },
    {
      step: "04",
      name: "Adaptive Risk & Step-Up Auth",
      tag: "BEHAVIORAL ENGINE",
      title: "Dynamic Contextual Defense",
      desc: "Access attempts trigger a real-time 6-factor risk scorer evaluating IP velocity/location, baseline time deviation, document classification sensitivity, download surge, access frequency, and share velocity.",
      guarantee: "Anomalous or high-risk access immediately triggers an automated 6-digit OTP challenge.",
      code: `const score = evaluateRisk(factors, policy);
if (score > 80) blockAccess();
else if (score > 60) requireStepUpOtp();`,
    },
    {
      step: "05",
      name: "Blind Search & Audit Verification",
      tag: "HMAC-SHA256",
      title: "Encrypted Search & Tamper Detection",
      desc: "HMAC-SHA256 blind indexing allows exact keyword queries over encrypted documents without revealing query terms or document contents. Independent third parties verify document authenticity in under 50ms.",
      guarantee: "Tamper-evident audit trail with automated credential and key redaction.",
      code: `const token = hmacSha256(
  normalize(query),
  searchKey
);
const matches = searchIndex.query(token);`,
    },
  ];

  const featuresList = [
    {
      id: "01",
      title: "Client-Side RSA-PSS Signing",
      desc: "Private keys are stored locally as PEM files and never touch servers. WebCrypto generates hardware-grade RSA-PSS signatures (2048–4096 bit, default 3072-bit) with 32-byte salt lengths before file transport.",
      specs: "RSA-PSS-SHA256 · 32-byte Salt · WebCrypto Native",
    },
    {
      id: "02",
      title: "Two-Tier Envelope Encryption",
      desc: "Every document receives an ephemeral 256-bit AES-GCM Data Encryption Key (DEK). The DEK is encrypted using tenant-managed RSA-OAEP Key Encryption Keys (KEKs), eliminating shared master secrets.",
      specs: "AES-256-GCM · RSA-OAEP-SHA256 · 128-bit Auth Tag",
    },
    {
      id: "03",
      title: "Adaptive Behavioral Risk Engine",
      desc: "A multi-factor engine scores access requests across 6 behavioral factors: IP velocity, baseline time deviation, document classification sensitivity, download surge, access frequency, and share volume.",
      specs: "6-Factor Risk Score (0–100) · Automated Step-Up OTP · Replay-Resistant",
    },
    {
      id: "04",
      title: "Blind Searchable Encryption",
      desc: "Search document contents without decrypting. A dedicated HMAC-SHA256 blind indexing mechanism extracts and hashes normalized search tokens directly from PDFs and DOCX files.",
      specs: "HMAC-SHA256 Blind Index · Zero Keyword Leakage",
    },
    {
      id: "05",
      title: "Tamper-Evident Audit Logging",
      desc: "Every administrative, upload, signing, download, and risk event is recorded to an append-only ledger. Sensitive keys, passwords, and tokens are automatically scrubbed and redacted.",
      specs: "Automated Redaction · Dedicated Security Auditor Role",
    },
  ];

  return (
    <div className="min-h-screen bg-[#08080a] text-neutral-100 selection:bg-amber-500/30 selection:text-amber-200">
      {/* Ambient background glows matching Image 1 & 2 */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {/* Warm golden/amber ambient top right glow */}
        <div
          className="absolute -top-40 -right-40 h-[700px] w-[700px] rounded-full blur-[140px]"
          style={{
            background: "radial-gradient(circle, rgba(217, 119, 6, 0.18) 0%, rgba(180, 83, 9, 0.05) 50%, transparent 70%)",
          }}
        />
        {/* Subtle indigo depth glow bottom left */}
        <div
          className="absolute top-[800px] -left-40 h-[600px] w-[600px] rounded-full blur-[150px]"
          style={{
            background: "radial-gradient(circle, rgba(30, 27, 75, 0.25) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* Navigation Bar */}
      <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#08080a]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">
          {/* Left Navigation Links */}
          <nav className="hidden items-center gap-8 md:flex">
            <a
              href="#architecture"
              className="text-xs font-medium tracking-wider text-neutral-400 uppercase transition hover:text-white"
            >
              Architecture
            </a>
            <a
              href="#flow"
              className="text-xs font-medium tracking-wider text-neutral-400 uppercase transition hover:text-white"
            >
              The Flow
            </a>
            <a
              href="#comparison"
              className="text-xs font-medium tracking-wider text-neutral-400 uppercase transition hover:text-white"
            >
              Benefits
            </a>
            <a
              href="#telemetry"
              className="text-xs font-medium tracking-wider text-neutral-400 uppercase transition hover:text-white"
            >
              Telemetry
            </a>
          </nav>

          {/* Center Brand */}
          <Link
            to="/home"
            className="flex items-center gap-2.5 text-base font-semibold tracking-[0.25em] text-white uppercase transition hover:opacity-90"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-400">
              <Shield className="h-4 w-4" />
            </span>
            securitas
          </Link>

          {/* Right Links & CTA */}
          <div className="hidden items-center gap-6 md:flex">
            <Link
              to="/login"
              className="text-xs font-medium tracking-wider text-neutral-300 transition hover:text-white"
            >
              Log in
            </Link>
            <Link
              to="/register"
              className="rounded-full bg-white px-5 py-2 text-xs font-semibold text-black transition hover:bg-neutral-200"
            >
              Enter Vault
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-lg border border-white/10 p-2 text-neutral-400 transition hover:text-white md:hidden"
            aria-label="Toggle Navigation"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="border-b border-white/[0.08] bg-[#0c0c10] px-6 py-5 md:hidden">
            <div className="flex flex-col space-y-4">
              <a
                href="#architecture"
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm text-neutral-300 hover:text-white"
              >
                Architecture
              </a>
              <a
                href="#flow"
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm text-neutral-300 hover:text-white"
              >
                The Flow
              </a>
              <a
                href="#comparison"
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm text-neutral-300 hover:text-white"
              >
                Benefits vs Legacy DMS
              </a>
              <a
                href="#telemetry"
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm text-neutral-300 hover:text-white"
              >
                Telemetry
              </a>
              <div className="pt-3 flex flex-col gap-2">
                <Link
                  to="/login"
                  className="rounded-full border border-white/20 px-4 py-2 text-center text-sm font-medium text-white"
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="rounded-full bg-white px-4 py-2 text-center text-sm font-semibold text-black"
                >
                  Enter Vault
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section (Matching Image 1 & 2) */}
      <section className="relative overflow-hidden pt-16 pb-24 lg:pt-28 lg:pb-36">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid items-center gap-16 lg:grid-cols-12 lg:gap-12">
            {/* Left Content Column */}
            <div className="space-y-8 lg:col-span-7">
              {/* Eyebrow badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-medium text-amber-300">
                <CheckCircle2 className="h-3.5 w-3.5 text-amber-400" />
                <span>Zero-Trust Cryptographic Document Vault</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-4xl font-light tracking-tight text-white sm:text-5xl lg:text-6xl lg:leading-[1.12]">
                One vault for{" "}
                <span className="font-semibold text-white">
                  everything you protect.
                </span>
              </h1>

              {/* Subheadline */}
              <p className="max-w-xl text-base leading-relaxed text-neutral-400 sm:text-lg">
                Client-side digital signatures, multi-tier envelope encryption,
                and real-time adaptive risk step-up. Zero plaintext on disk, zero
                third-party key custody.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  to="/register"
                  className="rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-black shadow-lg shadow-white/5 transition hover:bg-neutral-200"
                >
                  Enter Workspace
                </Link>
                <a
                  href="#flow"
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-7 py-3.5 text-sm font-medium text-neutral-300 backdrop-blur-sm transition hover:border-white/30 hover:bg-white/[0.08] hover:text-white"
                >
                  <span>See what's included</span>
                  <ChevronRight size={15} />
                </a>
              </div>

              {/* Cryptographic Badges */}
              <div className="pt-6 border-t border-white/[0.08] grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-neutral-500">Payload</p>
                  <p className="mt-1 text-sm font-medium text-neutral-200">AES-256-GCM</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-neutral-500">Signatures</p>
                  <p className="mt-1 text-sm font-medium text-neutral-200">RSA-PSS-3072</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-neutral-500">Key Custody</p>
                  <p className="mt-1 text-sm font-medium text-neutral-200">Client Sovereign</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-neutral-500">Risk Policy</p>
                  <p className="mt-1 text-sm font-medium text-neutral-200">Adaptive Step-Up</p>
                </div>
              </div>
            </div>

            {/* Right Hero Visual: Floating 3D Titanium Metal Card (Refer to Images 1 & 2) */}
            <div className="relative flex justify-center lg:col-span-5 lg:justify-end">
              {/* Backlight halo glow */}
              <div className="absolute inset-0 -m-8 rounded-full bg-gradient-to-tr from-amber-600/20 via-amber-500/10 to-transparent blur-3xl" />

              {/* 3D Titanium Card Container */}
              <div className="relative w-full max-w-[420px] transition-transform duration-700 ease-out hover:scale-105">
                <div
                  className="animate-float-card relative aspect-[1.586/1] w-full rounded-2xl p-7 shadow-2xl"
                  style={{
                    background:
                      "linear-gradient(135deg, #1d1d23 0%, #0d0d11 60%, #15151b 100%)",
                    border: "1px solid rgba(255, 255, 255, 0.14)",
                    boxShadow:
                      "0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 40px -5px rgba(217, 119, 6, 0.2)",
                  }}
                >
                  {/* Metallic Brushed Texture Overlay */}
                  <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent opacity-60" />

                  {/* Card Header: Brand & Contactless Icon */}
                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-amber-400" />
                      <span className="text-xs font-semibold tracking-[0.2em] text-neutral-300 uppercase">
                        securitas
                      </span>
                    </div>
                    {/* Contactless wave icon */}
                    <svg
                      className="h-5 w-5 text-neutral-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M8.5 16.5a5 5 0 0 1 0-9" />
                      <path d="M12 19a8.5 8.5 0 0 1 0-14" />
                      <path d="M15.5 21.5a12 12 0 0 1 0-19" />
                    </svg>
                  </div>

                  {/* Gold Microchip (Matching Image 2) */}
                  <div className="relative mt-6 mb-4">
                    <div
                      className="h-10 w-13 rounded-md shadow-inner"
                      style={{
                        background:
                          "linear-gradient(135deg, #fbbf24 0%, #d97706 50%, #92400e 100%)",
                        border: "1px solid rgba(251, 191, 36, 0.6)",
                      }}
                    >
                      {/* Chip contact traces */}
                      <div className="grid h-full w-full grid-cols-3 grid-rows-2 gap-[1px] p-[2px] opacity-40">
                        <div className="border border-black/40 rounded-sm"></div>
                        <div className="border border-black/40 rounded-sm"></div>
                        <div className="border border-black/40 rounded-sm"></div>
                        <div className="border border-black/40 rounded-sm"></div>
                        <div className="border border-black/40 rounded-sm"></div>
                        <div className="border border-black/40 rounded-sm"></div>
                      </div>
                    </div>
                  </div>

                  {/* Embossed Key ID / Vault Reference (Matching Card in Image 1 & 2) */}
                  <div className="relative mt-2 font-mono text-base font-semibold tracking-[0.2em] text-neutral-200">
                    5412 &nbsp;8830 &nbsp;2274 &nbsp;0169
                  </div>

                  {/* Card Bottom Details */}
                  <div className="relative mt-6 flex items-end justify-between">
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-neutral-400">
                        Cryptographic Key Custodian
                      </p>
                      <p className="text-xs font-semibold tracking-wider text-white">
                        SOVEREIGN TENANT
                      </p>
                      <p className="mt-1 text-[8px] font-mono text-amber-400/90">
                        RSA-PSS-3072 / AES-GCM
                      </p>
                    </div>

                    {/* Dual Overlapping Security Circles (Holographic badge in Image 1 & 2) */}
                    <div className="flex items-center -space-x-3 opacity-80">
                      <div className="h-7 w-7 rounded-full bg-amber-500/70 backdrop-blur-sm" />
                      <div className="h-7 w-7 rounded-full bg-neutral-400/50 backdrop-blur-sm" />
                    </div>
                  </div>
                </div>

                {/* Floating telemetry capsule underneath */}
                <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 backdrop-blur-md">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                    </span>
                    <span className="text-xs font-medium text-neutral-300">
                      Hardware Cryptographic Isolation
                    </span>
                  </div>
                  <span className="font-mono text-xs text-amber-400">
                    100% Verified
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Telemetry & Security Metrics Dashboard Preview (Matching the bottom card of Image 1) */}
      <section id="telemetry" className="relative border-t border-white/[0.08] bg-[#0c0c10] py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-light tracking-tight text-white sm:text-4xl">
              Everything protected,{" "}
              <span className="font-semibold text-white">in one balance.</span>
            </h2>
            <p className="mt-4 text-base text-neutral-400">
              Payloads, ephemeral DEKs, client signatures, and risk scores report
              to the same cryptographic ledger, revalued on every access before
              decryption.
            </p>
          </div>

          <div className="mt-12 grid gap-8 lg:grid-cols-12">
            {/* Left Card: Total Cryptographic Holdings / Audit Monitor */}
            <div className="rounded-2xl border border-white/10 bg-[#121217] p-8 lg:col-span-7">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-neutral-400">
                    Total Cryptographically Verified Operations
                  </p>
                  <p className="mt-2 text-3xl font-light tracking-tight text-white sm:text-4xl">
                    1,284,650
                  </p>
                  <p className="mt-1 text-xs font-medium text-emerald-400">
                    +100% integrity valid across all audited documents
                  </p>
                </div>

                {/* Time filter buttons (Matching Image 1) */}
                <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/40 p-1">
                  {(["24H", "7D", "30D", "ALL"] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setTimeFilter(filter)}
                      className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                        timeFilter === filter
                          ? "bg-white text-black"
                          : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chart Line Visualization (Matching Image 1's upward chart) */}
              <div className="relative mt-8 h-44 w-full">
                <svg
                  className="h-full w-full overflow-visible"
                  viewBox="0 0 600 160"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#d97706" stopOpacity="0.28" />
                      <stop offset="100%" stopColor="#d97706" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  {/* Fill area */}
                  <path
                    d="M 0,140 Q 150,135 250,110 T 450,60 T 600,20 L 600,160 L 0,160 Z"
                    fill="url(#chartGradient)"
                  />
                  {/* Orange stroke line */}
                  <path
                    d="M 0,140 Q 150,135 250,110 T 450,60 T 600,20"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2.5"
                  />
                </svg>
                {/* Year labels at bottom */}
                <div className="mt-2 flex justify-between text-[11px] font-mono text-neutral-500">
                  <span>Q1</span>
                  <span>Q2</span>
                  <span>Q3</span>
                  <span>Q4</span>
                  <span>CURRENT</span>
                </div>
              </div>

              {/* Three Stat Pointers */}
              <div className="mt-8 grid grid-cols-3 gap-4 border-t border-white/[0.08] pt-6 text-center sm:text-left">
                <div>
                  <p className="text-xs text-neutral-400">Tamper Rate</p>
                  <p className="mt-1 font-mono text-lg font-semibold text-white">0.00%</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400">Plaintext Leaks</p>
                  <p className="mt-1 font-mono text-lg font-semibold text-white">0 Bytes</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400">Verification Latency</p>
                  <p className="mt-1 font-mono text-lg font-semibold text-emerald-400">&lt; 42 ms</p>
                </div>
              </div>
            </div>

            {/* Right Card: Cryptographic Classification & Allocation (Matching Image 1) */}
            <div className="rounded-2xl border border-white/10 bg-[#121217] p-8 lg:col-span-5">
              <p className="text-xs uppercase tracking-wider text-neutral-400">
                Classification & Security Level
              </p>

              {/* Stacked Allocation Bar (Matching Image 1) */}
              <div className="mt-6 flex h-2.5 w-full overflow-hidden rounded-full bg-neutral-800">
                <div className="w-[50%] bg-amber-500" title="Restricted (50%)" />
                <div className="w-[30%] bg-amber-600/70" title="Confidential (30%)" />
                <div className="w-[14%] bg-neutral-500" title="Internal (14%)" />
                <div className="w-[6%] bg-neutral-700" title="Public (6%)" />
              </div>

              {/* Allocation List */}
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    <span className="text-neutral-200">RESTRICTED</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-neutral-400">50%</span>
                    <span className="font-mono text-xs font-semibold text-amber-400">Max Sensitivity (100)</span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-amber-600/70" />
                    <span className="text-neutral-200">CONFIDENTIAL</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-neutral-400">30%</span>
                    <span className="font-mono text-xs font-semibold text-amber-300">High Sensitivity (60)</span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-neutral-500" />
                    <span className="text-neutral-200">INTERNAL</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-neutral-400">14%</span>
                    <span className="font-mono text-xs font-semibold text-neutral-300">Normal RBAC (30)</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-neutral-700" />
                    <span className="text-neutral-200">PUBLIC</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-neutral-400">6%</span>
                    <span className="font-mono text-xs font-semibold text-neutral-400">Baseline (0)</span>
                  </div>
                </div>
              </div>

              {/* Adaptive Risk Engine Simulator Toggle */}
              <div className="mt-8 rounded-xl border border-white/10 bg-black/40 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-neutral-300">
                    Live Risk Policy Trigger:
                  </span>
                  <div className="flex gap-1">
                    {(["low", "medium", "high"] as const).map((lvl) => (
                      <button
                        key={lvl}
                        onClick={() => setInteractiveRisk(lvl)}
                        className={`rounded px-2 py-0.5 text-[10px] font-mono uppercase transition ${
                          interactiveRisk === lvl
                            ? lvl === "high"
                              ? "bg-red-500 text-white"
                              : lvl === "medium"
                              ? "bg-amber-500 text-black font-semibold"
                              : "bg-emerald-500 text-black font-semibold"
                            : "text-neutral-400 hover:text-white"
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3 text-xs text-neutral-400">
                  {interactiveRisk === "low" && (
                    <span className="text-emerald-400">
                      ✓ Risk Score: 14/100 · Known IP & normal working hours. Immediate AES decryption approved.
                    </span>
                  )}
                  {interactiveRisk === "medium" && (
                    <span className="text-amber-400">
                      ⚠ Risk Score: 48/100 · Unusual location detected. Access granted under elevated audit telemetry.
                    </span>
                  )}
                  {interactiveRisk === "high" && (
                    <span className="text-red-400">
                      ✕ Risk Score: 72/100 (HIGH) · IP Velocity anomaly & Restricted sensitivity. Decryption challenge issued: requires 6-digit OTP verification.
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Numbered Feature Rows (Matching Right Column of Image 1) */}
      <section id="architecture" className="border-t border-white/[0.08] bg-[#08080a] py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-widest text-amber-500 font-semibold">
              System Capabilities
            </p>
            <h2 className="mt-3 text-3xl font-light tracking-tight text-white sm:text-4xl">
              Engineered for zero compromise.
            </h2>
          </div>

          {/* Numbered rows with thin dividers (Matching Image 1) */}
          <div className="mt-16 divide-y divide-white/[0.08] border-t border-b border-white/[0.08]">
            {featuresList.map((feature) => (
              <div
                key={feature.id}
                className="grid gap-6 py-10 transition hover:bg-white/[0.02] sm:grid-cols-12 sm:items-start"
              >
                <div className="font-mono text-xs text-amber-400 sm:col-span-1">
                  {feature.id}
                </div>
                <div className="text-xl font-medium text-white sm:col-span-4">
                  {feature.title}
                </div>
                <div className="space-y-3 sm:col-span-7">
                  <p className="text-sm leading-relaxed text-neutral-400">
                    {feature.desc}
                  </p>
                  <p className="font-mono text-xs text-amber-500/80">
                    {feature.specs}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* End-to-End Workflow / The Flow Section */}
      <section id="flow" className="border-t border-white/[0.08] bg-[#0b0b0f] py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <span className="text-xs uppercase tracking-widest text-amber-500 font-semibold">
                Cryptographic Pipeline
              </span>
              <h2 className="mt-3 text-3xl font-light tracking-tight text-white sm:text-4xl">
                The End-to-End Document Lifecycle.
              </h2>
              <p className="mt-4 text-base text-neutral-400">
                From initial client-side file selection to verified viewing, every
                stage is governed by cryptographic invariants.
              </p>
            </div>
          </div>

          {/* Interactive Step Navigator */}
          <div className="mt-12 flex overflow-x-auto gap-2 pb-2 no-scrollbar">
            {workflowSteps.map((s, idx) => (
              <button
                key={s.step}
                onClick={() => setActiveStep(idx)}
                className={`flex items-center gap-3 whitespace-nowrap rounded-full px-5 py-2.5 text-xs font-medium transition ${
                  activeStep === idx
                    ? "bg-white text-black shadow-md"
                    : "border border-white/10 bg-white/[0.03] text-neutral-400 hover:text-white"
                }`}
              >
                <span className="font-mono">{s.step}</span>
                <span>{s.name}</span>
              </button>
            ))}
          </div>

          {/* Step Detail Card */}
          <div className="mt-8 rounded-2xl border border-white/10 bg-[#121218] p-8 lg:p-10">
            <div className="grid gap-10 lg:grid-cols-12">
              <div className="space-y-6 lg:col-span-7">
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 font-mono text-xs text-amber-300">
                  <span>{workflowSteps[activeStep].tag}</span>
                </div>

                <h3 className="text-2xl font-light text-white sm:text-3xl">
                  {workflowSteps[activeStep].title}
                </h3>

                <p className="text-base leading-relaxed text-neutral-300">
                  {workflowSteps[activeStep].desc}
                </p>

                <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 text-xs text-amber-300">
                  <strong>Security Guarantee:</strong>{" "}
                  {workflowSteps[activeStep].guarantee}
                </div>
              </div>

              {/* Technical Code / Pseudocode Snippet */}
              <div className="rounded-xl border border-white/10 bg-black/60 p-6 font-mono text-xs lg:col-span-5">
                <div className="flex items-center justify-between border-b border-white/10 pb-3 text-neutral-500">
                  <span>STAGE {workflowSteps[activeStep].step} EXECUTION</span>
                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                </div>
                <pre className="mt-4 whitespace-pre-wrap break-words overflow-hidden no-scrollbar text-amber-300/90 leading-relaxed font-mono select-none">
                  {workflowSteps[activeStep].code}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Section: Benefits over Traditional Applications (Matching Image 1) */}
      <section id="comparison" className="border-t border-white/[0.08] bg-[#08080a] py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-3xl">
              <span className="text-xs uppercase tracking-widest text-amber-500 font-semibold">
                Comparative Analysis & Visual Plots
              </span>
              <h2 className="mt-3 text-3xl font-light tracking-tight text-white sm:text-4xl">
                Why Securitas vs. Traditional Cloud Storage.
              </h2>
              <p className="mt-4 text-base text-neutral-400">
                Legacy platforms (Google Drive, SharePoint, Box, Dropbox) rely on
                server-managed keys and passive trust. Securitas enforces
                client-side mathematics.
              </p>
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#121218] p-1 font-mono text-xs">
              <button
                type="button"
                onClick={() => setComparisonView("both")}
                className={`rounded-lg px-3 py-1.5 transition ${
                  comparisonView === "both"
                    ? "bg-amber-500 text-black font-semibold shadow-sm"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Plots & Table
              </button>
              <button
                type="button"
                onClick={() => setComparisonView("graphs")}
                className={`rounded-lg px-3 py-1.5 transition ${
                  comparisonView === "graphs"
                    ? "bg-amber-500 text-black font-semibold shadow-sm"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                D3.js Plots
              </button>
              <button
                type="button"
                onClick={() => setComparisonView("table")}
                className={`rounded-lg px-3 py-1.5 transition ${
                  comparisonView === "table"
                    ? "bg-amber-500 text-black font-semibold shadow-sm"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Specification Matrix
              </button>
            </div>
          </div>

          {/* D3 Plots Section */}
          {(comparisonView === "both" || comparisonView === "graphs") && (
            <div className="mt-12">
              <ComparisonGraphs
                selectedDimensionId={selectedDimensionId}
                onSelectDimension={setSelectedDimensionId}
              />
            </div>
          )}

          {/* Desktop Comparison Table */}
          {(comparisonView === "both" || comparisonView === "table") && (
            <div className="mt-12 overflow-hidden rounded-2xl border border-white/10 bg-[#101015] shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-black/40 text-xs font-semibold tracking-wider text-neutral-400 uppercase">
                      <th className="py-5 px-6">Architectural Dimension</th>
                      <th className="py-5 px-6 text-neutral-400">Traditional Cloud Storage</th>
                      <th className="py-5 px-6 text-white">Securitas Zero-Trust</th>
                      <th className="py-5 px-6 text-amber-400">Advantage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {COMPARISON_DATA.map((row) => {
                      const isSelected = row.id === selectedDimensionId;
                      return (
                        <tr
                          key={row.id}
                          onClick={() => setSelectedDimensionId(row.id)}
                          className={`cursor-pointer transition ${
                            isSelected
                              ? "bg-amber-500/[0.07] border-l-2 border-l-amber-500"
                              : "hover:bg-white/[0.02]"
                          }`}
                        >
                          <td className="py-5 px-6 font-medium text-white">
                            <div className="flex items-center gap-2">
                              {isSelected && (
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_#f59e0b]" />
                              )}
                              <span>{row.feature}</span>
                            </div>
                          </td>
                          <td className="py-5 px-6 text-neutral-400 leading-relaxed">
                            <div className="flex items-start gap-2">
                              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400/80" />
                              <span>{row.traditional}</span>
                            </div>
                          </td>
                          <td className="py-5 px-6 text-neutral-200 leading-relaxed bg-white/[0.01]">
                            <div className="flex items-start gap-2">
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                              <span>{row.securitas}</span>
                            </div>
                          </td>
                          <td className="py-5 px-6 font-mono text-xs font-semibold whitespace-nowrap">
                            <span
                              className={`rounded-full border px-2.5 py-1 ${
                                row.securitasScore >= row.traditionalScore
                                  ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                                  : "border-red-500/30 bg-red-500/10 text-red-400"
                              }`}
                            >
                              {row.advantage}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* "Boring Where It Counts" Section (Directly from Image 1) */}
      <section className="border-t border-white/[0.08] bg-[#0c0c10] py-24 text-center">
        <div className="mx-auto max-w-4xl px-6 lg:px-8">
          <h2 className="text-3xl font-light tracking-tight text-white sm:text-4xl">
            Boring where it counts
          </h2>
          <p className="mt-4 text-base text-neutral-400">
            Your encryption keys are not held by third-party cloud brokers and
            never touch shared memory pools.
          </p>

          <div className="mt-16 grid gap-8 text-left sm:grid-cols-3">
            <div className="rounded-xl border border-white/[0.08] bg-[#121218] p-6">
              <h3 className="text-base font-semibold text-white">
                Held in custody
              </h3>
              <p className="mt-3 text-xs leading-relaxed text-neutral-400">
                Keys generated in your browser or hardware security modules,
                isolated per tenant. Never commingled or accessible to our
                platform engineers.
              </p>
              <div className="mt-6 font-mono text-[11px] text-amber-400">
                AES-256-GCM / RSA-OAEP
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-[#121218] p-6">
              <h3 className="text-base font-semibold text-white">
                Verified, not promised
              </h3>
              <p className="mt-3 text-xs leading-relaxed text-neutral-400">
                Cryptographic digital signatures guarantee non-repudiation. If
                any single byte is tampered with, signature validation fails
                immediately.
              </p>
              <div className="mt-6 font-mono text-[11px] text-amber-400">
                RSA-PSS-3072 / SHA-256
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-[#121218] p-6">
              <h3 className="text-base font-semibold text-white">
                Zero plaintext stored
              </h3>
              <p className="mt-3 text-xs leading-relaxed text-neutral-400">
                Payloads are encrypted before hitting disk storage; DEKs are
                shredded from RAM immediately post-operation. There is no
                unencrypted cache.
              </p>
              <div className="mt-6 font-mono text-[11px] text-amber-400">
                Blind HMAC-SHA256 Indexing
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof & Numbers Bar (Matching Image 1) */}
      <section className="border-t border-white/[0.08] bg-[#08080a] py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4 text-center">
            <div>
              <p className="text-3xl font-light text-white sm:text-5xl font-mono">100%</p>
              <p className="mt-2 text-xs uppercase tracking-wider text-neutral-400">
                Client-Side Key Privacy
              </p>
            </div>
            <div>
              <p className="text-3xl font-light text-white sm:text-5xl font-mono">0</p>
              <p className="mt-2 text-xs uppercase tracking-wider text-neutral-400">
                Plaintext Documents Stored
              </p>
            </div>
            <div>
              <p className="text-3xl font-light text-emerald-400 sm:text-5xl font-mono">&lt; 42ms</p>
              <p className="mt-2 text-xs uppercase tracking-wider text-neutral-400">
                Verification Latency
              </p>
            </div>
            <div>
              <p className="text-3xl font-light text-amber-400 sm:text-5xl font-mono">3072-bit</p>
              <p className="mt-2 text-xs uppercase tracking-wider text-neutral-400">
                RSA-PSS Signature Standard
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom Call to Action Section (Matching Image 1) */}
      <section className="relative border-t border-white/[0.08] bg-[#0a0a0e] py-28 text-center">
        <div className="mx-auto max-w-4xl px-6 lg:px-8">
          <h2 className="text-3xl font-light tracking-tight text-white sm:text-5xl">
            Stop adding it up in your head
          </h2>
          <p className="mt-4 text-base text-neutral-400">
            Stop trusting unencrypted cloud repositories with your most
            sensitive agreements, intellectual property, and audit artifacts.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              to="/register"
              className="rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-black transition hover:bg-neutral-200"
            >
              Become a member
            </Link>
            <Link
              to="/login"
              className="rounded-full border border-white/15 bg-white/[0.04] px-8 py-3.5 text-sm font-medium text-white transition hover:bg-white/[0.08]"
            >
              Sign in to vault
            </Link>
          </div>
        </div>
      </section>

      {/* Minimalist Dark Luxury Footer (Matching Image 1) */}
      <footer className="border-t border-white/[0.08] bg-[#050507] py-16 text-xs text-neutral-500">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-5">
            {/* Brand column */}
            <div className="space-y-4 lg:col-span-2">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-amber-400" />
                <span className="text-sm font-semibold tracking-[0.25em] text-white uppercase">
                  securitas
                </span>
              </div>
              <p className="max-w-sm text-xs leading-relaxed text-neutral-400">
                Enterprise Cryptographic Document Security Platform. Envelope
                encryption, client-side digital signatures, and adaptive
                behavioral risk verification.
              </p>
            </div>

            {/* Column 1 */}
            <div>
              <p className="font-semibold text-neutral-300 uppercase tracking-wider text-[11px]">
                Architecture
              </p>
              <ul className="mt-4 space-y-2.5">
                <li><a href="#architecture" className="hover:text-white transition">Envelope Encryption</a></li>
                <li><a href="#flow" className="hover:text-white transition">Client-Side RSA-PSS</a></li>
                <li><a href="#flow" className="hover:text-white transition">Adaptive Risk Engine</a></li>
                <li><a href="#architecture" className="hover:text-white transition">Blind HMAC Search</a></li>
              </ul>
            </div>

            {/* Column 2 */}
            <div>
              <p className="font-semibold text-neutral-300 uppercase tracking-wider text-[11px]">
                Security Model
              </p>
              <ul className="mt-4 space-y-2.5">
                <li><a href="#comparison" className="hover:text-white transition">Zero-Knowledge Custody</a></li>
                <li><a href="#comparison" className="hover:text-white transition">Non-Repudiation</a></li>
                <li><a href="#telemetry" className="hover:text-white transition">Tamper-Evident Ledger</a></li>
                <li><a href="#flow" className="hover:text-white transition">Step-Up MFA Challenge</a></li>
              </ul>
            </div>

            {/* Column 3 */}
            <div>
              <p className="font-semibold text-neutral-300 uppercase tracking-wider text-[11px]">
                Platform
              </p>
              <ul className="mt-4 space-y-2.5">
                <li><Link to="/login" className="hover:text-white transition">Sign In</Link></li>
                <li><Link to="/register" className="hover:text-white transition">Register Tenant</Link></li>
                <li><Link to="/workspace/dashboard" className="hover:text-white transition">Workspace Console</Link></li>
                <li><a href="#comparison" className="hover:text-white transition">Legacy DMS Comparison</a></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col justify-between items-center gap-4 border-t border-white/[0.06] pt-8 sm:flex-row">
            <p>© 2026 Securitas Platform. Built with AES-256-GCM, RSA-PSS / RSA-OAEP, and bcrypt.</p>
            <div className="flex gap-6">
              <span className="hover:text-white transition">Privacy Notice</span>
              <span className="hover:text-white transition">Cryptographic Terms</span>
              <span className="hover:text-white transition">Audit Standards</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
