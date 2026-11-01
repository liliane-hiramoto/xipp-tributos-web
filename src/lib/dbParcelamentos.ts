// Ponte entre a tabela trib_parcelamentos (Supabase) e o Parcelamento do app.
// 1 linha por pedido; um upload novo do mesmo pedido é mesclado ao existente.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Parcelamento } from "@/data/parcelamentos";
import { mesclarParcelamento } from "@/lib/importParcelamento";

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function fetchParcelamentos(supabase: SupabaseClient): Promise<Parcelamento[]> {
  const { data, error } = await supabase.from("trib_parcelamentos").select("dados").limit(5000);
  if (error) throw error;
  return (data ?? []).map((r: any) => r.dados as Parcelamento);
}

/** Grava (mesclando com o que já existe do mesmo pedido). Retorna quantos pedidos
 *  foram criados e quantos atualizados. */
export async function salvarParcelamentos(supabase: SupabaseClient, lista: Parcelamento[]): Promise<{ novos: number; atualizados: number }> {
  let novos = 0;
  let atualizados = 0;
  for (const p of lista) {
    const { data: ex, error: e1 } = await supabase
      .from("trib_parcelamentos")
      .select("dados")
      .eq("cnpj", p.cnpj)
      .eq("sigla", p.sigla)
      .eq("numero", p.numero)
      .limit(1);
    if (e1) throw e1;
    const atual = ex && ex[0] ? mesclarParcelamento((ex[0] as any).dados as Parcelamento, p) : p;
    const { error } = await supabase.from("trib_parcelamentos").upsert(
      {
        cnpj: atual.cnpj,
        sigla: atual.sigla,
        numero: atual.numero,
        razao_social: atual.razaoSocial,
        situacao: atual.situacao,
        dados: atual,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "cnpj,sigla,numero" }
    );
    if (error) throw error;
    if (ex && ex[0]) atualizados++;
    else novos++;
  }
  return { novos, atualizados };
}
