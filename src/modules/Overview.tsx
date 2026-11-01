"use client";

import { Fragment, useMemo } from "react";
import {
  resumir,
  agruparPorMes,
  agruparPorCategoria,
  corCategoria,
  rotuloMes,
  type DarfRow,
  type Regime,
} from "@/lib/darf";
import { fmtMoney, fmtPct } from "@/lib/format";
import { Card, Kpi, SecTitle, Bar, Selo } from "@/components/ui";
import FilterTable from "@/components/FilterTable";
import { colsLinha } from "@/components/darfCols";

export default function Overview({ rows, regime }: { rows: DarfRow[]; regime: Regime }) {
  const r = useMemo(() => resumir(rows), [rows]);
  const porMes = useMemo(() => agruparPorMes(rows, regime), [rows, regime]);
  const porCat = useMemo(() => agruparPorCategoria(rows), [rows]);
  const cols = useMemo(() => colsLinha(true), []);

  const maxMes = Math.max(...porMes.map((m) => m.total), 1);
  const maxCat = Math.max(...porCat.map((c) => c.total), 1);
  const baseLabel = regime === "competencia" ? "competência" : "recolhimento";
  const periodo =
    porMes.length > 0
      ? `${rotuloMes(porMes[0].chave)} – ${rotuloMes(porMes[porMes.length - 1].chave)}`
      : "—";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi label="Total recolhido" value={fmtMoney(r.totalRecolhido)} sub={`${r.qtdDarfs} DARFs · ${r.qtdLinhas} tributos`} tone="brand" />
        <Kpi label="Principal" value={fmtMoney(r.totalPrincipal)} sub="sem multa/juros" />
        <Kpi label="Multa + Juros" value={fmtMoney(r.totalEncargos)} sub={`${r.qtdComEncargos} linha(s) com encargos`} tone={r.totalEncargos > 0 ? "danger" : "ok"} />
        <Kpi label="Pago no prazo" value={fmtPct(r.pctNoPrazo, 0)} sub={`${r.qtdEmAtraso} após o vencimento`} tone={r.pctNoPrazo >= 0.999 ? "ok" : "danger"} />
        <Kpi label="Recolhido em atraso" value={fmtMoney(r.totalEmAtraso)} sub="linhas pagas após vencimento" tone={r.totalEmAtraso > 0 ? "danger" : "ok"} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <SecTitle>Por mês ({baseLabel}) · {periodo}</SecTitle>
          {porMes.length === 0 && <p className="text-sm text-slate-400">Sem dados no período.</p>}
          <div className="space-y-2.5">
            {[...new Set(porMes.map((m) => m.chave.slice(0, 4)))].sort().map((ano) => {
              const meses = porMes.filter((m) => m.chave.startsWith(ano));
              const totalAno = meses.reduce((s, m) => s + m.total, 0);
              return (
                <Fragment key={ano}>
                  {meses.map((m) => (
                    <div key={m.chave} className="flex items-center gap-3">
                      <div className="w-14 shrink-0 text-xs font-medium text-slate-500">{rotuloMes(m.chave)}</div>
                      <div className="flex-1">
                        <Bar value={m.total} max={maxMes} />
                      </div>
                      <div className="w-28 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-700">{fmtMoney(m.total)}</div>
                    </div>
                  ))}
                  <div className="flex items-center gap-3 border-t border-slate-200 pt-2">
                    <div className="w-14 shrink-0 text-xs font-bold text-slate-800">{ano}</div>
                    <div className="flex-1 text-[11px] uppercase tracking-wide text-slate-400">Total do ano</div>
                    <div className="w-28 shrink-0 text-right text-sm font-bold tabular-nums text-slate-900">{fmtMoney(totalAno)}</div>
                  </div>
                </Fragment>
              );
            })}
          </div>
        </Card>

        <Card>
          <SecTitle>Por categoria de tributo</SecTitle>
          {porCat.length === 0 && <p className="text-sm text-slate-400">Sem dados no período.</p>}
          <div className="space-y-3">
            {porCat.map((c) => (
              <div key={c.chave} className="flex items-center gap-3">
                <div className="w-40 shrink-0">
                  <Selo color={corCategoria(c.chave)}>{c.chave}</Selo>
                </div>
                <div className="flex-1">
                  <Bar value={c.total} max={maxCat} color={corCategoria(c.chave)} />
                </div>
                <div className="w-28 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-700">{fmtMoney(c.total)}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div>
        <SecTitle>Tributos (por valor recolhido)</SecTitle>
        <FilterTable rows={rows} cols={cols} initialSort="total" />
      </div>
    </div>
  );
}
