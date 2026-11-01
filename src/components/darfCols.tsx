"use client";

import { corCategoria, rotuloMes, type DarfRow } from "@/lib/darf";
import { fmtMoney, fmtDate } from "@/lib/format";
import { Selo } from "@/components/ui";
import type { Col } from "@/components/FilterTable";

// Filtro de coluna por mês (MMM/AAAA) a partir de uma data ISO.
const filtroMes = (get: (r: DarfRow) => string | null) => ({
  fget: (r: DarfRow) => {
    const v = get(r);
    return v ? v.slice(0, 7) : "n/d";
  },
  fdisp: (v: string) => (v === "n/d" ? "n/d" : rotuloMes(v)),
  cmp: (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0),
});

// Filtro de coluna por valor textual exato.
const filtroVal = (get: (r: DarfRow) => string) => ({ fget: get });

/** Colunas da tabela de linhas de tributo (usada em várias abas). */
export function colsLinha(comCategoria = true, comEmpresa = false): Col<DarfRow>[] {
  const cols: Col<DarfRow>[] = [
    {
      key: "empresa",
      label: "Empresa",
      cell: (r) => <span className="text-slate-700">{r.empresa}</span>,
      sortVal: (r) => r.empresa,
      filter: filtroVal((r) => r.empresa),
    },
    {
      key: "codigo",
      label: "Cód.",
      cell: (r) => <span className="font-mono text-xs text-slate-500">{r.codigo}</span>,
      sortVal: (r) => r.codigo,
      filter: filtroVal((r) => r.codigo),
    },
    {
      key: "tributo",
      label: "Tributo",
      cell: (r) => (
        <span className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: corCategoria(r.categoria) }}
          />
          <span className="text-slate-700">{r.tributo}</span>
        </span>
      ),
      sortVal: (r) => r.tributo,
      filter: filtroVal((r) => r.tributo),
    },
    {
      key: "categoria",
      label: "Categoria",
      cell: (r) => <Selo color={corCategoria(r.categoria)}>{r.categoria}</Selo>,
      filter: filtroVal((r) => r.categoria),
    },
    {
      key: "periodo",
      label: "Apuração",
      align: "num",
      cell: (r) => (
        <span className="tabular-nums text-slate-500">
          {r.periodoApuracao ? fmtDate(r.periodoApuracao) : "n/d"}
        </span>
      ),
      sortVal: (r) => r.periodoApuracao ?? "",
      filter: filtroMes((r) => r.periodoApuracao),
    },
    {
      key: "venc",
      label: "Vencimento",
      align: "num",
      cell: (r) => <span className="tabular-nums text-slate-500">{fmtDate(r.vencimento)}</span>,
      sortVal: (r) => r.vencimento ?? "",
      filter: filtroMes((r) => r.vencimento),
    },
    {
      key: "recolh",
      label: "Recolhimento",
      align: "num",
      cell: (r) => <span className="tabular-nums text-slate-700">{fmtDate(r.recolhimento)}</span>,
      sortVal: (r) => r.recolhimento ?? "",
      filter: filtroMes((r) => r.recolhimento),
    },
    {
      key: "situacao",
      label: "Situação",
      align: "center",
      cell: (r) =>
        r.emAtraso ? (
          <Selo color="#d97706">{r.situacaoAtraso}</Selo>
        ) : r.comEncargos ? (
          <Selo color="#d97706">c/ acréscimos</Selo>
        ) : (
          <Selo color="#059669">no prazo</Selo>
        ),
      filter: filtroVal((r) => (r.emAtraso ? "em atraso" : r.comEncargos ? "c/ acréscimos" : "no prazo")),
    },
    {
      key: "multa",
      label: "Multa",
      align: "num",
      cell: (r) => (
        <span className="tabular-nums text-red-600">{r.multa > 0 ? fmtMoney(r.multa) : "—"}</span>
      ),
      sortVal: (r) => r.multa,
    },
    {
      key: "juros",
      label: "Juros",
      align: "num",
      cell: (r) => (
        <span className="tabular-nums text-red-600">{r.juros > 0 ? fmtMoney(r.juros) : "—"}</span>
      ),
      sortVal: (r) => r.juros,
    },
    {
      key: "total",
      label: "Total",
      align: "num",
      cell: (r) => (
        <span className="font-semibold tabular-nums text-slate-800">{fmtMoney(r.total)}</span>
      ),
      sortVal: (r) => r.total,
    },
  ];
  let out = cols;
  if (!comCategoria) out = out.filter((c) => c.key !== "categoria");
  if (!comEmpresa) out = out.filter((c) => c.key !== "empresa");
  return out;
}
