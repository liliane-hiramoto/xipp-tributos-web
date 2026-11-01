"use client";

import { useMemo } from "react";
import { COR_CATEGORIA, type DarfRow } from "@/lib/darf";
import { fmtMoney } from "@/lib/format";
import FilterTable from "@/components/FilterTable";
import { colsLinha } from "@/components/darfCols";

const brl = (v: number) => v.toFixed(2).replace(".", ",");

export default function Tabela({ rows }: { rows: DarfRow[] }) {
  const comEmpresa = useMemo(() => new Set(rows.map((r) => r.cnpj)).size > 1, [rows]);
  const cols = useMemo(() => colsLinha(true, comEmpresa), [comEmpresa]);

  return (
    <div className="space-y-4">
      <FilterTable
        rows={rows}
        cols={cols}
        initialSort="recolh"
        searchable
        searchFn={(r, q) => `${r.codigo} ${r.tributo} ${r.numeroDocumento}`.toLowerCase().includes(q)}
        captionLeft={(fr) => `${fr.length} linha(s)`}
        caption={(fr) => (
          <span className="font-semibold text-slate-700">
            Total: {fmtMoney(fr.reduce((s, r) => s + r.total, 0))}
          </span>
        )}
        csv={{
          filename: "darfs.csv",
          head: [
            "cnpj",
            "empresa",
            "codigo",
            "tributo",
            "categoria",
            "periodo_apuracao",
            "vencimento",
            "recolhimento",
            "dias_atraso",
            "principal",
            "multa",
            "juros",
            "total",
            "numero_documento",
            "banco",
            "arquivo",
          ],
          map: (r) => [
            r.cnpj,
            `"${r.empresa}"`,
            r.codigo,
            `"${r.tributo}"`,
            r.categoria,
            r.periodoApuracao ?? "",
            r.vencimento ?? "",
            r.recolhimento ?? "",
            r.diasAtraso ?? "",
            brl(r.principal),
            brl(r.multa),
            brl(r.juros),
            brl(r.total),
            r.numeroDocumento,
            `"${r.banco}"`,
            r.arquivo,
          ],
        }}
      />

      <div className="flex flex-wrap gap-3 px-1">
        {Object.entries(COR_CATEGORIA).map(([c, cor]) => (
          <span key={c} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: cor }} />
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}
