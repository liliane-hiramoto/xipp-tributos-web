"use client";

import { useMemo, useState } from "react";
import { empresasFiscais, statusCND, ehAVencer, totaisFiscais } from "@/lib/fiscal";
import type { FiscalEmpresa, FiscalDebito } from "@/data/fiscal-tipos";
import { marcarLinhas, chaveDebito, mudouDebito, type Linha, type Tag } from "@/lib/fiscalDiff";
import { fmtMoney } from "@/lib/format";
import { Card, Selo } from "@/components/ui";
import CndConsolidado from "@/modules/CndConsolidado";
import ImportDocsBar from "@/components/ImportDocsBar";
import FiscalConsolidado from "@/modules/FiscalConsolidado";
import type { Certidao } from "@/data/certidoes";
import type { PontoEvolucao } from "@/lib/dbFiscal";
import { exclusaoSimples, inscricaoSuspensa, inscricaoAjuizada } from "@/lib/insights";

type Props = {
  fiscais: FiscalEmpresa[];
  anteriorPorCnpj: Record<string, FiscalEmpresa>;
  certidoes: Certidao[];
  certidoesPrev: Record<string, Certidao>;
  evolucao: PontoEvolucao[];
  onImportar: (files: File[]) => void;
  importando: boolean;
  canEdit: boolean;
};

export default function FiscalSituacao({ fiscais, anteriorPorCnpj, certidoes, certidoesPrev, evolucao, onImportar, importando, canEdit }: Props) {
  const [tab, setTab] = useState<string>(""); // "" = consolidado; senão CNPJ
  const todas = useMemo(() => empresasFiscais("", fiscais), [fiscais]);
  const empresas = useMemo(() => (tab ? todas.filter((e) => e.cnpj === tab) : todas), [todas, tab]);

  return (
    <div className="space-y-6">
      <ImportDocsBar onImportar={onImportar} importando={importando} canEdit={canEdit} />

      {todas.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-2">
          <TabBtn ativo={tab === ""} onClick={() => setTab("")}>
            Consolidado ({todas.length})
          </TabBtn>
          {todas.map((e) => (
            <TabBtn key={e.cnpj} ativo={tab === e.cnpj} onClick={() => setTab(e.cnpj)}>
              {e.apelido || e.razaoSocial}
            </TabBtn>
          ))}
        </div>
      )}

      {todas.length === 0 ? (
        <Card>
          <p className="py-6 text-center text-sm text-slate-500">
            Nenhum relatório de Situação Fiscal importado ainda.
            {canEdit ? " Envie os PDFs do e-CAC no botão acima." : " Peça a um administrador para importar."}
          </p>
        </Card>
      ) : tab === "" ? (
        /* Aba "Consolidado": todas as empresas por bloco + status das certidões. O
           detalhe de cada empresa fica na aba dela. */
        <>
          <FiscalConsolidado fiscais={todas} evolucao={evolucao} />

          <CndConsolidado fiscais={todas} certidoes={certidoes} certidoesPrev={certidoesPrev} />
        </>
      ) : empresas.length === 0 ? (
        <Card>
          <p className="py-6 text-center text-sm text-slate-500">Sem relatório para esta empresa.</p>
        </Card>
      ) : (
        empresas.map((e) => <EmpresaFiscal key={e.cnpj} e={e} anterior={anteriorPorCnpj[e.cnpj]} />)
      )}
    </div>
  );
}

function TabBtn({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
        ativo ? "bg-[var(--brand)] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{k}</span>
      <span className="text-slate-700">{v || "—"}</span>
    </div>
  );
}

function TagLinha({ l }: { l: { tag: Tag; obs?: string } }) {
  if (!l.tag) return null;
  const cor = l.tag === "novo" ? "#dc2626" : l.tag === "baixado" ? "#059669" : "#d97706";
  return (
    <span title={l.obs} className="ml-1.5 align-middle">
      <Selo color={cor}>{l.tag}</Selo>
    </span>
  );
}

