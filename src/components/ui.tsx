"use client";

import { fmtMoney } from "@/lib/format";

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function SecTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </h2>
  );
}

export function Kpi({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "danger" | "ok" | "brand";
}) {
  const toneCls =
    tone === "danger"
      ? "text-red-600"
      : tone === "ok"
      ? "text-emerald-600"
      : tone === "brand"
      ? "text-[var(--brand)]"
      : "text-slate-900";
  return (
    <Card>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div
        className={`mt-1 text-xl font-bold tabular-nums leading-tight break-words ${toneCls}`}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </Card>
  );
}

/** Barra horizontal proporcional (gráfico simples sem dependências). */
export function Bar({
  value,
  max,
  color = "var(--brand)",
}: {
  value: number;
  max: number;
  color?: string;
}) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className="h-full rounded-full"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

export function Selo({
  children,
  color,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{
        backgroundColor: (color ?? "#64748b") + "1a",
        color: color ?? "#475569",
      }}
    >
      {children}
    </span>
  );
}

export function Money({
  v,
  className = "",
}: {
  v: number;
  className?: string;
}) {
  return <span className={`tabular-nums ${className}`}>{fmtMoney(v)}</span>;
}
