// Anotações de duplicidade (comentário + "não é duplicidade" c/ justificativa) e
// armazenamento/abertura do PDF de origem (Supabase Storage, bucket darf-pdfs).
import type { SupabaseClient } from "@supabase/supabase-js";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface DupNote {
  comentario: string;
  naoDuplicidade: boolean;
  justificativa: string;
}

// Chave estável do grupo (mesma lógica do dedup: cnpj|codigo|competência|vencimento|valor).
export function chaveGrupo(
  cnpj: string,
  codigo: string,
  competencia: string | null,
  vencimento: string | null,
  valor: number
): string {
  return `${cnpj}|${codigo}|${competencia ?? "n/d"}|${vencimento ?? "n/d"}|${valor.toFixed(2)}`;
}

export async function fetchNotas(supabase: SupabaseClient): Promise<Record<string, DupNote>> {
  const { data, error } = await supabase
    .from("trib_darf_dup_notes")
    .select("grupo_chave, comentario, nao_duplicidade, justificativa")
    .limit(20000);
  if (error) return {};
  const out: Record<string, DupNote> = {};
  for (const r of data ?? [])
    out[(r as any).grupo_chave] = {
      comentario: (r as any).comentario ?? "",
      naoDuplicidade: !!(r as any).nao_duplicidade,
      justificativa: (r as any).justificativa ?? "",
    };
  return out;
}

export async function salvarNota(supabase: SupabaseClient, chave: string, note: DupNote): Promise<void> {
  const { error } = await supabase.from("trib_darf_dup_notes").upsert({
    grupo_chave: chave,
    comentario: note.comentario || null,
    nao_duplicidade: note.naoDuplicidade,
    justificativa: note.justificativa || null,
  });
  if (error) throw error;
}

const BUCKET = "darf-pdfs";

/** Sobe o PDF de origem e devolve o path no bucket (ou null se falhar). */
export async function uploadPdf(supabase: SupabaseClient, file: File): Promise<string | null> {
  const safe = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${Date.now()}-${Math.round(Math.random() * 1e6)}-${safe}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (error) return null;
  return path;
}

/** URL assinada (temporária) para abrir o PDF de origem. */
export async function urlPdf(supabase: SupabaseClient, path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 120);
  if (error || !data) return null;
  return data.signedUrl;
}
