// Leitura de "Comprovante de Arrecadação" (DARF) do e-CAC em PDF (com texto).
// Usa extração em ORDEM NATURAL (pdfText.ts) — a leitura por coordenada não funciona
// nesses comprovantes. Um comprovante pode ter VÁRIOS tributos (composição); cada um
// vira uma linha. Ordem das colunas de valor no e-CAC: Principal, Multa, Juros, Total
// (validado pela soma P+M+J=Total em 971 linhas reais).
"use client";

import type { DarfLinha } from "@/data/darfs";
import { lerPaginasNaturais } from "@/lib/pdfText";

const VAL = "(?:\\d{1,3}(?:\\.\\d{3})*,\\d{2}|0,00|-)";

function parseNumBR(s: string): number {
  const t = (s || "").trim();
  if (!t || t === "-") return 0;
  const n = parseFloat(t.replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

function toISO(s: string): string | null {
  const m = (s || "").match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  if (`${m[1]}/${m[2]}/${m[3]}` === "01/01/1980") return null; // placeholder de estimativa
  return `${m[3]}-${m[2]}-${m[1]}`;
}

// Uma página só é lida se for um "Comprovante de Arrecadação" com a composição do
// documento — evita ler relatórios fiscais, certidões e outros PDFs por engano.
export function ehComprovante(t: string): boolean {
  return (
    /Comprovante de Arrecada[çc][ãa]o/i.test(t) &&
    /Composi[çc][ãa]o do Documento de Arrecada[çc][ãa]o/i.test(t)
  );
}

// Parseia uma página de comprovante → uma ou mais linhas (um por tributo).
function parseComprovante(t: string): DarfLinha[] {
  if (!ehComprovante(t)) return [];
  const cnpj = (t.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/) || [])[1] || "";
  // Após CNPJ + razão: Período Apuração, Vencimento, Número do Documento.
  const hdr = t.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\s+.+?\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{10,})/);
  const pa = hdr ? hdr[1] : "";
  const vcto = hdr ? hdr[2] : "";
  const doc = hdr ? hdr[3] : "";
  const arre = (t.match(/Refer[êe]ncia\s+(\d{2}\/\d{2}\/\d{4})/) || [])[1] || "";
  const banco = (t.match(/(\d{3}\s*-\s*[A-ZÀ-Ú][A-ZÀ-Ú .]+?)\s+\d{3,4}\s+\d{3,4}/) || [])[1] || "";

  // Só a seção de composição (entre o título e "Totais").
  const i0 = t.search(/Composi[çc][ãa]o do Documento de Arrecada[çc][ãa]o/i);
  const i1 = t.search(/\bTotais\b/);
  const comp = i0 >= 0 ? t.slice(i0, i1 > i0 ? i1 : t.length) : "";

  // Cada tributo: código(4) descrição valores(Principal Multa Juros Total) e depois "NN - SUBITEM".
  const re = new RegExp(`(\\d{4})\\s+(.+?)\\s+(${VAL})\\s+(${VAL})\\s+(${VAL})\\s+(${VAL})\\s+(?=\\d{2}\\s*-|$)`, "g");
  const out: DarfLinha[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(comp))) {
    out.push({
      id: 0,
      arquivo: "PDF",
      cnpj,
      codigo: m[1],
      tributo: m[2].trim(),
      periodoApuracao: toISO(pa),
      vencimento: toISO(vcto),
      recolhimento: toISO(arre),
      principal: parseNumBR(m[3]),
      multa: parseNumBR(m[4]),
      juros: parseNumBR(m[5]),
      total: parseNumBR(m[6]),
      banco: banco.trim(),
      numeroDocumento: doc,
    });
  }
  return out;
}

export interface PdfImportResult {
  linhas: DarfLinha[];
  escaneados: number; // imagem (sem texto) — precisa OCR
  rejeitados: number; // tem texto, mas não é comprovante de arrecadação
  erro?: string;
}

export async function importarPdfs(files: File[]): Promise<PdfImportResult> {
  const linhas: DarfLinha[] = [];
  let escaneados = 0;
  let rejeitados = 0;
  for (const f of files) {
    let r;
    try {
      r = await lerPaginasNaturais(f);
    } catch {
      rejeitados++;
      continue;
    }
    if (r.chars < 30) {
      escaneados++;
      continue;
    }
    const comprovantes = r.paginas.filter(ehComprovante);
    if (!comprovantes.length) {
      rejeitados++;
      continue;
    }
    for (const pg of comprovantes) linhas.push(...parseComprovante(pg));
  }
  return { linhas, escaneados, rejeitados };
}
