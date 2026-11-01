"use client";

import { useState } from "react";
import type { Insight, Nivel } from "@/lib/insights";
import { Card, Selo } from "@/components/ui";

const COR: Record<Nivel, string> = { critico: "#dc2626", alto: "#d97706", medio: "#ca8a04", info: "#0891b2" };
const ROT: Record<Nivel, string> = { critico: "crítico", alto: "alto", medio: "médio", info: "info" };

// Lista de insights (recomendações por regra). `mostrarEmpresa` = visão consolidada.
// Clicar nas tags de nível filtra a lista (várias podem ficar ativas).
export default function FiscalInsights({ insights, mostrarEmpresa }: { insights: Insight[]; mostrarEmpresa?: boolean }) {
  const [sel, setSel] = useState<Nivel[]>([]);
  if (!insights.length) return null;
  const n = (k: Nivel) => insights.filter((i) => i.nivel === k).length;
  const lista = sel.length ? insights.filter((i) => sel.includes(i.nivel)) : insights;
  const alternar = (k: Nivel) => setSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-center gap-2 px-5 pb-3 pt-4">
        <span className="text-sm font-semibold uppercase tracking-wide text-slate-600">Insights</span>
        {(["critico", "alto", "medio", "info"] as Nivel[]).map((k) =>
          n(k) ? (
            <button
              key={k}
              onClick={() => alternar(k)}
              title={sel.includes(k) ? "Remover filtro" : `Mostrar só ${ROT[k]}`}
              className={`rounded-full ${sel.includes(k) ? "ring-2 ring-offset-1" : sel.length ? "opacity-50" : ""}`}
              style={{ ["--tw-ring-color" as string]: COR[k] }}
            >
              <Selo color={COR[k]}>
                {n(k)} {ROT[k]}
              </Selo>
            </button>
          ) : null
        )}
        {sel.length ? (
          <button onClick={() => setSel([])} className="text-[11px] text-slate-500 underline">
            todos
          </button>
        ) : null}
        <span className="ml-auto text-[11px] text-slate-400">Gerados por regras a partir dos relatórios importados — orientação, não parecer.</span>
      </div>
      <ul className="divide-y divide-slate-100 border-t border-slate-100">
        {lista.map((i, k) => (
          <li key={k} className="flex gap-3 px-5 py-2.5">
            <span className="mt-0.5 shrink-0">
              <Selo color={COR[i.nivel]}>{ROT[i.nivel]}</Selo>
            </span>
            <div className="min-w-0 text-sm">
              <div className="font-medium text-slate-800">
                {mostrarEmpresa && i.empresa ? <span className="text-slate-500">{i.empresa} · </span> : null}
                {i.titulo}
              </div>
              <div className="text-xs text-slate-500">{i.texto}</div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
