"use client";

import { useMemo } from "react";
import {
  agruparPorCodigo,
  agruparPorCategoria,
  categoriaDe,
  corCategoria,
  type DarfRow,
  type GrupoAgg,
} from "@/lib/darf";
import { fmtMoney } from "@/lib/format";
import { Card, SecTitle, Bar, Selo } from "@/components/ui";
import FilterTable, { type Col } from "@/components/FilterTable";

type AggRow = GrupoAgg & { categoria: string };

export default function PorTributo({ rows }: { rows: DarfRow[] }) {
  const porCat = useMemo(() => agruparPorCategoria(rows), [rows]);
  const porCod = useMemo<AggRow[]>(
    () => agruparPorCodigo(rows).map((g) => ({ ...g, categoria: categoriaDe(g.chave) })),
    [rows]
  );
  const max = Math.max(...porCod.map((c) => c.total), 1);

  const cols = useMemo<Col<AggRow>[]>(
    () => [
      { key: "chave", label: "Código", cell: (t) => <span className="font-mono text-xs text-slate-500">{t.chave}</span>, sortVal: (t) => t.chave, filter: { fget: (t) => t.chave } },
      { key: "trib", label: "Tributo", cell: (t) => <span className="text-slate-700">{t.rotulo.split(" · ")[1]}</span>, sortVal: (t) => t.rotulo, filter: { fget: (t) => t.rotulo.split(" · ")[1] } },
      { key: "cat", label: "Categoria", cell: (t) => <Selo color={corCategoria(t.categoria)}>{t.categoria}</Selo>, filter: { fget: (t) => t.categoria } },
      { key: "qtd", label: "Qtd", align: "center", cell: (t) => <span className="tabular-nums text-slate-500">{t.qtd}</span>, sortVal: (t) => t.qtd },
      { key: "atr", label: "Atraso", align: "center", cell: (t) => <span className="tabular-nums" style={{ color: t.emAtraso > 0 ? "#d97706" : "#cbd5e1" }}>{t.emAtraso}</span>, sortVal: (t) => t.emAtraso },
      { key: "enc", label: "Encargos", align: "num", cell: (t) => <span className="tabular-nums text-red-600">{t.encargos > 0 ? fmtMoney(t.encargos) : "—"}</span>, sortVal: (t) => t.encargos },
      { key: "part", label: "Participação", cell: (t) => (<div className="w-40"><Bar value={t.total} max={max} color={corCategoria(t.categoria)} /></div>) },
      { key: "total", label: "Total", align: "num", cell: (t) => <span className="font-semibold tabular-nums text-slate-800">{fmtMoney(t.total)}</span>, sortVal: (t) => t.total },
    ],
    [max]
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {porCat.map((c) => (
          <Card key={c.chave}>
            <Selo color={corCategoria(c.chave)}>{c.chave}</Selo>
            <div className="mt-2 text-xl font-bold tabular-nums text-slate-800">{fmtMoney(c.total)}</div>
            <div className="text-xs text-slate-400">
              {c.qtd} lançamento(s)
              {c.emAtraso > 0 && <span className="text-amber-600"> · {c.emAtraso} em atraso</span>}
            </div>
          </Card>
        ))}
        {porCat.length === 0 && <p className="text-sm text-slate-400">Sem dados no período.</p>}
      </div>

      <div>
        <SecTitle>Tributos por código</SecTitle>
        <FilterTable rows={porCod} cols={cols} initialSort="total" />
      </div>
    </div>
  );
}
