// Parser das páginas do e-CAC "Consulta Pedidos de Parcelamento" impressas em PDF
// (testado com o Parcelamento do Simples Nacional — PARCSN). Cada PDF traz o
// cabeçalho do pedido + OU a consolidação (débitos) OU o demonstrativo de
// pagamentos; a mescla dos dois acontece ao salvar (dbParcelamentos.ts).
"use client";

import type { Parcelamento, ParcDebito, ParcPagamento } from "@/data/parcelamentos";

const D = "\\d{2}\\/\\d{2}\\/\\d{4}";
const RS = "R\\$\\s*([\\d.]+,\\d{2})";

function num(s: string): number {
  const n = parseFloat((s || "").replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

// Sigla a partir do nome da modalidade no e-CAC.
function sigla(modalidade: string): string {
  if (/Simples Nacional/i.test(modalidade)) return "PARCSN";
  if (/MEI/i.test(modalidade)) return "PARCMEI";
  if (/PERT/i.test(modalidade)) return "PERT";
  return modalidade.toUpperCase().slice(0, 12);
}

export function ehPedidoParcelamento(paginas: string[]): boolean {
  return /Consulta Pedidos de Parcelamento/i.test(paginas.join(" "));
}

export function parsePedidoParcelamento(paginas: string[], arquivo: string): Parcelamento | null {
  const t = paginas.join(" ").replace(/\s+/g, " ");
  const modalidade = (t.match(/Consulta Pedidos de Parcelamento\s*-\s*(.+?)\s+Nome Empresarial:/) || [])[1]?.trim() || "";
  const razaoSocial = (t.match(/Nome Empresarial:\s*(.+?)\s+CNPJ:/) || [])[1]?.trim() || "";
  const cnpj = (t.match(/CNPJ:\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/) || [])[1] || "";
  const ped = t.match(new RegExp(`Observação\\s+(\\d+)\\s+(${D})\\s+(.+?)\\s+(${D})\\s+(.+?)\\s+Valor total consolidado`));
  if (!cnpj || !ped) return null;
  const cons = t.match(new RegExp(`Data da consolidação\\s+${RS}\\s+(\\d+)\\s+${RS}\\s+(${D}(?: \\d{2}:\\d{2})?)`));
  const emi = t.match(new RegExp(`(${D}),?\\s+(\\d{2}:\\d{2})\\s+eCAC`));

  // Consolidação: débitos incluídos (PA, vencimento, [processo], saldo original, valor atualizado).
  const debitos: ParcDebito[] = [];
  const iDeb = t.indexOf("Valor Atualizado");
  if (iDeb >= 0) {
    const seg = t.slice(iDeb, t.indexOf("Consolidação original", iDeb) >>> 0);
    const re = new RegExp(`(\\d{2}\\/\\d{4})\\s+(${D})\\s+(?:([\\d./-]{10,})\\s+)?${RS}\\s+${RS}`, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(seg)))
      debitos.push({ periodo: m[1], vencimento: m[2], processo: m[3] || "", saldoOriginal: num(m[4]), valorAtualizado: num(m[5]) });
  }

  // Demonstrativo de pagamentos (mês, vencimento do DAS, data de arrecadação, valor pago).
  const pagamentos: ParcPagamento[] = [];
  const iPag = t.indexOf("Valor pago");
  if (iPag >= 0) {
    const fim = t.indexOf("Demonstrativo de pagamentos", iPag);
    const seg = t.slice(iPag, fim >= 0 ? fim : undefined);
    const re = new RegExp(`(\\d{2}\\/\\d{4})\\s+(${D})\\s+(?:(${D})\\s+)?${RS}`, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(seg))) pagamentos.push({ mes: m[1], vencimento: m[2], arrecadacao: m[3] || "", valor: num(m[4]) });
  }

  return {
    cnpj,
    razaoSocial,
    modalidade,
    sigla: sigla(modalidade),
    numero: ped[1],
    dataPedido: ped[2],
    situacao: ped[3].trim(),
    dataSituacao: ped[4],
    observacao: ped[5].trim(),
    valorConsolidado: cons ? num(cons[1]) : 0,
    qtdParcelas: cons ? parseInt(cons[2], 10) : 0,
    parcelaBasica: cons ? num(cons[3]) : 0,
    dataConsolidacao: cons ? cons[4] : "",
    debitos,
    pagamentos,
    emitidoEm: emi ? `${emi[1]} ${emi[2]}` : "",
    arquivos: [arquivo],
  };
}

const ordMes = (m: string) => m.split("/").reverse().join(""); // mm/aaaa → aaaamm
const ordData = (d: string) => (d || "").slice(0, 10).split("/").reverse().join("");

/** Mescla dois registros do MESMO pedido (ex.: consolidação + pagamentos). O
 *  cabeçalho vem do mais recente; débitos da versão que os tiver; pagamentos
 *  unidos por mês (o mais recente prevalece). */
export function mesclarParcelamento(a: Parcelamento, b: Parcelamento): Parcelamento {
  const [velho, novo] = ordData(a.emitidoEm) <= ordData(b.emitidoEm) ? [a, b] : [b, a];
  const pags = new Map<string, ParcPagamento>();
  for (const p of [...velho.pagamentos, ...novo.pagamentos]) pags.set(p.mes, p);
  return {
    ...novo,
    debitos: novo.debitos.length ? novo.debitos : velho.debitos,
    pagamentos: [...pags.values()].sort((x, y) => ordMes(x.mes).localeCompare(ordMes(y.mes))),
    arquivos: [...new Set([...velho.arquivos, ...novo.arquivos])],
  };
}

export const chaveParcelamento = (p: Pick<Parcelamento, "cnpj" | "sigla" | "numero">) => `${p.cnpj}|${p.sigla}|${p.numero}`;

// Cálculo do resumo fica num módulo sem "use client" (usado também no servidor).
export { resumoParcelamento } from "@/lib/parcelamentoCalc";
