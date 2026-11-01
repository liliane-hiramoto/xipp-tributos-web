"use client";

import { useMemo } from "react";
import { resumir, type DarfRow } from "@/lib/darf";
import { fmtMoney, fmtPct } from "@/lib/format";
import { Card, Kpi, SecTitle } from "@/components/ui";
import FilterTable from "@/components/FilterTable";
import { colsLinha } from "@/components/darfCols";

function faixa(dias: number | null): string {
  if (dias == null || dias <= 0) return "Mesmo dia (c/ acréscimos)";
  if (dias <= 5) return "1–5 dias";
  if (dias <= 15) return "6–15 dias";
  if (dias <= 30) return "16–30 dias";
  if (dias <= 60) return "31–60 dias";
  return "60+ dias";
}

export default function Atrasos({ rows }: { rows: DarfRow[] }) {
  const r = useMemo(() => resumir(rows), [rows]);
  const atrasados = useMemo(
    () => rows.filter((x) => x.emAtraso || x.comEncargos),
    [rows]
  );
  const cols = useMemo(() => colsLinha(true), []);

  const porFaixa = useMemo(() => {
    const ordem = [
      "Mesmo dia (c/ acréscimos)",
      "1–5 dias",
      "6–15 dias",
      "16–30 dias",
      "31–60 dias",
      "60+ dias",
    ];
    const map = new Map<string, { qtd: number; encargos: number }>();
    for (const a of atrasados) {
      const f = faixa(a.diasAtraso);
      const g = map.get(f) ?? { qtd: 0, encargos: 0 };
      g.qtd++;
      g.encargos += a.encargos;
      map.set(f, g);
    }
    return ordem.filter((f) => map.has(f)).map((f) => ({ faixa: f, ...map.get(f)! }));
  }, [atrasados]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Em atraso (por data)" value={String(r.qtdEmAtraso)} sub={`recolh. > venc. · ${fmtPct(r.pctNoPrazo, 0)} no prazo`} tone={r.qtdEmAtraso > 0 ? "danger" : "ok"} />
        <Kpi label="Linhas com encargos" value={String(r.qtdComEncargos)} sub={`de ${r.qtdLinhas} pagaram multa/juros`} tone={r.qtdComEncargos > 0 ? "danger" : "ok"} />
        <Kpi label="Multa paga" value={fmtMoney(r.totalMulta)} tone={r.totalMulta > 0 ? "danger" : "ok"} />
        <Kpi label="Juros pagos" value={fmtMoney(r.totalJuros)} tone={r.totalJuros > 0 ? "danger" : "ok"} />
      </div>

      {porFaixa.length > 0 && (
        <Card>
          <SecTitle>Distribuição por faixa de atraso</SecTitle>
          <div className="flex flex-wrap gap-3">
            {porFaixa.map((f) => (
              <div key={f.faixa} className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs font-medium text-slate-500">{f.faixa}</div>
                <div className="mt-1 text-xl font-bold tabular-nums text-slate-800">{f.qtd}</div>
                <div className="text-xs text-red-600 tabular-nums">+ {fmtMoney(f.encargos)} encargos</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div>
        <SecTitle>Pagamentos em atraso — {atrasados.length} linha(s)</SecTitle>
        <p className="-mt-1 mb-2 text-xs text-slate-400">
          Multa e juros em vermelho. Em atraso = pago com multa/juros ou após o vencimento;
          “c/ acréscimos” = encargos sem diferença de data no comprovante.
        </p>
        <FilterTable rows={atrasados} cols={cols} initialSort="total" />
      </div>
    </div>
  );
}
