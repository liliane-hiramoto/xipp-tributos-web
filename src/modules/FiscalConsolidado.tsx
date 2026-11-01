"use client";

// Aba "Consolidado" da Situação Fiscal: visão de todas as empresas por bloco
// (omissões, débitos SIEF, a vencer, processos, SIDA, parcelamentos), cada um com
// cards de resumo e tabela com linha de total.
import { ehAVencer, totaisFiscais } from "@/lib/fiscal";
import type { FiscalEmpresa } from "@/data/fiscal-tipos";
import { fmtMoney } from "@/lib/format";
import { Card, Kpi } from "@/components/ui";
import type { PontoEvolucao } from "@/lib/dbFiscal";
import { diasAtraso, faixaIdade, FAIXAS_IDADE, inscricaoAjuizada, inscricaoSuspensa } from "@/lib/insights";

const rotulo = (e: FiscalEmpresa) => e.apelido || e.razaoSocial || e.cnpj;
const r2 = (n: number) => Math.round(n * 100) / 100;
const soma = <T,>(xs: T[], f: (x: T) => number) => r2(xs.reduce((a, x) => a + f(x), 0));

// "dd/mm/aaaa" → "aaaammdd" p/ ordenar por data.
const ordData = (d: string) => (d || "").split("/").reverse().join("");

/** Agrupa e conta: chave → { linha de exemplo, qtde }. */
function contar<T>(xs: T[], chave: (x: T) => string): { x: T; qtde: number }[] {
  const m = new Map<string, { x: T; qtde: number }>();
  for (const x of xs) {
    const k = chave(x);
    const g = m.get(k);
    if (g) g.qtde++;
    else m.set(k, { x, qtde: 1 });
  }
  return [...m.values()];
}

