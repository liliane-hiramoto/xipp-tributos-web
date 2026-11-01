// Adapter de leitura do CADASTRO CENTRAL de empresas (tabela public.empresas do
// hub Supabase desta instância — criada por supabase/migrations/0003_cadastro.sql
// no repo do portal o portal da instância e replicada em cada hub).
//
// Padrão Ports & Adapters: o "port" é fetchEmpresas() → EmpresaReg[]; o "adapter"
// é o Supabase do browser. O módulo Fiscal é REPLICÁVEL — cada instância (Affix,
// Flórida, RQ, novas empresas) aponta seu env para o SEU hub e consome o SEU
// cadastro + SSO. Nada é compartilhado entre instâncias.

import { createClient } from "@/lib/supabase/client";
import type { EmpresaReg } from "@/lib/darf";

type SB = ReturnType<typeof createClient>;

type EmpresaRow = {
  cnpj: string;
  apelido: string | null;
  razao_social: string | null;
  ativo: boolean | null;
};

/**
 * Lê as empresas do cadastro central (RLS: select para qualquer autenticado).
 * Retorna [] em erro/tabela ausente — o DashboardShell cai no EMPRESAS_PADRAO.
 */
export async function fetchEmpresas(supabase: SB): Promise<EmpresaReg[]> {
  const { data, error } = await supabase
    .from("empresas")
    .select("cnpj,apelido,razao_social,ativo")
    .order("apelido");
  if (error || !data) return [];
  return (data as EmpresaRow[]).map((r) => ({
    cnpj: r.cnpj,
    apelido: r.apelido || r.razao_social || r.cnpj,
    nome: r.razao_social || r.apelido || r.cnpj,
    ativo: r.ativo ?? true,
  }));
}
