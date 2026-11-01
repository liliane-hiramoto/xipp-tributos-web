// Ponte entre a tabela trib_fiscal_snapshots (Supabase) e o FiscalEmpresa do app.
// Cada upload de um relatório vira 1 snapshot (histórico). O "estado atual" de uma
// empresa é o snapshot mais recente por CNPJ. Nunca grava o PDF, só o parseado.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FiscalEmpresa } from "@/data/fiscal-tipos";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Hash estável do conteúdo relevante (ignora dataConsulta/arquivo) p/ dedup de
// re-upload idêntico. Simples (djb2) — suficiente para comparar dois snapshots.
export function hashEmpresa(e: FiscalEmpresa): string {
  const rel = {
    cnpj: e.cnpj, cadastro: e.cadastro, certidao: e.certidao, debitos: e.debitos,
    processos: e.processos, parcelamentos: e.parcelamentos, inscricoes: e.inscricoes, divida: e.divida,
    ...(e.omissoes?.length ? { omissoes: e.omissoes } : {}),
  };
  const s = JSON.stringify(rel);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

export interface SnapshotMeta {
  id: number;
  cnpj: string;
  razaoSocial: string;
  dataConsulta: string;
  arquivo: string;
  enviadoEm: string;
  hash: string;
}

const SEL_META = "id, cnpj, razao_social, data_consulta, arquivo, conteudo_hash, enviado_em";

export interface ResultadoFiscal {
  inseridos: number;
  duplicados: number; // idênticos ao último snapshot do CNPJ (só a data da consulta é atualizada)
}

/** Grava 1 snapshot por empresa. Se o conteúdo for idêntico ao último snapshot
 *  daquele CNPJ, não cria histórico novo, mas ATUALIZA a data da consulta (e o
 *  arquivo) desse último snapshot — senão a tela continuaria mostrando a data antiga. */
export async function salvarSnapshots(supabase: SupabaseClient, empresas: FiscalEmpresa[]): Promise<ResultadoFiscal> {
  let inseridos = 0;
  let duplicados = 0;
  for (const e of empresas) {
    const hash = hashEmpresa(e);
    const { data: ult } = await supabase
      .from("trib_fiscal_snapshots")
      .select("id, conteudo_hash")
      .eq("cnpj", e.cnpj)
      .order("enviado_em", { ascending: false })
      .limit(1);
    if (ult && ult[0] && ult[0].conteudo_hash === hash) {
      const { error } = await supabase
        .from("trib_fiscal_snapshots")
        .update({ data_consulta: e.dataConsulta, arquivo: e.arquivo, dados: e })
        .eq("id", ult[0].id);
      if (error) throw error;
      duplicados++;
      continue;
    }
    const { error } = await supabase.from("trib_fiscal_snapshots").insert({
      cnpj: e.cnpj,
      razao_social: e.razaoSocial,
      data_consulta: e.dataConsulta,
      arquivo: e.arquivo,
      total_original: e.totalOriginal,
      total_saldo: e.totalSaldo,
      total_multa: e.totalMulta,
      total_juros: e.totalJuros,
      total_consolidado: e.totalConsolidado,
      sem_pendencias: e.semPendencias,
      conteudo_hash: hash,
      dados: e,
    });
    if (error) throw error;
    inseridos++;
  }
  return { inseridos, duplicados };
}

/** Último snapshot (estado atual) por CNPJ. */
export async function fetchLatest(supabase: SupabaseClient): Promise<FiscalEmpresa[]> {
  const { data, error } = await supabase
    .from("trib_fiscal_snapshots")
    .select("cnpj, dados, enviado_em")
    .order("enviado_em", { ascending: false })
    .limit(5000);
  if (error) throw error;
  const seen = new Set<string>();
  const out: FiscalEmpresa[] = [];
  for (const r of data ?? []) {
    if (seen.has((r as any).cnpj)) continue;
    seen.add((r as any).cnpj);
    out.push((r as any).dados as FiscalEmpresa);
  }
  return out;
}

/** Numa query, o snapshot ATUAL e o ANTERIOR de cada CNPJ (p/ divergências). */
export async function fetchAtuaisEAnteriores(
  supabase: SupabaseClient
): Promise<{ atuais: FiscalEmpresa[]; anteriorPorCnpj: Record<string, FiscalEmpresa> }> {
  const { data, error } = await supabase
    .from("trib_fiscal_snapshots")
    .select("cnpj, dados, enviado_em")
    .order("enviado_em", { ascending: false })
    .limit(8000);
  if (error) throw error;
  const count = new Map<string, number>();
  const atuais: FiscalEmpresa[] = [];
  const anteriorPorCnpj: Record<string, FiscalEmpresa> = {};
  for (const r of data ?? []) {
    const cnpj = (r as any).cnpj as string;
    const n = count.get(cnpj) ?? 0;
    if (n === 0) atuais.push((r as any).dados as FiscalEmpresa);
    else if (n === 1) anteriorPorCnpj[cnpj] = (r as any).dados as FiscalEmpresa;
    count.set(cnpj, n + 1);
  }
  return { atuais, anteriorPorCnpj };
}

/** Histórico (metadados) de um CNPJ, do mais novo p/ o mais antigo. */
export async function fetchHistorico(supabase: SupabaseClient, cnpj: string): Promise<SnapshotMeta[]> {
  const { data, error } = await supabase
    .from("trib_fiscal_snapshots")
    .select(SEL_META)
    .eq("cnpj", cnpj)
    .order("enviado_em", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id, cnpj: r.cnpj, razaoSocial: r.razao_social, dataConsulta: r.data_consulta,
    arquivo: r.arquivo, enviadoEm: r.enviado_em, hash: r.conteudo_hash,
  }));
}

