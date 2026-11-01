// Comparação de dois relatórios de Situação Fiscal do MESMO CNPJ (anterior x
// atual), linha a linha, para marcar cada linha das tabelas com uma tag:
//   novo    → surgiu neste relatório
//   baixado → estava no anterior e saiu (linha exibida com os dados do anterior)
//   mudou   → só p/ débitos: mudou o PRINCIPAL (Vl. Original). Sdo. devedor,
//             multa, juros e consolidado são ignorados (corrigidos todo mês).
import type { FiscalDebito } from "@/data/fiscal-tipos";
import { fmtMoney } from "@/lib/format";

export type Tag = "novo" | "baixado" | "mudou" | null;

export interface Linha<T> {
  x: T;
  tag: Tag;
  obs?: string; // p/ "mudou": valor anterior → atual
}

/** Linhas atuais (marcadas "novo" quando não existiam) + as do anterior que
 *  saíram ("baixado"). Sem anterior → nenhuma tag. */
export function marcarLinhas<T>(
  atual: T[],
  prev: T[] | undefined,
  keyOf: (x: T) => string,
  mudou?: (a: T, p: T) => string | null
): Linha<T>[] {
  if (!prev) return atual.map((x) => ({ x, tag: null }));
  const mp = new Map(prev.map((x) => [keyOf(x), x]));
  const ka = new Set(atual.map(keyOf));
  const out: Linha<T>[] = atual.map((x) => {
    const p = mp.get(keyOf(x));
    if (!p) return { x, tag: "novo" };
    const obs = mudou ? mudou(x, p) : null;
    return obs ? { x, tag: "mudou", obs } : { x, tag: null };
  });
  for (const x of prev) if (!ka.has(keyOf(x))) out.push({ x, tag: "baixado" });
  return out;
}

export const chaveDebito = (d: FiscalDebito) => `${d.receita}|${d.periodo}|${d.vencimento}`;

/** Mudança de principal de um débito (null = sem mudança relevante). */
export function mudouDebito(a: FiscalDebito, p: FiscalDebito): string | null {
  return a.valorOriginal !== p.valorOriginal
    ? `Vl. original ${fmtMoney(p.valorOriginal)} → ${fmtMoney(a.valorOriginal)}`
    : null;
}
