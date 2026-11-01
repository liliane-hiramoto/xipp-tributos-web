// Repositório de documentos importados: o PDF original vai para o bucket privado
// 'docs-fiscais' e o índice (tipo, empresa, referência) para a tabela
// trib_documentos. O mesmo arquivo (mesmo SHA-256) não é guardado duas vezes.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocArquivo } from "@/lib/importDocs";

/* eslint-disable @typescript-eslint/no-explicit-any */

const BUCKET = "docs-fiscais";

export interface Documento {
  id: number;
  tipo: string;
  cnpj: string;
  razaoSocial: string;
  referencia: string;
  arquivo: string;
  path: string;
  tamanho: number;
  enviadoEm: string;
}

async function sha256(file: File): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Guarda os PDFs no repositório. Retorna quantos foram guardados, quantos já
 *  existiam e quantos falharam (a importação dos dados não depende disto). */
export async function arquivarDocumentos(
  supabase: SupabaseClient,
  docs: DocArquivo[]
): Promise<{ guardados: number; existentes: number; falhas: number }> {
  let guardados = 0;
  let existentes = 0;
  let falhas = 0;
  for (const d of docs) {
    try {
      const hash = await sha256(d.file);
      const { data: ja } = await supabase.from("trib_documentos").select("id").eq("hash", hash).limit(1);
      if (ja && ja.length) {
        existentes++;
        continue;
      }
      const safe = d.file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${d.tipo}/${(d.cnpj || "sem-cnpj").replace(/\D/g, "")}/${Date.now()}-${safe}`;
      const up = await supabase.storage.from(BUCKET).upload(path, d.file, { contentType: "application/pdf", upsert: false });
      if (up.error) throw up.error;
      const { error } = await supabase.from("trib_documentos").insert({
        tipo: d.tipo,
        cnpj: d.cnpj,
        razao_social: d.razaoSocial,
        referencia: d.referencia,
        arquivo: d.file.name,
        path,
        tamanho: d.file.size,
        hash,
      });
      if (error) throw error;
      guardados++;
    } catch {
      falhas++;
    }
  }
  return { guardados, existentes, falhas };
}

export async function fetchDocumentos(supabase: SupabaseClient): Promise<Documento[]> {
  const { data, error } = await supabase
    .from("trib_documentos")
    .select("id, tipo, cnpj, razao_social, referencia, arquivo, path, tamanho, enviado_em")
    .order("enviado_em", { ascending: false })
    .limit(5000);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    tipo: r.tipo,
    cnpj: r.cnpj || "",
    razaoSocial: r.razao_social || "",
    referencia: r.referencia || "",
    arquivo: r.arquivo,
    path: r.path,
    tamanho: Number(r.tamanho) || 0,
    enviadoEm: r.enviado_em,
  }));
}

/** URL assinada (temporária, 2 min) para abrir o PDF. */
export async function urlDocumento(supabase: SupabaseClient, path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 120);
  if (error || !data) return null;
  return data.signedUrl;
}
