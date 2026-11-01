// Situação Fiscal (RFB + PGFN, e-CAC) — MODELO de dados por INSTÂNCIA. Módulo
// reutilizável (tributos-web): não traz dados de nenhuma empresa embutidos. Os
// dados entram por UPLOAD recorrente (parser em src/lib/importFiscal.ts) e ficam
// versionados em snapshots (tabela trib_fiscal_snapshots). FISCAL segue vazio.

export interface Socio {
  cpfCnpj: string;
  nome: string;
  qualificacao: string;
  situacaoCadastral: string;
  capSocial: string;
  capVotante: string;
}

export interface SimplesPeriodo {
  inclusao: string;
  exclusao: string;
}

export interface FiscalCadastro {
  cnpj: string;
  ua: string;
  codigoUA: string;
  endereco: string;
  bairro: string;
  cep: string;
  municipio: string;
  uf: string;
  responsavel: string;
  situacao: string;
  natureza: string;
  abertura: string;
  cnae: string;
  porte: string;
  simples: SimplesPeriodo[];
}

export interface FiscalCertidao {
  tipo: string;
  codigo: string;
  emissao: string;
  validade: string;
}

// Débito (SIEF). "Pendência - Débito" traz multa/juros/consolidado; "Débito com
// Exigibilidade Suspensa" só valorOriginal/saldoDevedor (multa/juros = 0).
export interface FiscalDebito {
  origem: string;
  receita: string;
  periodo: string;
  vencimento: string;
  valorOriginal: number;
  saldoDevedor: number;
  multa: number;
  juros: number;
  consolidado: number;
  situacao: string;
  nota: string;
}

export interface FiscalProcesso {
  origem: string;
  numero: string;
  situacao: string;
  localizacao: string;
  processosCredito: string[];
}

export interface FiscalParcelamento {
  origem: string; // SIEFPAR | SISPAR | PARCSN/PARCMEI
  identificador: string;
  valorSuspenso: number;
  tipo: string;
  modalidade: string;
}

// Inscrição na Dívida Ativa (SIDA / PGFN).
export interface FiscalInscricao {
  origem: string;
  inscricao: string;
  receita: string;
  inscritoEm: string;
  ajuizadoEm: string;
  processo: string;
  tipoDevedor: string;
  situacao: string;
}

// "Pendência - Omissão de <declaração>" (ex.: DCTFWeb): período sem entrega.
export interface FiscalOmissao {
  declaracao: string;
  periodo: string;
}

export interface FiscalDivida {
  inscricao: string;
  situacao: string;
}

export interface FiscalEmpresa {
  cnpj: string;
  cnpjRaiz: string;
  razaoSocial: string;
  apelido: string;
  dataConsulta: string; // "DD/MM/AAAA HH:MM:SS" do cabeçalho do relatório
  arquivo: string;
  versaoLeitor?: number; // versão do parser (ausente = 1, leitor antigo)
  cadastro: FiscalCadastro;
  socios: Socio[];
  certidao: FiscalCertidao;
  debitos: FiscalDebito[];
  processos: FiscalProcesso[];
  parcelamentos: FiscalParcelamento[];
  inscricoes: FiscalInscricao[];
  divida: FiscalDivida[];
  omissoes?: FiscalOmissao[]; // opcional: snapshots antigos não têm
  rfSemPendencias: boolean;
  pgfnSemPendencias: boolean;
  semPendencias: boolean;
  totalOriginal: number;
  totalSaldo: number;
  totalMulta: number;
  totalJuros: number;
  totalConsolidado: number;
  totalSuspenso: number;
  totalAVencer?: number; // débitos "A VENCER" (fora dos totais acima)
}

// Sem seed: os dados vêm do upload recorrente (snapshots no Supabase).
export const FISCAL: FiscalEmpresa[] = [];