// Linha "baixada" (veio do relatório anterior): esmaecida.
const trCls = (l: { tag: Tag }) =>
  `border-b border-slate-100 align-top last:border-0 ${l.tag === "baixado" ? "opacity-60" : ""}`;

function EmpresaFiscal({ e, anterior: ant }: { e: FiscalEmpresa; anterior?: FiscalEmpresa }) {
  // Só compara com o anterior se ambos foram lidos pela mesma versão do leitor.
  const incomparavel = !!ant && (ant.versaoLeitor ?? 1) !== (e.versaoLeitor ?? 1);
  const anterior = incomparavel ? undefined : ant;
  const cnd = statusCND(e.certidao.tipo, e.certidao.validade);
  const t = totaisFiscais(e);
  const vencidos = marcarLinhas(e.debitos.filter((d) => !ehAVencer(d)), anterior?.debitos.filter((d) => !ehAVencer(d)), chaveDebito, mudouDebito);
  const aVencer = marcarLinhas(e.debitos.filter(ehAVencer), anterior?.debitos.filter(ehAVencer), chaveDebito, mudouDebito);
  const processos = marcarLinhas(e.processos, anterior?.processos, (p) => p.numero);
  const parcelamentos = marcarLinhas(e.parcelamentos, anterior?.parcelamentos, (p) => `${p.origem}|${p.identificador}`);
  // SIDA agrupada por processo (o mesmo lançamento costuma gerar várias inscrições).
  const inscricoes = marcarLinhas(e.inscricoes, anterior?.inscricoes, (x) => x.inscricao).sort(
    (a, b) => a.x.processo.localeCompare(b.x.processo) || a.x.inscricao.localeCompare(b.x.inscricao)
  );
  const exSimples = exclusaoSimples(e);
  const divida = marcarLinhas(e.divida, anterior?.divida, (x) => x.inscricao);
  const omissoes = marcarLinhas(e.omissoes ?? [], anterior ? anterior.omissoes ?? [] : undefined, (o) => `${o.declaracao}|${o.periodo}`);
  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-3">
        <span className="font-semibold text-slate-800">{e.apelido || e.razaoSocial}</span>
        <span className="font-mono text-xs text-slate-400">{e.cnpj}</span>
        <Selo color={e.cadastro.situacao === "ATIVA" ? "#059669" : "#64748b"}>{e.cadastro.situacao || "—"}</Selo>
        <Selo color={cnd.cor}>CND: {cnd.label}</Selo>
        {exSimples ? (
          <Selo color={exSimples.futura ? "#d97706" : "#64748b"}>
            {exSimples.futura ? `Simples: exclusão em ${exSimples.data}` : `Excluída do Simples em ${exSimples.data}`}
          </Selo>
        ) : null}
        {e.semPendencias ? <Selo color="#059669">Sem pendências</Selo> : null}
        <span className="ml-auto text-xs text-slate-400">
          consulta {e.dataConsulta}
          {anterior ? ` · comparado com ${anterior.dataConsulta}` : ""}
          {incomparavel ? " · sem comparação (relatório anterior lido com versão antiga do leitor)" : ""}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 border-b border-slate-100 px-5 py-3 text-xs md:grid-cols-4">
        <KV k="Razão social" v={e.razaoSocial} />
        <KV k="Natureza" v={e.cadastro.natureza} />
        <KV k="Abertura" v={e.cadastro.abertura} />
        <KV k="Porte" v={e.cadastro.porte} />
        <KV k="CNAE" v={e.cadastro.cnae} />
        <KV k="Endereço" v={[e.cadastro.endereco, e.cadastro.bairro].filter(Boolean).join(", ")} />
        <KV k="Município/UF" v={[e.cadastro.municipio, e.cadastro.uf].filter(Boolean).join("/")} />
        <KV k="Responsável" v={e.cadastro.responsavel} />
        <KV k="Certidão" v={`${e.certidao.tipo}${e.certidao.codigo ? ` · ${e.certidao.codigo}` : ""}`} />
        <KV k="Emissão / Validade" v={`${e.certidao.emissao || "—"} → ${e.certidao.validade || "—"}`} />
        {e.cadastro.simples.length ? (
          <KV k="Simples Nacional" v={e.cadastro.simples.map((s) => `${s.inclusao}→${s.exclusao || "atual"}`).join("; ")} />
        ) : null}
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-1 border-b border-slate-100 bg-slate-50 px-5 py-2 text-xs">
        <Tot k="Principal" v={t.original} />
        <Tot k="Multa" v={t.multa} red />
        <Tot k="Juros" v={t.juros} red />
        <Tot k="Consolidado" v={t.consolidado} strong />
        <Tot k="Saldo devedor" v={t.saldo} />
        {t.aVencer > 0 ? <Tot k="A vencer" v={t.aVencer} /> : null}
        {e.totalSuspenso > 0 ? <Tot k="Parcelado (suspenso)" v={e.totalSuspenso} /> : null}
      </div>

      {omissoes.length > 0 && (
        <SecTable titulo="Omissões de declaração">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-2 font-medium">Declaração</th>
                <th className="px-3 py-2 font-medium">Período</th>
              </tr>
            </thead>
            <tbody>
              {omissoes.map((l, i) => (
                <tr key={i} className={trCls(l)}>
                  <td className="px-5 py-1.5 text-xs text-slate-600">
                    {l.x.declaracao}
                    <TagLinha l={l} />
                  </td>
                  <td className="px-3 py-1.5 tabular-nums text-xs text-slate-500">{l.x.periodo}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <TotRow cels={[`Total: ${contaAtivas(omissoes)}`, ""]} />
            </tfoot>
          </table>
        </SecTable>
      )}

      {vencidos.length > 0 && <TabelaDebitos titulo="Débitos (SIEF)" linhas={vencidos} completo />}

      {aVencer.length > 0 && <TabelaDebitos titulo="A vencer" linhas={aVencer} />}

      {processos.length > 0 && (
        <SecTable titulo="Processos fiscais (SIEF)">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-2 font-medium">Processo</th>
                <th className="px-3 py-2 font-medium">Situação</th>
                <th className="px-3 py-2 font-medium">Localização</th>
                <th className="px-3 py-2 font-medium">Proc. de crédito</th>
              </tr>
            </thead>
            <tbody>
              {processos.map((l, i) => (
                <tr key={i} className={trCls(l)}>
                  <td className="px-5 py-1.5 font-mono text-xs text-slate-600">
                    {l.x.numero}
                    <TagLinha l={l} />
                  </td>
                  <td className="px-3 py-1.5 text-xs text-slate-600">{l.x.situacao}</td>
                  <td className="px-3 py-1.5 text-xs text-slate-500">{l.x.localizacao}</td>
                  <td className="px-3 py-1.5 font-mono text-[11px] text-slate-500">{l.x.processosCredito.join(", ")}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <TotRow cels={[`Total: ${contaAtivas(processos)}`, "", "", ""]} />
            </tfoot>
          </table>
        </SecTable>
      )}

      {parcelamentos.length > 0 && (
        <SecTable titulo="Parcelamentos (SIEFPAR / PARCSN / SISPAR)">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-2 font-medium">Origem</th>
                <th className="px-3 py-2 font-medium">Identificador</th>
                <th className="px-3 py-2 text-right font-medium">Valor suspenso</th>
                <th className="px-3 py-2 font-medium">Modalidade</th>
              </tr>
            </thead>
            <tbody>
              {parcelamentos.map((l, i) => (
                <tr key={i} className={trCls(l)}>
                  <td className="px-5 py-1.5 text-xs text-slate-600">
                    {l.x.origem}
                    <TagLinha l={l} />
                  </td>
                  <td className="px-3 py-1.5 font-mono text-xs text-slate-600">{l.x.identificador}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">{l.x.valorSuspenso > 0 ? fmtMoney(l.x.valorSuspenso) : "—"}</td>
                  <td className="px-3 py-1.5 text-xs text-slate-500">{[l.x.tipo, l.x.modalidade].filter(Boolean).join(" · ")}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <TotRow cels={[`Total: ${contaAtivas(parcelamentos)}`, "", { v: fmtMoney(e.totalSuspenso), num: true }, ""]} />
            </tfoot>
          </table>
        </SecTable>
      )}

      {inscricoes.length > 0 && (
        <SecTable titulo="Inscrições em dívida ativa (SIDA)">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-2 font-medium">Inscrição</th>
                <th className="px-3 py-2 font-medium">Receita</th>
                <th className="px-3 py-2 font-medium">Inscrito em</th>
                <th className="px-3 py-2 font-medium">Processo</th>
                <th className="px-3 py-2 font-medium">Situação</th>
              </tr>
            </thead>
            <tbody>
              {inscricoes.map((l, i) => (
                <tr key={i} className={trCls(l)}>
                  <td className="px-5 py-1.5 font-mono text-xs text-slate-600">
                    {l.x.inscricao}
                    <TagLinha l={l} />
                  </td>
                  <td className="px-3 py-1.5 text-xs text-slate-600">{l.x.receita}</td>
                  <td className="px-3 py-1.5 tabular-nums text-xs text-slate-500">{l.x.inscritoEm}</td>
                  <td className="px-3 py-1.5 font-mono text-[11px] text-slate-500">{l.x.processo}</td>
                  <td className="px-3 py-1.5 text-xs text-slate-500">
                    {l.x.situacao}
                    {inscricaoSuspensa(l.x.situacao) ? (
                      <span className="ml-1.5">
                        <Selo color="#0891b2">parcelada</Selo>
                      </span>
                    ) : inscricaoAjuizada(l.x.situacao) ? (
                      <span className="ml-1.5">
                        <Selo color="#dc2626">ajuizada</Selo>
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <TotRow
                cels={[
                  `Total: ${contaAtivas(inscricoes)}`,
                  "",
                  "",
                  `${new Set(inscricoes.filter((l) => l.tag !== "baixado").map((l) => l.x.processo)).size} processo(s)`,
                  `${inscricoes.filter((l) => l.tag !== "baixado" && inscricaoSuspensa(l.x.situacao)).length} parcelada(s)`,
                ]}
              />
            </tfoot>
          </table>
        </SecTable>
      )}

      {divida.length > 0 && (
        <SecTable titulo="Inscrições (Sistema DIVIDA)">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-2 font-medium">Inscrição</th>
                <th className="px-3 py-2 font-medium">Situação</th>
              </tr>
            </thead>
            <tbody>
              {divida.map((l, i) => (
                <tr key={i} className={trCls(l)}>
                  <td className="px-5 py-1.5 font-mono text-xs text-slate-600">
                    {l.x.inscricao}
                    <TagLinha l={l} />
                  </td>
                  <td className="px-3 py-1.5 text-xs text-slate-500">{l.x.situacao}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <TotRow cels={[`Total: ${contaAtivas(divida)}`, ""]} />
            </tfoot>
          </table>
        </SecTable>
      )}

      {e.socios.length > 0 && (
        <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
          <span className="font-medium text-slate-600">Sócios/Adm.: </span>
          {e.socios.map((s, i) => (
            <span key={i}>
              {i > 0 ? " · " : ""}
              {s.nome}
              {s.qualificacao ? ` (${s.qualificacao}${s.capSocial ? `, ${s.capSocial}` : ""})` : ""}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

// Tabela de débitos. "completo" = vencidos (com multa/juros/consolidado); senão só
// principal/saldo (a vencer). Linha de total soma as linhas atuais (sem as
// "baixado"), fechando com a faixa de totais da empresa.
function TabelaDebitos({ titulo, linhas, completo }: { titulo: string; linhas: Linha<FiscalDebito>[]; completo?: boolean }) {
  const at = linhas.filter((l) => l.tag !== "baixado").map((l) => l.x);
  const sm = (f: (d: FiscalDebito) => number) => fmtMoney(Math.round(at.reduce((a, d) => a + f(d), 0) * 100) / 100);
  const n = (v: string) => ({ v, num: true });
  return (
    <SecTable titulo={titulo}>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-5 py-2 font-medium">Receita</th>
            <th className="px-3 py-2 font-medium">Período</th>
            <th className="px-3 py-2 font-medium">Vcto</th>
            <th className="px-3 py-2 text-right font-medium">Original</th>
            <th className="px-3 py-2 text-right font-medium">Saldo</th>
            {completo ? (
              <>
                <th className="px-3 py-2 text-right font-medium">Multa</th>
                <th className="px-3 py-2 text-right font-medium">Juros</th>
                <th className="px-3 py-2 text-right font-medium">Consolidado</th>
              </>
            ) : null}
            <th className="px-3 py-2 font-medium">Situação</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => {
            const d = l.x;
            return (
              <tr key={i} className={trCls(l)}>
                <td className="px-5 py-1.5 text-slate-700">
                  {d.receita}
                  <TagLinha l={l} />
                  {d.saldoDevedor > 0 && d.saldoDevedor < d.valorOriginal ? (
                    <span className="ml-1.5 align-middle" title="Saldo menor que o principal: pagamento parcial ou compensação">
                      <Selo color="#6366f1">pago parcial</Selo>
                    </span>
                  ) : null}
                  {d.nota ? <div className="text-[11px] text-slate-400">Notif.: {d.nota}</div> : null}
                  {l.tag === "mudou" && l.obs ? <div className="text-[11px] text-amber-700">{l.obs}</div> : null}
                </td>
                <td className="px-3 py-1.5 tabular-nums text-slate-500">{d.periodo}</td>
                <td className="px-3 py-1.5 tabular-nums text-slate-500">{d.vencimento}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">{fmtMoney(d.valorOriginal)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">{fmtMoney(d.saldoDevedor)}</td>
                {completo ? (
                  <>
                    <td className="px-3 py-1.5 text-right tabular-nums text-red-600">{d.multa > 0 ? fmtMoney(d.multa) : "—"}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-red-600">{d.juros > 0 ? fmtMoney(d.juros) : "—"}</td>
                    <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-slate-800">{fmtMoney(d.consolidado)}</td>
                  </>
                ) : null}
                <td className="px-3 py-1.5 text-xs text-slate-500">{d.situacao}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <TotRow
            cels={[
              `Total: ${at.length}`, "", "", n(sm((d) => d.valorOriginal)), n(sm((d) => d.saldoDevedor)),
              ...(completo ? [n(sm((d) => d.multa)), n(sm((d) => d.juros)), n(sm((d) => d.consolidado))] : []),
              "",
            ]}
          />
        </tfoot>
      </table>
    </SecTable>
  );
}

const contaAtivas = (ls: { tag: Tag }[]) => ls.filter((l) => l.tag !== "baixado").length;

// Linha de total (rodapé) das tabelas da empresa.
function TotRow({ cels }: { cels: (string | { v: string; num: boolean })[] }) {
  return (
    <tr className="border-t-2 border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800">
      {cels.map((c, i) => {
        const v = typeof c === "string" ? c : c.v;
        const num = typeof c !== "string" && c.num;
        return (
          <td key={i} className={`${i === 0 ? "px-5" : "px-3"} py-2 ${num ? "text-right tabular-nums" : ""}`}>
            {v}
          </td>
        );
      })}
    </tr>
  );
}

function Tot({ k, v, red, strong }: { k: string; v: number; red?: boolean; strong?: boolean }) {
  return (
    <span className="flex items-baseline gap-1">
      <span className="text-[11px] uppercase tracking-wide text-slate-400">{k}:</span>
      <b className={`tabular-nums ${red ? "text-red-600" : strong ? "text-slate-900" : "text-slate-700"}`}>{fmtMoney(v)}</b>
    </span>
  );
}

function SecTable({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-slate-100">
      <div className="px-5 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}
