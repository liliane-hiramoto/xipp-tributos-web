// Certidões de regularidade por INSTÂNCIA (upload recorrente; os PDFs não são
// gravados, só o parseado, versionado em snapshots). Dois tipos hoje:
//  - cndt: Certidão Negativa de Débitos Trabalhistas (TST)
//  - fgts: Certificado de Regularidade do FGTS - CRF (Caixa)

export type CertidaoTipo = "cndt" | "fgts";

export interface Certidao {
  tipo: CertidaoTipo;
  cnpj: string;
  cnpjRaiz: string;
  razaoSocial: string;
  numero: string;
  emissao: string; // expedição / emissão (DD/MM/AAAA)
  validade: string; // validade (fim), DD/MM/AAAA
  validadeInicio: string; // FGTS tem início de validade; CNDT vazio
  situacao: string; // texto (ex.: "NÃO CONSTA", "REGULAR")
  regular: boolean; // true = negativa/regular
  obtidoEm: string; // data/hora da consulta
  arquivo: string;
}

export const TIPO_LABEL: Record<CertidaoTipo, string> = {
  cndt: "Trabalhista (CNDT)",
  fgts: "FGTS (CRF)",
};
