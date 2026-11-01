// Ponte entre trib_certidoes_snapshots (Supabase) e Certidao. Cada upload vira 1
// snapshot por (cnpj, tipo); o "atual" é o mais recente. Nunca grava o PDF.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Certidao } from "@/data/certidoes";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function chaveCert(cnpj: string, tipo: string): string {
  return `${cnpj}|${tipo}`;
}

export function hashCertidao(c: Certidao): string {
  const s = `${c.tipo}|${c.cnpj}|${c.numero}|${c.emissao}|${c.validade}|${c.situacao}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

export interface ResultadoCert {
  inseridos: number;
  duplicados: number;
}

export async function salvarCertidoes(supabase: SupabaseClient, certs: Certidao[]): Promise<ResultadoCert> {
  let inseridos = 0;
  let duplicados = 0;
  for (const c of certs) {
    const hash = hashCertidao(c);
    const { data: ult } = await supabase
      .from("trib_certidoes_snapshots")
      .select("conteudo_hash")
      .eq("cnpj", c.cnpj)
      .eq("tipo", c.tipo)
      .order("enviado_em", { ascending: false })
      .limit(1);
    if (ult && ult[0] && ult[0].conteudo_hash === hash) {
      duplicados++;
      continue;
    }
    const { error } = await supabase.from("trib_certidoes_snapshots").insert({
      tipo: c.tipo,
      cnpj: c.cnpj,
      razao_social: c.razaoSocial,
      numero: c.numero,
      emissao: c.emissao,
      validade: c.validade,
      situacao: c.situacao,
      regular: c.regular,
      conteudo_hash: hash,
      dados: c,
    });
    if (error) throw error;
    inseridos++;
  }
  return { inseridos, duplicados };
}

/** Atual + anterior por (cnpj, tipo), numa query. */
export async function fetchCertidoes(
  supabase: SupabaseClient
): Promise<{ atuais: Certidao[]; anteriorPorChave: Record<string, Certidao> }> {
  const { data, error } = await supabase
    .from("trib_certidoes_snapshots")
    .select("cnpj, tipo, dados, enviado_em")
    .order("enviado_em", { ascending: false })
    .limit(8000);
  if (error) throw error;
  const count = new Map<string, number>();
  const atuais: Certidao[] = [];
  const anteriorPorChave: Record<string, Certidao> = {};
  for (const r of data ?? []) {
    const k = chaveCert((r as any).cnpj, (r as any).tipo);
    const n = count.get(k) ?? 0;
    if (n === 0) atuais.push((r as any).dados as Certidao);
    else if (n === 1) anteriorPorChave[k] = (r as any).dados as Certidao;
    count.set(k, n + 1);
  }
  return { atuais, anteriorPorChave };
}

export async function limparCertidoes(supabase: SupabaseClient): Promise<number> {
  const { count } = await supabase.from("trib_certidoes_snapshots").select("*", { count: "exact", head: true });
  const { error } = await supabase.from("trib_certidoes_snapshots").delete().gte("id", 0);
  if (error) throw error;
  return count ?? 0;
}
