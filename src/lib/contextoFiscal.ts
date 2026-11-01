// Monta o "contexto" (texto JSON) com os dados REAIS do módulo fiscal que a caixa
// de perguntas envia ao modelo: Situação Fiscal (último relatório de cada CNPJ),
// certidões CNDT/FGTS, pedidos de parcelamento e os insights calculados. Nada é
// resumido por estimativa: valores e datas saem exatamente como importados.
import type { FiscalEmpresa } from "@/data/fiscal-tipos";
import type { Parcelamento } from "@/data/parcelamentos";
import type { Certidao } from "@/data/certidoes";
import { ehAVencer, totaisFiscais, statusCND } from "@/lib/fiscal";
import { resumoParcelamento } from "@/lib/parcelamentoCalc";
import { gerarInsights } from "@/lib/insights";

const dig = (s: string) => (s || "").replace(/\D/g, "");

/** DARFs pagos (comprovantes de arrecadação) que estão na tela: colunas + linhas. */
export interface DarfsTela {
  colunas: string[];
  linhas: (string | number | null)[][];
}

export function montarContexto(
  fiscais: FiscalEmpresa[],
  parcelamentos: Parcelamento[],
  certidoes: Certidao[],
  apelidos: Record<string, string>,
  cnpj = "",
  darfs: DarfsTela | null = null,
  escopoTela = ""
): { texto: string; empresas: number } {
  const filtro = dig(cnpj);
  const fs = filtro ? fiscais.filter((e) => dig(e.cnpj) === filtro) : fiscais;
  const ps = filtro ? parcelamentos.filter((p) => dig(p.cnpj) === filtro) : parcelamentos;
  const cs = filtro ? certidoes.filter((c) => dig(c.cnpj) === filtro) : certidoes;
  const nome = (c: string, razao: string) => apelidos[dig(c)] || razao;
  fs.forEach((e) => (e.apelido = nome(e.cnpj, e.razaoSocial)));

  const empresas = fs.map((e) => {
    const t = totaisFiscais(e);
    return {
      empresa: e.apelido,
      razaoSocial: e.razaoSocial,
      cnpj: e.cnpj,
      fonte: `Relatório de Situação Fiscal (e-CAC) — consulta de ${e.dataConsulta}`,
      cadastro: e.cadastro,
      socios: e.socios,
      certidaoFederal: { ...e.certidao, status: statusCND(e.certidao.tipo, e.certidao.validade).label },
      semPendencias: e.semPendencias,
      totaisDebitosVencidosSIEF: { principal: t.original, multa: t.multa, juros: t.juros, consolidado: t.consolidado, saldoDevedor: t.saldo },
      totalAVencer: t.aVencer,
      debitosVencidosSIEF: e.debitos.filter((d) => !ehAVencer(d)),
      debitosAVencer: e.debitos.filter(ehAVencer),
      omissoesDeclaracao: e.omissoes ?? [],
      processosSIEF: e.processos,
      parcelamentosNaSituacaoFiscal: e.parcelamentos,
      inscricoesDividaAtivaSIDA: e.inscricoes,
      inscricoesSistemaDIVIDA: e.divida,
    };
  });

  const pedidos = ps.map((p) => {
    const r = resumoParcelamento(p);
    return {
      empresa: nome(p.cnpj, p.razaoSocial),
      cnpj: p.cnpj,
      fonte: `Pedido de parcelamento (e-CAC) — página emitida em ${p.emitidoEm}`,
      modalidade: p.modalidade,
      sigla: p.sigla,
      numero: p.numero,
      dataPedido: p.dataPedido,
      situacao: p.situacao,
      dataSituacao: p.dataSituacao,
      valorConsolidado: p.valorConsolidado,
      qtdParcelas: p.qtdParcelas,
      parcelaBasica: p.parcelaBasica,
      dataConsolidacao: p.dataConsolidacao,
      parcelasPagas: r.pagas,
      valorPago: r.valorPago,
      parcelasRestantes: r.restantes,
      saldoEstimado_parcelasRestantesXParcelaBasica_semSelic: r.ativo ? r.saldoEstimado : null,
      parcelasEmAtraso_estimado: r.emAtraso,
      debitosIncluidos: p.debitos,
      pagamentos: p.pagamentos,
    };
  });

  const certs = cs.map((c) => ({
    empresa: nome(c.cnpj, c.razaoSocial),
    cnpj: c.cnpj,
    tipo: c.tipo === "cndt" ? "CNDT (trabalhista)" : "CRF (FGTS)",
    numero: c.numero,
    emissao: c.emissao,
    validade: c.validade,
    situacao: c.situacao,
    regular: c.regular,
    obtidoEm: c.obtidoEm,
  }));

  const insights = gerarInsights(fs, ps).map((i) => ({ nivel: i.nivel, empresa: i.empresa, titulo: i.titulo, texto: i.texto }));

  const dados = {
    escopo: filtro ? `Somente a empresa de CNPJ ${fs[0]?.cnpj ?? cnpj}` : `Todas as empresas importadas (${fs.length})`,
    filtroDaTela: escopoTela || null,
    observacoes: [
      "darfsPagos = comprovantes de arrecadação (DARFs efetivamente pagos) exatamente como estão na tela, já filtrados por empresa/período do topo (regime caixa = mês do pagamento; competência = mês de apuração). Datas desses DARFs em AAAA-MM-DD. diasAtraso = recolhimento − vencimento.",
      "Situação Fiscal, certidões e parcelamentos NÃO são filtrados por período: são o último relatório importado de cada empresa.",
      "Valores em reais (R$). Datas no formato dd/mm/aaaa.",
      "Débitos 'A VENCER' estão separados dos vencidos e NÃO entram nos totais de débitos vencidos.",
      "O relatório de Situação Fiscal NÃO traz o valor das inscrições em dívida ativa (SIDA).",
      "saldoEstimado de parcelamento é aproximado (parcelas restantes × parcela básica, sem correção Selic).",
      "Insights são regras automáticas calculadas a partir destes mesmos dados.",
    ],
    empresas,
    pedidosDeParcelamento: pedidos,
    certidoesCNDTeFGTS: certs,
    insights,
    darfsPagos: darfs ? { total: darfs.linhas.length, ...darfs } : "não enviados",
  };
  return { texto: JSON.stringify(dados), empresas: fs.length };
}
