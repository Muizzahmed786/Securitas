import { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import {
  Cpu,
  RefreshCw,
  Lock,
  FileSignature,
  AlertCircle,
  Zap,
} from "lucide-react";
import { getCryptoBenchmark, type CryptoBenchmark } from "../../api/cryptoKeys";
import { errorMessage } from "../../api/http";

export default function CryptoPerformanceChart() {
  const [benchmark, setBenchmark] = useState<CryptoBenchmark | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  async function loadBenchmark() {
    setLoading(true);
    setError("");
    try {
      const data = await getCryptoBenchmark();
      setBenchmark(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleRunBenchmark() {
    setRunning(true);
    setError("");
    try {
      const data = await getCryptoBenchmark();
      setBenchmark(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    void loadBenchmark();
  }, []);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#121218] p-6 shadow-xl space-y-6">
      {/* Header with trigger button */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.06] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight text-white">
              Cryptographic Performance Benchmark
            </h2>
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono text-emerald-400">
              Pure CPU Timing (No Network/IO)
            </span>
          </div>
          <p className="mt-0.5 text-xs text-neutral-400">
            Averaged across {benchmark?.iterations ?? 3} repeated measurements per size within the 20 MiB upload limit.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleRunBenchmark()}
          disabled={loading || running}
          className="btn-secondary self-start sm:self-center flex items-center gap-2 text-xs"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${running ? "animate-spin text-amber-400" : ""}`}
          />
          <span>{running ? "Executing Benchmark…" : "Run Live Benchmark"}</span>
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {loading && !benchmark && (
        <div className="flex h-56 items-center justify-center text-xs text-neutral-400">
          <RefreshCw className="h-5 w-5 animate-spin text-amber-400 mr-2" />
          <span>Measuring cryptographic execution speeds across payload sizes…</span>
        </div>
      )}

      {benchmark && (
        <>
          {/* AES-256-GCM Payload Performance Chart */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-amber-400" />
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                  AES-256-GCM Document Encryption & Decryption
                </h3>
              </div>
              <span className="text-[11px] font-mono text-neutral-400">
                12-byte Nonce + 16-byte GCM Tag
              </span>
            </div>

            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={benchmark.tested_sizes}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.05)"
                  />
                  <XAxis
                    dataKey="size_label"
                    stroke="#737373"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#737373"
                    fontSize={10}
                    tickLine={false}
                    unit="ms"
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="rounded-xl border border-white/10 bg-[#0c0c10] p-3 text-xs shadow-2xl space-y-1.5">
                          <p className="font-semibold text-white">
                            Payload Size: {d.size_label}
                          </p>
                          <p className="font-mono text-amber-400">
                            &bull; Encrypt: {d.encrypt_ms} ms (
                            {d.encrypt_throughput_mb_s} MB/s)
                          </p>
                          <p className="font-mono text-emerald-400">
                            &bull; Decrypt: {d.decrypt_ms} ms (
                            {d.decrypt_throughput_mb_s} MB/s)
                          </p>
                          <p className="text-[10px] text-neutral-500 pt-1 border-t border-white/5">
                            Measured across {benchmark.iterations} repetitions
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 11, paddingBottom: 10 }}
                  />
                  <Bar
                    dataKey="encrypt_ms"
                    name="Encryption (ms)"
                    fill="#f59e0b"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="decrypt_ms"
                    name="Decryption (ms)"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Asymmetric Enclave Processing Cards */}
          <div className="grid gap-4 sm:grid-cols-2 pt-2">
            {/* RSA-OAEP Key Wrapping */}
            <div className="rounded-xl border border-white/5 bg-[#0c0c10] p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-semibold text-white">
                    RSA-OAEP Key Wrapping
                  </span>
                </div>
                <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] font-mono text-neutral-400">
                  32-byte AES DEK
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                  <span className="text-[10px] text-neutral-400">Wrap (Encrypt DEK)</span>
                  <p className="mt-0.5 font-mono text-sm font-bold text-amber-400">
                    {benchmark.key_wrapping_rsa_oaep.wrap_ms} ms
                  </p>
                </div>
                <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                  <span className="text-[10px] text-neutral-400">Unwrap (Decrypt DEK)</span>
                  <p className="mt-0.5 font-mono text-sm font-bold text-emerald-400">
                    {benchmark.key_wrapping_rsa_oaep.unwrap_ms} ms
                  </p>
                </div>
              </div>

              <p className="text-[11px] text-neutral-400 pt-1">
                {benchmark.key_wrapping_rsa_oaep.note}
              </p>
            </div>

            {/* RSA-PSS Digital Signatures */}
            <div className="rounded-xl border border-white/5 bg-[#0c0c10] p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSignature className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-white">
                    RSA-PSS Digital Signatures
                  </span>
                </div>
                <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] font-mono text-neutral-400">
                  32-byte SHA-256 Digest
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                  <span className="text-[10px] text-neutral-400">Sign Digest</span>
                  <p className="mt-0.5 font-mono text-sm font-bold text-amber-400">
                    {benchmark.digital_signatures_rsa_pss.sign_ms} ms
                  </p>
                </div>
                <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                  <span className="text-[10px] text-neutral-400">Verify Signature</span>
                  <p className="mt-0.5 font-mono text-sm font-bold text-emerald-400">
                    {benchmark.digital_signatures_rsa_pss.verify_ms} ms
                  </p>
                </div>
              </div>

              <p className="text-[11px] text-neutral-400 pt-1">
                {benchmark.digital_signatures_rsa_pss.note}
              </p>
            </div>
          </div>

          {/* Architectural Guarantee Alert */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs text-neutral-300 flex items-start gap-2.5">
            <Zap className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-amber-300 font-semibold">
                Separation of Concerns Guarantee:
              </strong>{" "}
              RSA is strictly restricted to asymmetric key management and signing. Document bodies are encrypted exclusively with hardware-accelerated AES-256-GCM.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
