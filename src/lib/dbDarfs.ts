// Ponte entre a tabela trib_darfs (Supabase) e o tipo DarfLinha do app.
// Dedup feito no código (não exige índice único / SQL extra).
import type { DarfLinha } from "@/data/darfs";
import type { SupabaseClient } from "@supabase/supabase-js";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Colunas base (sempre existem). arquivo_path só existe após a migração 0006 —
// por isso a leitura/gravação abaixo degradam graciosamente se ela ainda não rodou.
const COLS =
  "cnpj, codigo, tributo, periodo_apuracao, vencimento, recolhimento, principal, multa, juros, total, banco, numero_documento, arquivo";
const COLS_PDF = COLS + ", arquivo_path";

export function rowToDarf(r: any, i: number): DarfLinha {
  return {
    id: i + 1,
    arquivo: r.arquivo ?? "",
    cnpj: r.cnpj ?? "",
    codigo: r.codigo ?? "",
    tributo: r.tributo ?? "",
    periodoApuracao: r.periodo_apuracao ?? null,
    vencimento: r.vencimento ?? null,
    recolhimento: r.recolhimento ?? null,
    principal: Number(r.principal) || 0,
    multa: Number(r.multa) || 0,
    juros: Number(r.juros) || 0,
    total: Number(r.total) || 0,
    banco: r.banco ?? "",
    numeroDocumento: r.numero_documento ?? "",
    arquivoPath: r.arquivo_path ?? undefined,
  };
}

export function darfToRow(d: DarfLinha) {
  return {
    cnpj: d.cnpj,
    codigo: d.codigo,
    tributo: d.tributo,
    periodo_apuracao: d.periodoApuracao,
    vencimento: d.vencimento,
    recolhimento: d.recolhimento,
    principal: d.principal,
    multa: d.multa,
    juros: d.juros,
    total: d.total,
    banco: d.banco,
    numero_documento: d.numeroDocumento,
    arquivo: d.arquivo,
    arquivo_path: d.arquivoPath ?? null,
  };
}

// Chave natural (mesma do dedup do app): documento+código+valores.
export function chaveDarf(d: {
  numeroDocumento?: string;
  numero_documento?: string;
  codigo: string;
  principal: number;
  multa: number;
  juros: number;
  total: number;
}): string {
  const doc = (d as any).numeroDocumento ?? (d as any).numero_documento ?? "";
  return `${doc}|${d.codigo}|${d.principal}|${d.multa}|${d.juros}|${d.total}`;
}

/** Lê todos os DARFs do banco (ordem: recolhimento desc). Tenta trazer arquivo_path;
 *  se a coluna ainda não existe (migração 0006 pendente), lê sem ela. */
export async function fetchDarfs(supabase: SupabaseClient): Promise<DarfLinha[]> {
  const q = (cols: string) =>
    supabase.from("trib_darfs").select(cols).order("recolhimento", { ascending: false }).limit(20000);
  let { data, error } = await q(COLS_PDF);
  if (error) ({ data, error } = await q(COLS));
  if (error) throw error;
  return ((data ?? []) as any[]).map(rowToDarf);
}

export interface ResultadoSalvar {
  inseridos: number;
  jaNoBanco: number; // mesma chave já existia no banco
  noArquivo: number; // repetido dentro do próprio lote de upload (ex.: nº doc em branco)
}

/**
 * Grava linhas no banco ignorando as que já existem (dedup por chave natural:
 * documento + código + valores). Também remove duplicatas dentro do próprio lote.
 */
export async function salvarDarfs(
  supabase: SupabaseClient,
  linhas: DarfLinha[]
): Promise<ResultadoSalvar> {
  const { data: existentes, error: e1 } = await supabase
    .from("trib_darfs")
    .select("numero_documento, codigo, principal, multa, juros, total")
    .limit(100000);
  if (e1) throw e1;
  const noBancoSet = new Set((existentes ?? []).map((r: any) => chaveDarf(r)));
  const vistos = new Set(noBancoSet);

  const novas: DarfLinha[] = [];
  let jaNoBanco = 0;
  let noArquivo = 0;
  for (const d of linhas) {
    const k = chaveDarf(d);
    if (noBancoSet.has(k)) {
      jaNoBanco++;
      continue; // mesma chave já está no banco
    }
    if (vistos.has(k)) {
      noArquivo++;
      continue; // repetido dentro do próprio lote (ex.: nº doc em branco)
    }
    vistos.add(k);
    novas.push(d);
  }
  if (novas.length) {
    const LOTE = 500;
    for (let i = 0; i < novas.length; i += LOTE) {
      const rows = novas.slice(i, i + LOTE).map(darfToRow);
      let { error } = await supabase.from("trib_darfs").insert(rows);
      if (error) {
        // arquivo_path pode não existir ainda (0006 pendente) → grava sem ela.
        const stripped = rows.map((r) => {
          const c = { ...r } as Record<string, unknown>;
          delete c.arquivo_path;
          return c;
        });
        ({ error } = await supabase.from("trib_darfs").insert(stripped));
      }
      if (error) throw error;
    }
  }
  return { inseridos: novas.length, jaNoBanco, noArquivo };
}

/** Apaga TODOS os DARFs do banco (para recomeçar do zero). Retorna quantos havia. */
export async function limparDarfs(supabase: SupabaseClient): Promise<number> {
  const { count } = await supabase.from("trib_darfs").select("*", { count: "exact", head: true });
  const { error } = await supabase.from("trib_darfs").delete().gte("id", 0);
  if (error) throw error;
  return count ?? 0;
}
