// Indicadores de um pedido de parcelamento (sem "use client": usado no app e no
// servidor — rota de perguntas).
import type { Parcelamento } from "@/data/parcelamentos";

/** Indicadores do pedido: pagas, valor pago, restantes e parcelas vencidas sem
 *  pagamento até a data de emissão (aproximação: meses anteriores ao da emissão). */
export function resumoParcelamento(p: Parcelamento) {
  const pagas = p.pagamentos.filter((x) => x.arrecadacao || x.valor > 0);
  const valorPago = Math.round(pagas.reduce((s, x) => s + x.valor, 0) * 100) / 100;
  const restantes = Math.max(0, p.qtdParcelas - pagas.length);
  const ativo = /Em parcelamento/i.test(p.situacao);
  let emAtraso = 0;
  const primeira = p.pagamentos[0]?.mes || (p.dataConsolidacao ? p.dataConsolidacao.slice(3, 10) : "");
  const emissao = p.emitidoEm.slice(3, 10); // mm/aaaa
  if (ativo && primeira && emissao) {
    const [m1, a1] = primeira.split("/").map(Number);
    const [m2, a2] = emissao.split("/").map(Number);
    const devidas = Math.max(0, Math.min(p.qtdParcelas, (a2 - a1) * 12 + (m2 - m1))); // até o mês anterior à emissão
    emAtraso = Math.max(0, devidas - pagas.length);
  }
  return { pagas: pagas.length, valorPago, restantes, saldoEstimado: Math.round(restantes * p.parcelaBasica * 100) / 100, ativo, emAtraso };
}
