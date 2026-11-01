"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";

export interface Col<T> {
  key: string;
  label: string;
  align?: "num" | "center";
  cell: (r: T) => ReactNode;
  sortVal?: (r: T) => string | number; // habilita ordenação
  filter?: {
    fget: (r: T) => string; // valor usado no dropdown/comparação
    fdisp?: (v: string) => string; // rótulo exibido
    cmp?: (a: string, b: string) => number;
  };
}

interface Props<T> {
  rows: T[];
  cols: Col<T>[];
  initialSort?: string;
  initialAsc?: boolean;
  searchable?: boolean;
  searchFn?: (r: T, q: string) => boolean;
  captionLeft?: (rows: T[]) => ReactNode;
  caption?: (rows: T[]) => ReactNode;
  csv?: { filename: string; head: string[]; map: (r: T) => (string | number)[] };
  foot?: (rows: T[]) => ReactNode;
  expand?: (r: T) => ReactNode; // conteúdo do detalhamento (drop-down por linha)
  rowKey?: (r: T) => string; // chave estável p/ estado de expansão
}

export default function FilterTable<T>({
  rows,
  cols,
  initialSort,
  initialAsc = false,
  searchable,
  searchFn,
  captionLeft,
  caption,
  csv,
  foot,
  expand,
  rowKey,
}: Props<T>) {
  const [q, setQ] = useState("");
  const [f, setF] = useState<Record<string, string>>({});
  const [sk, setSk] = useState(initialSort ?? "");
  const [asc, setAsc] = useState(initialAsc);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const keyOf = (r: T, i: number) => (rowKey ? rowKey(r) : String(i));
  const totalCols = cols.length + (expand ? 1 : 0);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let rs = rows.filter((r) => {
      if (query && searchFn && !searchFn(r, query)) return false;
      return cols.every((c) => !c.filter || !f[c.key] || String(c.filter.fget(r)) === f[c.key]);
    });
    if (sk) {
      const c = cols.find((x) => x.key === sk);
      if (c?.sortVal) {
        const dir = asc ? 1 : -1;
        rs = [...rs].sort((a, b) => {
          const av = c.sortVal!(a);
          const bv = c.sortVal!(b);
          return av < bv ? -dir : av > bv ? dir : 0;
        });
      }
    }
    return rs;
  }, [rows, cols, q, f, sk, asc]);

  function distinct(c: Col<T>): string[] {
    const m = new Map<string, string>();
    for (const r of rows) {
      const v = c.filter!.fget(r);
      const k = String(v);
      if (!m.has(k)) m.set(k, v);
    }
    const cmp = c.filter!.cmp ?? ((a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0));
    return [...m.values()].sort(cmp);
  }

  function toggleSort(k: string) {
    if (sk === k) setAsc(!asc);
    else {
      setSk(k);
      setAsc(false);
    }
  }

  function exportCsv() {
    if (!csv) return;
    const linhas = filtered.map((r) => csv.map(r).join(";"));
    const conteudo = "﻿" + [csv.head.join(";"), ...linhas].join("\n");
    const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = csv.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const arrow = (k: string) => (sk === k ? (asc ? " ▲" : " ▼") : "");

  return (
    <div>
      {(searchable || csv) && (
        <div className="mb-3 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {searchable && (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-500">Buscar</span>
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="código, tributo, documento…"
                className="w-64 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-[var(--brand)]"
              />
            </label>
          )}
          <span className="self-center text-xs text-slate-400">
            Use os dropdowns em cada coluna para filtrar.
          </span>
          {csv && (
            <button
              onClick={exportCsv}
              className="ml-auto rounded-lg border border-[var(--brand)] px-3 py-1.5 text-sm font-medium text-[var(--brand)] hover:bg-[var(--brand-soft)]"
            >
              ⤓ Exportar CSV
            </button>
          )}
        </div>
      )}

      {(captionLeft || caption) && (
        <div className="mb-2 flex items-center justify-between text-sm text-slate-500">
          <span>{captionLeft ? captionLeft(filtered) : null}</span>
          <span>{caption ? caption(filtered) : null}</span>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                {expand && <th className="w-8 px-2 py-2" />}
                {cols.map((c) => (
                  <th
                    key={c.key}
                    onClick={c.sortVal ? () => toggleSort(c.key) : undefined}
                    className={`px-3 py-2 font-medium ${
                      c.align === "num" ? "text-right" : c.align === "center" ? "text-center" : ""
                    } ${c.sortVal ? "cursor-pointer hover:text-slate-600" : ""}`}
                  >
                    {c.label}
                    {arrow(c.key)}
                  </th>
                ))}
              </tr>
              <tr className="bg-white">
                {expand && <td className="border-b-2 border-slate-200" />}
                {cols.map((c) => (
                  <td key={c.key} className="border-b-2 border-slate-200 px-1.5 py-1">
                    {c.filter ? (
                      <select
                        value={f[c.key] ?? ""}
                        onChange={(e) =>
                          setF((prev) => {
                            const next = { ...prev };
                            if (e.target.value) next[c.key] = e.target.value;
                            else delete next[c.key];
                            return next;
                          })
                        }
                        className="w-full min-w-[78px] rounded-md border border-slate-300 px-1 py-1 text-[11px] text-slate-600 outline-none focus:border-[var(--brand)]"
                      >
                        <option value="">Todos</option>
                        {distinct(c).map((v) => (
                          <option key={v} value={v}>
                            {c.filter!.fdisp ? c.filter!.fdisp(v) : v}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const k = keyOf(r, i);
                const aberto = open.has(k);
                const toggle = () =>
                  setOpen((prev) => {
                    const next = new Set(prev);
                    if (next.has(k)) next.delete(k);
                    else next.add(k);
                    return next;
                  });
                return (
                  <Fragment key={k}>
                    <tr
                      className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 ${
                        expand ? "cursor-pointer" : ""
                      } ${aberto ? "bg-slate-50" : ""}`}
                      onClick={expand ? toggle : undefined}
                    >
                      {expand && (
                        <td className="px-2 py-2 text-center text-slate-400">
                          <span className={`inline-block transition-transform ${aberto ? "rotate-90" : ""}`}>
                            ▸
                          </span>
                        </td>
                      )}
                      {cols.map((c) => (
                        <td
                          key={c.key}
                          className={`px-3 py-2 ${
                            c.align === "num" ? "text-right" : c.align === "center" ? "text-center" : ""
                          }`}
                        >
                          {c.cell(r)}
                        </td>
                      ))}
                    </tr>
                    {expand && aberto && (
                      <tr>
                        <td colSpan={totalCols} className="border-b border-slate-100 bg-slate-50/60 px-4 py-3">
                          {expand(r)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={totalCols} className="px-3 py-8 text-center text-slate-400">
                    Nenhum registro para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
            {foot && <tfoot>{foot(filtered)}</tfoot>}
          </table>
        </div>
      </div>
    </div>
  );
}