/** Dados completos de um snapshot pelo id (para comparar duas versões). */
export async function fetchSnapshot(supabase: SupabaseClient, id: number): Promise<FiscalEmpresa | null> {
  const { data, error } = await supabase.from("trib_fiscal_snapshots").select("dados").eq("id", id).limit(1);
  if (error) throw error;
  return data && data[0] ? ((data[0] as any).dados as FiscalEmpresa) : null;
}

/** Penúltimo snapshot de um CNPJ (o "anterior" ao atual), se houver. */
export async function fetchAnterior(supabase: SupabaseClient, cnpj: string): Promise<FiscalEmpresa | null> {
  const { data, error } = await supabase
    .from("trib_fiscal_snapshots")
    .select("dados")
    .eq("cnpj", cnpj)
    .order("enviado_em", { ascending: false })
    .range(1, 1);
  if (error) throw error;
  return data && data[0] ? ((data[0] as any).dados as FiscalEmpresa) : null;
}

/** Apaga TODO o histórico fiscal. Retorna quantos snapshots havia. */
export async function limparFiscal(supabase: SupabaseClient): Promise<number> {
  const { count } = await supabase.from("trib_fiscal_snapshots").select("*", { count: "exact", head: true });
  const { error } = await supabase.from("trib_fiscal_snapshots").delete().gte("id", 0);
  if (error) throw error;
  return count ?? 0;
}

export interface PontoEvolucao {
  cnpj: string;
  dataConsulta: string;
  original: number;
  consolidado: number;
}

/** Série histórica (principal/consolidado) por CNPJ, do mais antigo p/ o mais novo.
 *  Só snapshots do leitor atual (versaoLeitor >= 2): os antigos perdiam linhas e
 *  somavam os débitos a vencer, então distorceriam a evolução. */
export async function fetchEvolucao(supabase: SupabaseClient): Promise<PontoEvolucao[]> {
  const { data, error } = await supabase
    .from("trib_fiscal_snapshots")
    .select("cnpj, data_consulta, total_original, total_consolidado, versao:dados->versaoLeitor, enviado_em")
    .order("enviado_em", { ascending: true })
    .limit(8000);
  if (error) throw error;
  return (data ?? [])
    .filter((r: any) => Number(r.versao ?? 1) >= 2)
    .map((r: any) => ({
      cnpj: r.cnpj,
      dataConsulta: r.data_consulta || "",
      original: Number(r.total_original) || 0,
      consolidado: Number(r.total_consolidado) || 0,
    }));
}