export default function FiscalConsolidado({ fiscais, evolucao = [] }: { fiscais: FiscalEmpresa[]; evolucao?: PontoEvolucao[] }) {
  // ---- Omissões
  const omissoes = fiscais.flatMap((e) => (e.omissoes ?? []).map((o) => ({ emp: rotulo(e), ...o })));

  // ---- Débitos SIEF (vencidos) por empresa
  const deb = fiscais.map((e) => ({
    emp: rotulo(e),
    qtde: e.debitos.filter((d) => !ehAVencer(d)).length,
    qtdeAVencer: e.debitos.filter(ehAVencer).length,
    t: totaisFiscais(e),
  }));
  const debComValor = deb.filter((d) => d.qtde > 0 || d.qtdeAVencer > 0);
  const tDeb = {
    qtde: soma(deb, (d) => d.qtde),
    original: soma(deb, (d) => d.t.original),
    multa: soma(deb, (d) => d.t.multa),
    juros: soma(deb, (d) => d.t.juros),
    consolidado: soma(deb, (d) => d.t.consolidado),
    saldo: soma(deb, (d) => d.t.saldo),
    aVencer: soma(deb, (d) => d.t.aVencer),
  };

  // ---- A vencer: soma por tributo / vencimento / empresa
  const av = fiscais.flatMap((e) => e.debitos.filter(ehAVencer).map((d) => ({ emp: rotulo(e), d })));
  const avGrupos = (() => {
    const m = new Map<string, { receita: string; venc: string; emp: string; qtde: number; original: number; saldo: number }>();
    for (const { emp, d } of av) {
      const k = `${d.receita}|${d.vencimento}|${emp}`;
      const g = m.get(k) ?? { receita: d.receita, venc: d.vencimento, emp, qtde: 0, original: 0, saldo: 0 };
      g.qtde++;
      g.original = r2(g.original + d.valorOriginal);
      g.saldo = r2(g.saldo + d.saldoDevedor);
      m.set(k, g);
    }
    return [...m.values()].sort((a, b) => ordData(a.venc).localeCompare(ordData(b.venc)) || a.receita.localeCompare(b.receita) || a.emp.localeCompare(b.emp));
  })();
  const tAv = { qtde: av.length, original: soma(av, (x) => x.d.valorOriginal), saldo: soma(av, (x) => x.d.saldoDevedor) };

  // ---- Processos SIEF: empresa × situação
  const procs = fiscais.flatMap((e) => e.processos.map((p) => ({ emp: rotulo(e), p })));
  const procGrupos = contar(procs, (x) => `${x.emp}|${x.p.situacao}`).sort((a, b) => a.x.emp.localeCompare(b.x.emp) || b.qtde - a.qtde);

  // ---- SIDA: empresa × receita × situação
  const ins = fiscais.flatMap((e) => e.inscricoes.map((i) => ({ emp: rotulo(e), i })));
  const insGrupos = contar(ins, (x) => `${x.emp}|${x.i.receita}|${x.i.situacao}`).sort(
    (a, b) => a.x.emp.localeCompare(b.x.emp) || a.x.i.receita.localeCompare(b.x.i.receita) || a.x.i.situacao.localeCompare(b.x.i.situacao)
  );
  const empsSida = new Set(ins.map((x) => x.emp)).size;
  const parceladas = ins.filter((x) => inscricaoSuspensa(x.i.situacao)).length;
  const ajuizadas = ins.filter((x) => inscricaoAjuizada(x.i.situacao) && !inscricaoSuspensa(x.i.situacao)).length;
  const processosSida = new Set(ins.map((x) => `${x.emp}|${x.i.processo}`)).size;

  // ---- Idade dos débitos vencidos (consolidado por faixa de atraso, na data da consulta)
  const idade = fiscais
    .map((e) => {
      const f = FAIXAS_IDADE.map(() => 0);
      for (const d of e.debitos) if (!ehAVencer(d)) f[faixaIdade(diasAtraso(d, e.dataConsulta))] += d.consolidado;
      return { emp: rotulo(e), f: f.map(r2), tot: r2(f.reduce((a, b) => a + b, 0)) };
    })
    .filter((x) => x.tot > 0);
  const tIdade = FAIXAS_IDADE.map((_, i) => soma(idade, (x) => x.f[i]));

  // ---- Evolução: consolidado por consulta (últimas 6), por empresa
  const evo = fiscais
    .map((e) => ({ emp: rotulo(e), pts: evolucao.filter((p) => p.cnpj === e.cnpj).slice(-6) }))
    .filter((x) => x.pts.length > 0);

  // ---- Parcelamentos
  const parc = fiscais.flatMap((e) => e.parcelamentos.map((p) => ({ emp: rotulo(e), p })));
  const tParcSusp = soma(parc, (x) => x.p.valorSuspenso || 0);

  return (
    <div className="space-y-6">
      {/* Débitos SIEF */}
      <Bloco titulo="Débitos (SIEF)">
        <div className="grid grid-cols-2 gap-3 px-5 pb-4 md:grid-cols-3">
          <Kpi label="Principal" value={fmtMoney(tDeb.original)} sub={`${tDeb.qtde} débito(s)`} tone={tDeb.original > 0 ? "danger" : "ok"} />
          <Kpi label="Multa" value={fmtMoney(tDeb.multa)} tone={tDeb.multa > 0 ? "danger" : "ok"} />
          <Kpi label="Juros" value={fmtMoney(tDeb.juros)} tone={tDeb.juros > 0 ? "danger" : "ok"} />
          <Kpi label="Consolidado" value={fmtMoney(tDeb.consolidado)} tone={tDeb.consolidado > 0 ? "danger" : "ok"} />
          <Kpi label="Saldo devedor" value={fmtMoney(tDeb.saldo)} />
          <Kpi label="A vencer" value={fmtMoney(tDeb.aVencer)} sub={`${tAv.qtde} débito(s)`} />
        </div>
        {debComValor.length === 0 ? (
          <Vazio>Nenhum débito SIEF.</Vazio>
        ) : (
          <Tabela
            cols={["Empresa", "Qtde", "Principal", "Multa", "Juros", "Consolidado", "Saldo devedor", "A vencer"]}
            num={[1, 2, 3, 4, 5, 6, 7]}
            linhas={debComValor.map((d) => [d.emp, d.qtde, fmtMoney(d.t.original), fmtMoney(d.t.multa), fmtMoney(d.t.juros), fmtMoney(d.t.consolidado), fmtMoney(d.t.saldo), fmtMoney(d.t.aVencer)])}
            total={["Total", tDeb.qtde, fmtMoney(tDeb.original), fmtMoney(tDeb.multa), fmtMoney(tDeb.juros), fmtMoney(tDeb.consolidado), fmtMoney(tDeb.saldo), fmtMoney(tDeb.aVencer)]}
          />
        )}
      </Bloco>

      {/* Idade dos débitos */}
      {idade.length > 0 && (
        <Bloco titulo="Débitos (SIEF) por idade — consolidado">
          <Tabela
            cols={["Empresa", ...FAIXAS_IDADE.map((f) => f.rotulo), "Total"]}
            num={[1, 2, 3, 4, 5]}
            linhas={idade.map((x) => [x.emp, ...x.f.map(fmtMoney), fmtMoney(x.tot)])}
            total={["Total", ...tIdade.map(fmtMoney), fmtMoney(soma(idade, (x) => x.tot))]}
          />
          <p className="border-t border-slate-100 px-5 py-2 text-[11px] text-slate-400">
            Dias entre o vencimento e a data da consulta do relatório. Débitos antigos ainda na Receita estão perto de ir para a dívida ativa.
          </p>
        </Bloco>
      )}

      {/* Evolução */}
      {evo.length > 0 && (
        <Bloco titulo="Evolução do consolidado (SIEF)">
          <div className="overflow-x-auto border-t border-slate-100">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-5 py-2 font-medium">Empresa</th>
                  <th className="px-3 py-2 font-medium">Consultas (mais antiga → mais recente)</th>
                  <th className="px-3 py-2 text-right font-medium">Variação</th>
                </tr>
              </thead>
              <tbody>
                {evo.map((x) => {
                  const ini = x.pts[0].consolidado;
                  const fim = x.pts[x.pts.length - 1].consolidado;
                  const dv = r2(fim - ini);
                  return (
                    <tr key={x.emp} className="border-b border-slate-100 align-top last:border-0">
                      <td className="px-5 py-1.5 text-xs text-slate-700">{x.emp}</td>
                      <td className="px-3 py-1.5 text-xs text-slate-600">
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {x.pts.map((p, i) => (
                            <span key={i} className="tabular-nums">
                              <span className="text-slate-400">{p.dataConsulta.slice(0, 10)}</span> {fmtMoney(p.consolidado)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className={`px-3 py-1.5 text-right text-xs font-semibold tabular-nums ${dv > 0 ? "text-red-600" : dv < 0 ? "text-emerald-600" : "text-slate-500"}`}>
                        {x.pts.length > 1 ? `${dv > 0 ? "+" : ""}${fmtMoney(dv)}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-slate-100 px-5 py-2 text-[11px] text-slate-400">
            Só relatórios lidos pela versão atual do leitor (os anteriores perdiam linhas). A série cresce a cada nova importação.
          </p>
        </Bloco>
      )}

      {/* A vencer */}
      <Bloco titulo="A vencer">
        <div className="grid grid-cols-2 gap-3 px-5 pb-4 md:grid-cols-3">
          <Kpi label="Principal" value={fmtMoney(tAv.original)} />
          <Kpi label="Saldo" value={fmtMoney(tAv.saldo)} />
          <Kpi label="Qtde" value={String(tAv.qtde)} sub={`${new Set(av.map((x) => x.emp)).size} empresa(s)`} />
        </div>
        {avGrupos.length === 0 ? (
          <Vazio>Nenhum débito a vencer.</Vazio>
        ) : (
          <Tabela
            cols={["Tributo", "Vencimento", "Empresa", "Qtde", "Principal", "Saldo"]}
            num={[3, 4, 5]}
            linhas={avGrupos.map((g) => [g.receita, g.venc, g.emp, g.qtde, fmtMoney(g.original), fmtMoney(g.saldo)])}
            total={["Total", "", "", tAv.qtde, fmtMoney(tAv.original), fmtMoney(tAv.saldo)]}
          />
        )}
      </Bloco>

      {/* Omissões */}
      <Bloco titulo="Omissões de declaração">
        {omissoes.length === 0 ? (
          <Vazio>Nenhuma omissão de declaração.</Vazio>
        ) : (
          <Tabela
            cols={["Empresa", "Declaração", "Período"]}
            linhas={omissoes.map((o) => [o.emp, o.declaracao, o.periodo])}
            total={[`Total: ${omissoes.length} omissão(ões) em ${new Set(omissoes.map((o) => o.emp)).size} empresa(s)`, "", ""]}
          />
        )}
      </Bloco>

      {/* Processos */}
      <Bloco titulo="Processos fiscais (SIEF)">
        <div className="grid grid-cols-2 gap-3 px-5 pb-4 md:grid-cols-3">
          <Kpi label="Processos" value={String(procs.length)} sub={`${new Set(procs.map((x) => x.emp)).size} empresa(s)`} tone={procs.length ? "danger" : "ok"} />
        </div>
        {procGrupos.length === 0 ? (
          <Vazio>Nenhum processo fiscal.</Vazio>
        ) : (
          <Tabela
            cols={["Empresa", "Situação", "Qtde"]}
            num={[2]}
            linhas={procGrupos.map((g) => [g.x.emp, g.x.p.situacao, g.qtde])}
            total={["Total", "", procs.length]}
          />
        )}
      </Bloco>

      {/* SIDA */}
      <Bloco titulo="Inscrições em dívida ativa (SIDA)">
        <div className="grid grid-cols-2 gap-3 px-5 pb-4 md:grid-cols-3">
          <Kpi label="Inscrições" value={String(ins.length)} sub={`${empsSida} empresa(s)`} tone={ins.length ? "danger" : "ok"} />
          <Kpi label="Ajuizadas" value={String(ajuizadas)} sub="execução fiscal em curso" tone={ajuizadas ? "danger" : "ok"} />
          <Kpi label="Parceladas" value={String(parceladas)} sub={`${processosSida} processo(s) de origem`} />
        </div>
        {insGrupos.length === 0 ? (
          <Vazio>Nenhuma inscrição em dívida ativa.</Vazio>
        ) : (
          <Tabela
            cols={["Empresa", "Receita", "Situação", "Qtde"]}
            num={[3]}
            linhas={insGrupos.map((g) => [g.x.emp, g.x.i.receita, g.x.i.situacao, g.qtde])}
            total={["Total", "", "", ins.length]}
          />
        )}
      </Bloco>

      {/* Parcelamentos */}
      <Bloco titulo="Parcelamentos (SIEFPAR / PARCSN / SISPAR)">
        <div className="grid grid-cols-2 gap-3 px-5 pb-4 md:grid-cols-3">
          <Kpi label="Parcelamentos" value={String(parc.length)} sub={`${new Set(parc.map((x) => x.emp)).size} empresa(s)`} />
          <Kpi label="Valor suspenso" value={fmtMoney(tParcSusp)} sub="SIEFPAR (os demais não trazem valor)" />
        </div>
        {parc.length === 0 ? (
          <Vazio>Nenhum parcelamento.</Vazio>
        ) : (
          <Tabela
            cols={["Empresa", "Origem", "Identificador", "Valor suspenso", "Modalidade"]}
            num={[3]}
            linhas={parc.map((x) => [x.emp, x.p.origem, x.p.identificador, x.p.valorSuspenso > 0 ? fmtMoney(x.p.valorSuspenso) : "—", [x.p.tipo, x.p.modalidade].filter(Boolean).join(" · ")])}
            total={[`Total: ${parc.length}`, "", "", fmtMoney(tParcSusp), ""]}
          />
        )}
      </Bloco>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Card className="p-0">
      <div className="px-5 pb-3 pt-4 text-sm font-semibold uppercase tracking-wide text-slate-600">{titulo}</div>
      {children}
    </Card>
  );
}

function Vazio({ children }: { children: React.ReactNode }) {
  return <p className="border-t border-slate-100 px-5 py-4 text-sm text-slate-400">{children}</p>;
}

// Tabela simples: `num` = índices das colunas numéricas (alinhadas à direita).
function Tabela({ cols, linhas, total, num = [] }: { cols: string[]; linhas: (string | number)[][]; total: (string | number)[]; num?: number[] }) {
  const al = (i: number, base: string) => `${base} ${num.includes(i) ? "text-right tabular-nums" : ""}`;
  return (
    <div className="overflow-x-auto border-t border-slate-100">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400">
          <tr>
            {cols.map((c, i) => (
              <th key={c} className={al(i, `${i === 0 ? "px-5" : "px-3"} py-2 font-medium`)}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, j) => (
            <tr key={j} className="border-b border-slate-100 align-top last:border-0">
              {l.map((v, i) => (
                <td key={i} className={al(i, `${i === 0 ? "px-5 text-slate-700" : "px-3 text-slate-600"} py-1.5 text-xs`)}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-800">
            {total.map((v, i) => (
              <td key={i} className={al(i, `${i === 0 ? "px-5" : "px-3"} py-2 text-xs`)}>
                {v}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
