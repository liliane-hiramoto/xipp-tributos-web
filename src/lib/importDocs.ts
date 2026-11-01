// Classificador único de upload: recebe PDFs variados e roteia cada um pelo tipo —
// relatório de Situação Fiscal, CNDT (trabalhista), CND FGTS (CRF) ou pedido de
// parcelamento do e-CAC (consolidação / demonstrativo de pagamentos). Lê cada
// arquivo uma vez (ordem natural) e devolve o parseado separado por tipo.
"use client";

import { lerPaginasNaturais } from "@/lib/pdfText";
import { ehRelatorioSituacaoFiscal, parseSituacaoFiscal } from "@/lib/importFiscal";
import { ehCNDT, ehFGTS, parseCNDT, parseFGTS } from "@/lib/importCertidoes";
import { ehPedidoParcelamento, parsePedidoParcelamento, mesclarParcelamento, chaveParcelamento } from "@/lib/importParcelamento";
import type { Parcelamento } from "@/data/parcelamentos";
import type { FiscalEmpresa } from "@/data/fiscal-tipos";
import type { Certidao } from "@/data/certidoes";

/** Arquivo reconhecido, com os metadados p/ o repositório de documentos. */
export interface DocArquivo {
  file: File;
  tipo: "situacao_fiscal" | "cndt" | "fgts" | "parcelamento";
  cnpj: string;
  razaoSocial: string;
  referencia: string;
}

export interface DocsImportResult {
  arquivos: DocArquivo[];
  fiscais: FiscalEmpresa[];
  certidoes: Certidao[];
  parcelamentos: Parcelamento[];
  rejeitados: number;
  escaneados: number;
}

export async function importarDocumentos(files: File[]): Promise<DocsImportResult> {
  const fiscais: FiscalEmpresa[] = [];
  const certidoes: Certidao[] = [];
  const arquivos: DocArquivo[] = [];
  const parc = new Map<string, Parcelamento>(); // consolidação + pagamentos do mesmo pedido
  let rejeitados = 0;
  let escaneados = 0;
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
    if (ehRelatorioSituacaoFiscal(r.paginas)) {
      const e = parseSituacaoFiscal(r.paginas, f.name);
      fiscais.push(e);
      arquivos.push({ file: f, tipo: "situacao_fiscal", cnpj: e.cnpj, razaoSocial: e.razaoSocial, referencia: e.dataConsulta });
    } else if (ehCNDT(r.paginas) || ehFGTS(r.paginas)) {
      const c = ehCNDT(r.paginas) ? parseCNDT(r.paginas, f.name) : parseFGTS(r.paginas, f.name);
      certidoes.push(c);
      arquivos.push({ file: f, tipo: c.tipo, cnpj: c.cnpj, razaoSocial: c.razaoSocial, referencia: c.obtidoEm || c.emissao });
    } else if (ehPedidoParcelamento(r.paginas)) {
      const p = parsePedidoParcelamento(r.paginas, f.name);
      if (!p) {
        rejeitados++;
        continue;
      }
      arquivos.push({ file: f, tipo: "parcelamento", cnpj: p.cnpj, razaoSocial: p.razaoSocial, referencia: `${p.sigla} nº ${p.numero} · ${p.emitidoEm}` });
      const k = chaveParcelamento(p);
      const ja = parc.get(k);
      parc.set(k, ja ? mesclarParcelamento(ja, p) : p);
    } else rejeitados++;
  }
  return { arquivos, fiscais, certidoes, parcelamentos: [...parc.values()], rejeitados, escaneados };
}
