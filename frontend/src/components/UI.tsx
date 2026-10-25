import {
  CheckCircle2,
  AlertTriangle,
  LoaderCircle,
  Copy,
  Inbox,
} from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
export function Alert({
  message,
  success = false,
}: {
  message: string;
  success?: boolean;
}) {
  if (!message) return null;
  const Icon = success ? CheckCircle2 : AlertTriangle;
  return (
    <div
      role={success ? "status" : "alert"}
      className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${success ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}
    >
      <Icon size={18} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-7">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[.22em] text-blue-600">
        {eyebrow}
      </p>
      <h1 className="text-3xl font-bold tracking-tight text-slate-800">
        {title}
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  );
}
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-blue-100 bg-white p-6 shadow-sm ${className}`}
    >
      {children}
    </section>
  );
}
export function Spinner() {
  return <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />;
}
export function CopyId({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 break-all text-xs text-slate-500">{value}</code>
      <button
        type="button"
        className="rounded-md p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
        onClick={() => void copy()}
        aria-label="Copy ID"
      >
        {copied ? <CheckCircle2 size={15} /> : <Copy size={15} />}
      </button>
    </div>
  );
}
export function Empty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="py-10 text-center">
      <Inbox size={34} className="mx-auto mb-3 text-slate-300" />
      <h3 className="font-semibold text-slate-600">{title}</h3>
      <p className="mt-1 text-sm text-slate-400">{description}</p>
    </div>
  );
}
export const formatDate = (date: string) =>
  new Date(date).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
export const formatSize = (bytes: number) =>
  bytes < 1048576
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1048576).toFixed(1)} MB`;
export const roleName = (role: string) =>
  role
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
export const validUUID = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
