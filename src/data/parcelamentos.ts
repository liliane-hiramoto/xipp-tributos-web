// Parcelamentos (e-CAC "Consulta Pedidos de Parcelamento") — MODELO por instância.
// Entram por upload das páginas do e-CAC impressas em PDF: a "consolidação"
// (débitos incluídos) e o "demonstrativo de pagamentos" (parcelas pagas) do MESMO
// pedido são mesclados num único registro (chave: CNPJ + modalidade + número).

export interface ParcDebito {
  periodo: string; // PA (mm/aaaa)
  vencimento: string;
  processo: string;
  saldoOriginal: number;
  valorAtualizado: number;
}

export interface ParcPagamento {
  mes: string; // mês da parcela (mm/aaaa)
  vencimento: string; // vencimento do DAS
  arrecadacao: string; // data do pagamento ("" = não pago)
  valor: number;
}

export interface Parcelamento {
  cnpj: string;
  razaoSocial: string;
  modalidade: string; // ex.: "Parcelamento do Simples Nacional"
  sigla: string; // ex.: "PARCSN"
  numero: string;
  dataPedido: string;
  situacao: string; // ex.: "Em parcelamento", "Encerrado por Rescisão"
  dataSituacao: string;
  observacao: string;
  valorConsolidado: number;
  qtdParcelas: number;
  parcelaBasica: number;
  dataConsolidacao: string;
  debitos: ParcDebito[];
  pagamentos: ParcPagamento[];
  emitidoEm: string; // data/hora da impressão da página do e-CAC
  arquivos: string[];
}
