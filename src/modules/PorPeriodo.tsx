"use client";

import { Fragment, useMemo } from "react";
import { agruparPorMes, mesDe, rotuloMes, corCategoria, type DarfRow, type GrupoAgg, type Regime } from "@/lib/darf";
import { fmtMoney, fmtDate } from "@/lib/format";
import { Card, SecTitle, Bar } from "@/components/ui";
import FilterTable, { type Col } from "@/components/FilterTable";

export default function PorPeriodo({ rows, regime }: { rows: DarfRow[]; regime: Regime }) {
  const cronologico = useMemo(() => agruparPorMes(rows, regime), [rows, regime]);
  const tabela = useMemo(() => [...cronologico].reverse(), [cronologico]);
  const max = Math.max(...cronologico.map((m) => m.total), 1);
  const baseLabel = regime === "competencia" ? "competência (apuração)" : "recolhimento (pagamento)";

  // Lançamentos por mês (para o detalhamento expansível).
  const linhasPorMes = useMemo(() => {
    const m = new Map<string, DarfRow[]>();
    for (const r of rows) {
      const k = mesDe(r, regime);
      if (!k) continue;
      const arr = m.get(k);
      if (arr) arr.push(r);
      else m.set(k, [r]);
    }
    for (const arr of m.values())
      arr.sort((a, b) => (b.recolhimento ?? "").localeCompare(a.recolhimento ?? "") || b.total - a.total);
    return m;
  }, [rows, regime]);

  const cols = useMemo<Col<GrupoAgg>[]>(
    () => [
      { key: "mes", label: "Mês", cell: (m) => <span className="font-medium text-slate-700">{rotuloMes(m.chave)}</span>, sortVal: (m) => m.chave, filter: { fget: (m) => m.chave, fdisp: (v) => rotuloMes(v) } },
      { key: "qtd", label: "Lançamentos", align: "center", cell: (m) => <span className="tabular-nums text-slate-500">{m.qtd}</span>, sortVal: (m) => m.qtd },
      { key: "atr", label: "Em atraso", align: "center", cell: (m) => <span className="tabular-nums" style={{ color: m.emAtraso > 0 ? "#d97706" : "#cbd5e1" }}>{m.emAtraso}</span>, sortVal: (m) => m.emAtraso },
      { key: "enc", label: "Multa + Juros", align: "num", cell: (m) => <span className="tabular-nums text-red-600">{m.encargos > 0 ? fmtMoney(m.encargos) : "—"}</span>, sortVal: (m) => m.encargos },
      { key: "total", label: "Total recolhido", align: "num", cell: (m) => <span className="font-semibold tabular-nums text-slate-800">{fmtMoney(m.total)}</span>, sortVal: (m) => m.total },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <Card>
        <SecTitle>Total por mês · base {baseLabel}</SecTitle>
        {cronologico.length === 0 && <p className="text-sm text-slate-400">Sem dados no período.</p>}
        <div className="space-y-2.5">
          {[...new Set(cronologico.map((m) => m.chave.slice(0, 4)))].sort().map((ano) => {
            const meses = cronologico.filter((m) => m.chave.startsWith(ano));
            const totalAno = meses.reduce((s, m) => s + m.total, 0);
            return (
              <Fragment key={ano}>
                {meses.map((m) => (
                  <div key={m.chave} className="flex items-center gap-3">
                    <div className="w-16 shrink-0 text-xs font-medium text-slate-500">{rotuloMes(m.chave)}</div>
                    <div className="flex-1">
                      <Bar value={m.total} max={max} />
                    </div>
                    <div className="w-32 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-700">{fmtMoney(m.total)}</div>
                  </div>
                ))}
                <div className="flex items-center gap-3 border-t border-slate-200 pt-2">
                  <div className="w-16 shrink-0 text-xs font-bold text-slate-800">{ano}</div>
                  <div className="flex-1 text-[11px] uppercase tracking-wide text-slate-400">Total do ano</div>
                  <div className="w-32 shrink-0 text-right text-sm font-bold tabular-nums text-slate-900">{fmtMoney(totalAno)}</div>
                </div>
              </Fragment>
            );
          })}
        </div>
      </Card>

      <div>
        <SecTitle>Detalhe mensal</SecTitle>
        <p className="-mt-1 mb-2 text-xs text-slate-400">
          Clique em um mês para abrir os lançamentos agrupados.
        </p>
        <FilterTable
          rows={tabela}
          cols={cols}
          initialSort="mes"
          rowKey={(m) => m.chave}
          expand={(m) => <DetalheMes linhas={linhasPorMes.get(m.chave) ?? []} />}
          foot={(fr) => {
            const anos = [...new Set(fr.map((m) => m.chave.slice(0, 4)))].sort();
            return (
              <>
                {anos.map((ano) => {
                  const ms = fr.filter((m) => m.chave.startsWith(ano));
                  return (
                    <tr key={ano} className="border-t border-slate-200 bg-slate-50/70 font-semibold">
                      <td />
                      <td className="px-3 py-1.5 text-slate-700">Total {ano}</td>
                      <td className="px-3 py-1.5 text-center tabular-nums text-slate-500">{ms.reduce((s, m) => s + m.qtd, 0)}</td>
                      <td />
                      <td className="px-3 py-1.5 text-right tabular-nums text-red-600">
                        {(() => { const e = ms.reduce((s, m) => s + m.encargos, 0); return e > 0 ? fmtMoney(e) : "—"; })()}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-slate-800">{fmtMoney(ms.reduce((s, m) => s + m.total, 0))}</td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold">
                  <td />
                  <td className="px-3 py-2 text-slate-800">Total geral</td>
                  <td className="px-3 py-2 text-center tabular-nums text-slate-500">{fr.reduce((s, m) => s + m.qtd, 0)}</td>
                  <td />
                  <td className="px-3 py-2 text-right tabular-nums text-red-600">
                    {(() => { const e = fr.reduce((s, m) => s + m.encargos, 0); return e > 0 ? fmtMoney(e) : "—"; })()}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-900">{fmtMoney(fr.reduce((s, m) => s + m.total, 0))}</td>
                </tr>
              </>
            );
          }}
        />
      </div>
    </div>
  );
}

function DetalheMes({ linhas }: { linhas: DarfRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-xs">
        <thead className="bg-slate-100/70">
          <tr className="text-left uppercase tracking-wide text-slate-400">
            <th className="px-3 py-1.5 font-medium">Cód.</th>
            <th className="px-3 py-1.5 font-medium">Tributo</th>
            <th className="px-3 py-1.5 font-medium">Recolhimento</th>
            <th className="px-3 py-1.5 font-medium">Nº do Documento</th>
            <th className="px-3 py-1.5 text-center font-medium">Situação</th>
            <th className="px-3 py-1.5 text-right font-medium">Encargos</th>
            <th className="px-3 py-1.5 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.id} className="border-t border-slate-100">
              <td className="px-3 py-1.5 font-mono text-slate-500">{l.codigo}</td>
              <td className="px-3 py-1.5">
                <span className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: corCategoria(l.categoria) }} />
                  <span className="text-slate-700">{l.tributo}</span>
                </span>
              </td>
              <td className="px-3 py-1.5 tabular-nums text-slate-600">{fmtDate(l.recolhimento)}</td>
              <td className="px-3 py-1.5 font-mono text-slate-400">{l.numeroDocumento}</td>
              <td className="px-3 py-1.5 text-center">
                {l.emAtraso ? (
                  <span className="text-amber-600">{l.situacaoAtraso}</span>
                ) : l.comEncargos ? (
                  <span className="text-amber-600">c/ acréscimos</span>
                ) : (
                  <span className="text-emerald-600">no prazo</span>
                )}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums text-red-600">
                {l.encargos > 0 ? fmtMoney(l.encargos) : "—"}
              </td>
              <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-slate-800">{fmtMoney(l.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
