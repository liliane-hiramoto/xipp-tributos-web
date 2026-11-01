// "Insights": recomendações fiscais geradas por regras a partir dos dados já
// importados (Situação Fiscal + parcelamentos). Cada regra é objetiva e cita os
// números que a dispararam; o texto é orientação, não parecer.
import type { FiscalEmpresa, FiscalDebito } from "@/data/fiscal-tipos";
import type { Parcelamento } from "@/data/parcelamentos";
import { ehAVencer, parseBR, statusCND } from "@/lib/fiscal";
import { resumoParcelamento } from "@/lib/parcelamentoCalc";
import { fmtMoney } from "@/lib/format";

export type Nivel = "critico" | "alto" | "medio" | "info";

export interface Insight {
  nivel: Nivel;
  cnpj: string; // "" = vários / grupo
  empresa: string;
  titulo: string;
  texto: string;
}

export const ORDEM_NIVEL: Record<Nivel, number> = { critico: 0, alto: 1, medio: 2, info: 3 };

// Códigos de receita de tributo RETIDO/DESCONTADO de terceiros (IRRF, CSRF e
// contribuição previdenciária descontada do segurado). Não recolher = apropriação
// indébita (art. 168-A CP; art. 2º, II, Lei 8.137/90).
const RETENCOES = /^(0561|0588|1708|3208|3280|3426|5706|8045|0473|5952|5960|5979|5987|1082|1099)-/;
export const ehRetencao = (d: FiscalDebito) => RETENCOES.test(d.receita);

/** Inscrição em dívida ativa negociada/parcelada/suspensa (não está "em cobrança"). */
export const inscricaoSuspensa = (situacao: string) => /NEGOCIAD|PARCELAD|SUSPENS|GARANTI/i.test(situacao || "");

/** Inscrição com execução fiscal já ajuizada ("A SER AJUIZADA" não conta). */
export const inscricaoAjuizada = (situacao: string) => /AJUIZADA/.test(situacao) && !/A SER AJUIZADA/.test(situacao);

/** Dias entre o vencimento do débito e a data da consulta do relatório. */
export function diasAtraso(d: FiscalDebito, dataConsulta: string): number {
  const v = parseBR(d.vencimento);
  const c = parseBR(dataConsulta);
  if (!v || !c) return 0;
  return Math.max(0, Math.round((c.getTime() - v.getTime()) / 86400000));
}

export const FAIXAS_IDADE = [
  { rotulo: "até 90 dias", max: 90 },
  { rotulo: "91–180 dias", max: 180 },
  { rotulo: "181–365 dias", max: 365 },
  { rotulo: "mais de 1 ano", max: Infinity },
];
export function faixaIdade(dias: number): number {
  return FAIXAS_IDADE.findIndex((f) => dias <= f.max);
}

/** Exclusão do Simples Nacional: a mais recente informada no cadastro. */
export function exclusaoSimples(e: FiscalEmpresa): { data: string; futura: boolean } | null {
  const ex = e.cadastro.simples.map((s) => s.exclusao).filter(Boolean);
  if (!ex.length) return null;
  const data = ex.sort((a, b) => (parseBR(a)?.getTime() ?? 0) - (parseBR(b)?.getTime() ?? 0))[ex.length - 1];
  const d = parseBR(data);
  const c = parseBR(e.dataConsulta) ?? new Date();
  return { data, futura: !!d && d > c };
}

const soma = (xs: FiscalDebito[], f: (d: FiscalDebito) => number) => Math.round(xs.reduce((a, d) => a + f(d), 0) * 100) / 100;

