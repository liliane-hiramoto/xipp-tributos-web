// Parsers das certidões de regularidade (upload recorrente): CNDT (trabalhista, TST)
// e CND FGTS (CRF, Caixa). PDFs simples de 1 página; extração em ordem natural.
"use client";

import { lerPaginasNaturais } from "@/lib/pdfText";
import type { Certidao } from "@/data/certidoes";

const raiz = (cnpj: string) => (cnpj || "").split("/")[0];

export function ehCNDT(paginas: string[]): boolean {
  const t = paginas.join(" ");
  return /D[ÉE]BITOS TRABALHISTAS/i.test(t) && /Banco Nacional de Devedores Trabalhistas/i.test(t);
}

export function ehFGTS(paginas: string[]): boolean {
  const t = paginas.join(" ");
  return /Certificado de Regularidade do\s*FGTS/i.test(t) || /FGTS\s*-\s*CRF/i.test(t);
}

function g1(t: string, re: RegExp): string {
  const m = t.match(re);
  return m ? m[1].trim() : "";
}

export function parseCNDT(paginas: string[], arquivo: string): Certidao {
  const t = paginas.join(" ").replace(/\s+/g, " ");
  const positiva = /CERTID[ÃA]O POSITIVA/i.test(t);
  const regular = /N[ÃA]O CONSTA/i.test(t) && !positiva;
  const cnpj = g1(t, /CNPJ:\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
  return {
    tipo: "cndt",
    cnpj,
    cnpjRaiz: raiz(cnpj),
    razaoSocial: g1(t, /Nome:\s*(.+?)\s*CNPJ:/),
    numero: g1(t, /Certid[ãa]o n[ºo]:\s*([\d/.-]+)/),
    emissao: g1(t, /Expedi[çc][ãa]o:\s*(\d{2}\/\d{2}\/\d{4})/),
    validade: g1(t, /Validade:\s*(\d{2}\/\d{2}\/\d{4})/),
    validadeInicio: "",
    situacao: regular ? "NÃO CONSTA (negativa)" : positiva ? "CONSTA (positiva)" : "—",
    regular,
    obtidoEm: g1(t, /Expedi[çc][ãa]o:\s*\d{2}\/\d{2}\/\d{4},?\s*[àa]s\s*([\d:]+)/),
    arquivo,
  };
}

export function parseFGTS(paginas: string[], arquivo: string): Certidao {
  const t = paginas.join(" ").replace(/\s+/g, " ");
  const cnpj = g1(t, /Inscri[çc][ãa]o:\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
  const val = t.match(/Validade:\s*(\d{2}\/\d{2}\/\d{4})\s*a\s*(\d{2}\/\d{2}\/\d{4})/);
  const regular = /situa[çc][ãa]o regular perante o/i.test(t);
  return {
    tipo: "fgts",
    cnpj,
    cnpjRaiz: raiz(cnpj),
    razaoSocial: g1(t, /Raz[ãa]o\s*social:\s*(.+?)\s*Endere[çc]o:/),
    numero: g1(t, /Certifica[çc][ãa]o N[úu]mero:\s*(\d+)/),
    emissao: val ? val[1] : "",
    validade: val ? val[2] : "",
    validadeInicio: val ? val[1] : "",
    situacao: regular ? "REGULAR" : "IRREGULAR",
    regular,
    obtidoEm: g1(t, /Informa[çc][ãa]o obtida em\s*([\d/: ]+?)(?:\s+A utiliza|$)/),
    arquivo,
  };
}

export interface CertidaoImportResult {
  certidoes: Certidao[];
  rejeitados: number;
  escaneados: number;
}

export async function importarCertidoes(files: File[]): Promise<CertidaoImportResult> {
  const certidoes: Certidao[] = [];
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
    if (ehCNDT(r.paginas)) certidoes.push(parseCNDT(r.paginas, f.name));
    else if (ehFGTS(r.paginas)) certidoes.push(parseFGTS(r.paginas, f.name));
    else rejeitados++;
  }
  return { certidoes, rejeitados, escaneados };
}