export function gerarInsights(fiscais: FiscalEmpresa[], parcelamentos: Parcelamento[] = []): Insight[] {
  const out: Insight[] = [];
  const rot = (e: FiscalEmpresa) => e.apelido || e.razaoSocial || e.cnpj;

  for (const e of fiscais) {
    const emp = rot(e);
    const add = (nivel: Nivel, titulo: string, texto: string) => out.push({ nivel, cnpj: e.cnpj, empresa: emp, titulo, texto });
    const vencidos = e.debitos.filter((d) => !ehAVencer(d));

    // 1. Retenções não recolhidas
    const ret = vencidos.filter(ehRetencao);
    if (ret.length)
      add(
        "critico",
        "Tributos retidos não recolhidos",
        `${ret.length} débito(s) de IRRF/CSRF/contribuição descontada do segurado, consolidado ${fmtMoney(soma(ret, (d) => d.consolidado))}. Reter e não repassar pode configurar apropriação indébita (art. 168-A do CP; art. 2º, II, da Lei 8.137/90) — priorizar o pagamento destes antes dos demais.`
      );

    // 2. Omissão de declaração
    const om = e.omissoes ?? [];
    if (om.length)
      add(
        "critico",
        "Omissão de declaração impede a CND",
        `${om.map((o) => `${o.declaracao} ${o.periodo}`).join(", ")}. Transmitir a declaração resolve a pendência (multa por atraso é pequena perto do impacto de ficar sem certidão).`
      );

    // 3. Inscrições ajuizadas
    const aj = e.inscricoes.filter((i) => inscricaoAjuizada(i.situacao) && !inscricaoSuspensa(i.situacao));
    if (aj.length)
      add(
        "alto",
        "Execuções fiscais em curso",
        `${aj.length} inscrição(ões) ajuizada(s) em ${new Set(aj.map((i) => i.processo)).size} processo(s). Risco de bloqueio de contas (SISBAJUD) e penhora — avaliar transação na PGFN (edital vigente ou individual) ou oferecer garantia.`
      );

    // 4. Simples Nacional ainda no SIEF (antes da inscrição)
    const sn = vencidos.filter((d) => /^SIMPLES NAC/.test(d.receita));
    if (sn.length)
      add(
        "alto",
        "Débitos do Simples ainda na Receita",
        `${sn.length} competência(s) do Simples (principal ${fmtMoney(soma(sn, (d) => d.valorOriginal))}) ainda não inscritas. Parcelar na Receita (PARCSN) antes da inscrição em dívida ativa costuma ser mais simples e barato.`
      );

    // 5. Débitos antigos ainda no SIEF → inscrição iminente
    const velhos = vencidos.filter((d) => diasAtraso(d, e.dataConsulta) > 180);
    if (velhos.length)
      add(
        "medio",
        "Débitos perto da inscrição em dívida ativa",
        `${velhos.length} débito(s) vencido(s) há mais de 180 dias ainda na Receita (consolidado ${fmtMoney(soma(velhos, (d) => d.consolidado))}). Depois de inscritos, passam a ter encargo legal e só a PGFN negocia.`
      );

    // 6. Exclusão do Simples
    const ex = exclusaoSimples(e);
    if (ex?.futura)
      add(
        "alto",
        `Exclusão do Simples agendada para ${ex.data}`,
        "Se a exclusão foi motivada por débitos, regularizar dentro do prazo do termo de exclusão pode revertê-la. Caso contrário, planejar a apuração pelo Lucro Presumido/Real a partir dessa data."
      );
    else if (ex && (parseBR(e.dataConsulta)?.getTime() ?? 0) - (parseBR(ex.data)?.getTime() ?? 0) < 400 * 86400000)
      add("info", `Excluída do Simples em ${ex.data}`, "Conferir se as apurações desde então estão no regime correto (Lucro Presumido/Real) e se as obrigações acessórias foram ajustadas.");

    // 7. CND vencida com pendências
    const cnd = statusCND(e.certidao.tipo, e.certidao.validade);
    if (cnd.vencida && !e.semPendencias)
      add("alto", "Certidão federal vencida e não renovável", `Venceu em ${e.certidao.validade}. Com as pendências atuais, a RFB/PGFN não emite nova CND — impacta licitações, crédito e contratos que exigem regularidade.`);

    // 8. Pagamentos parciais
    const parciais = vencidos.filter((d) => d.saldoDevedor > 0 && d.saldoDevedor < d.valorOriginal);
    if (parciais.length)
      add("info", "Débitos com pagamento parcial", `${parciais.length} débito(s) com saldo menor que o principal (pagamento parcial ou compensação). Conferir se há DARF/compensação não vinculada que quitaria o restante.`);

    // 9. Inscrições parceladas
    const neg = e.inscricoes.filter((i) => inscricaoSuspensa(i.situacao));
    if (neg.length) add("info", "Inscrições em parcelamento na PGFN", `${neg.length} inscrição(ões) negociada(s)/parcelada(s). Manter as parcelas em dia: atraso leva à rescisão e à retomada da cobrança.`);
  }

  // 10. Parcelamentos (e-CAC)
  out.push(...insightsParcelamentos(parcelamentos, fiscais));

  // 11. Grupo econômico (mesmo endereço, mais de uma empresa com pendência)
  const porEnd = new Map<string, FiscalEmpresa[]>();
  for (const e of fiscais) {
    if (e.semPendencias || !e.cadastro.endereco) continue;
    const k = `${e.cadastro.endereco.split(/\s+-\s+/)[0]}|${e.cadastro.cep.slice(0, 5)}`.toUpperCase();
    porEnd.set(k, [...(porEnd.get(k) ?? []), e]);
  }
  for (const [, es] of porEnd)
    if (es.length > 1)
      out.push({
        nivel: "info",
        cnpj: "",
        empresa: es.map(rot).join(", "),
        titulo: "Empresas com pendências no mesmo endereço",
        texto: `${es.map(rot).join(", ")} têm o mesmo endereço. A RFB/PGFN pode caracterizar grupo econômico e redirecionar a cobrança entre elas (sobretudo débitos previdenciários) — considerar no plano de regularização conjunto.`,
      });

  return out.sort((a, b) => ORDEM_NIVEL[a.nivel] - ORDEM_NIVEL[b.nivel] || a.empresa.localeCompare(b.empresa));
}

/** Insights dos pedidos de parcelamento (rescindido / parcelas em atraso). */
export function insightsParcelamentos(parcelamentos: Parcelamento[], fiscais: FiscalEmpresa[] = []): Insight[] {
  const out: Insight[] = [];
  const rot = (e: FiscalEmpresa) => e.apelido || e.razaoSocial || e.cnpj;
  const porCnpj = new Map(fiscais.map((e) => [e.cnpj, rot(e)]));
  for (const p of parcelamentos) {
    const emp = porCnpj.get(p.cnpj) || p.razaoSocial;
    const r = resumoParcelamento(p);
    if (/Rescis/i.test(p.situacao))
      out.push({
        nivel: "alto",
        cnpj: p.cnpj,
        empresa: emp,
        titulo: `${p.sigla} nº ${p.numero} rescindido em ${p.dataSituacao}`,
        texto: `Foram pagas ${r.pagas} de ${p.qtdParcelas} parcelas (${fmtMoney(r.valorPago)}) de um consolidado de ${fmtMoney(p.valorConsolidado)}. Os débitos voltam à cobrança (e seguem para a dívida ativa) — avaliar reparcelamento ou transação.`,
      });
    else if (r.emAtraso > 0)
      out.push({
        nivel: "critico",
        cnpj: p.cnpj,
        empresa: emp,
        titulo: `${p.sigla} nº ${p.numero} com ${r.emAtraso} parcela(s) em atraso`,
        texto: "Parcelas em atraso levam à rescisão do parcelamento (no Simples, 3 parcelas). Regularizar antes do próximo vencimento.",
      });
  }
  return out;
}
