"use client";

// Parcelamentos: pedidos importados do e-CAC ("Consulta Pedidos de Parcelamento" —
// consolidação + demonstrativo de pagamentos), com parcelas pagas, saldo estimado
// e débitos incluídos. Também lista os parcelamentos que constam na Situação
// Fiscal mas ainda não têm o pedido importado.
import { Fragment, useMemo, useState } from "react";
import type { Parcelamento } from "@/data/parcelamentos";
import type { FiscalEmpresa } from "@/data/fiscal-tipos";
import { resumoParcelamento } from "@/lib/importParcelamento";
import { fmtMoney } from "@/lib/format";
import { Card, Kpi, Selo } from "@/components/ui";
import ImportDocsBar from "@/components/ImportDocsBar";

type Props = {
  parcelamentos: Parcelamento[];
  fiscais: FiscalEmpresa[];
  onImportar: (files: File[]) => void;
  importando: boolean;
  canEdit: boolean;
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const ordData = (d: string) => (d || "").slice(0, 10).split("/").reverse().join("");

function corSituacao(s: string): string {
  if (/Em parcelamento/i.test(s)) return "#059669";
  if (/Rescis|Cancel|Indefer/i.test(s)) return "#dc2626";
  if (/Liquidad|Encerrado/i.test(s)) return "#64748b";
  return "#d97706";
}

export default function FiscalParcelamentos({ parcelamentos, fiscais, onImportar, importando, canEdit }: Props) {
  const [aberto, setAberto] = useState<string>("");
  const apelido = useMemo(() => new Map(fiscais.map((e) => [e.cnpj, e.apelido || e.razaoSocial])), [fiscais]);
  const linhas = useMemo(
    () =>
      parcelamentos
        .map((p) => ({ p, r: resumoParcelamento(p), emp: apelido.get(p.cnpj) || p.razaoSocial }))
        .sort((a, b) => Number(b.r.ativo) - Number(a.r.ativo) || a.emp.localeCompare(b.emp) || ordData(b.p.dataPedido).localeCompare(ordData(a.p.dataPedido))),
    [parcelamentos, apelido]
  );
  const ativos = linhas.filter((l) => l.r.ativo);
  const tot = {
    consolidadoAtivos: r2(ativos.reduce((s, l) => s + l.p.valorConsolidado, 0)),
    pago: r2(linhas.reduce((s, l) => s + l.r.valorPago, 0)),
    saldo: r2(ativos.reduce((s, l) => s + l.r.saldoEstimado, 0)),
    atraso: ativos.reduce((s, l) => s + l.r.emAtraso, 0),
    consolidado: r2(linhas.reduce((s, l) => s + l.p.valorConsolidado, 0)),
    pagas: linhas.reduce((s, l) => s + l.r.pagas, 0),
  };

  // Parcelamentos que a Situação Fiscal mostra e cujo pedido não foi importado.
  const semDetalhe = fiscais.flatMap((e) =>
    e.parcelamentos
      .filter((x) => !parcelamentos.some((p) => p.cnpj === e.cnpj && p.sigla === x.origem.split("/")[0] && /Em parcelamento/i.test(p.situacao)))
      .map((x) => ({ emp: e.apelido || e.razaoSocial, x }))
  );

  return (
    <div className="space-y-6">
      <ImportDocsBar onImportar={onImportar} importando={importando} canEdit={canEdit} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Pedidos ativos" value={String(ativos.length)} sub={`${linhas.length - ativos.length} encerrado(s)/rescindido(s)`} />
        <Kpi label="Consolidado (ativos)" value={fmtMoney(tot.consolidadoAtivos)} />
        <Kpi label="Saldo estimado (ativos)" value={fmtMoney(tot.saldo)} sub="parcelas restantes × parcela básica" />
        <Kpi label="Parcelas em atraso" value={String(tot.atraso)} tone={tot.atraso ? "danger" : "ok"} sub={`pago até hoje ${fmtMoney(tot.pago)}`} />
      </div>

      <Card className="p-0">
        <div className="px-5 pb-3 pt-4 text-sm font-semibold uppercase tracking-wide text-slate-600">Pedidos de parcelamento (e-CAC)</div>
        {linhas.length === 0 ? (
          <p className="border-t border-slate-100 px-5 py-6 text-sm text-slate-400">
            Nenhum pedido importado. No e-CAC, abra o parcelamento (ex.: Parcelamento do Simples Nacional → Consultar pedidos), entre na
            consolidação e no demonstrativo de pagamentos e imprima cada página em PDF; depois importe os PDFs aqui.
          </p>
        ) : (
          <div className="overflow-x-auto border-t border-slate-100">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-5 py-2 font-medium">Empresa</th>
                  <th className="px-3 py-2 font-medium">Modalidade</th>
                  <th className="px-3 py-2 font-medium">Pedido</th>
                  <th className="px-3 py-2 font-medium">Situação</th>
                  <th className="px-3 py-2 text-right font-medium">Consolidado</th>
                  <th className="px-3 py-2 text-right font-medium">Parcelas pagas</th>
                  <th className="px-3 py-2 text-right font-medium">Parcela básica</th>
                  <th className="px-3 py-2 text-right font-medium">Pago</th>
                  <th className="px-3 py-2 text-right font-medium">Saldo estimado</th>
                  <th className="px-3 py-2 font-medium">Último pagto.</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map(({ p, r, emp }) => {
                  const k = `${p.cnpj}|${p.sigla}|${p.numero}`;
                  const ult = p.pagamentos.filter((x) => x.arrecadacao).slice(-1)[0];
                  return (
                    <Fragment key={k}>
                      <tr className="cursor-pointer border-b border-slate-100 align-top hover:bg-slate-50" onClick={() => setAberto(aberto === k ? "" : k)}>
                        <td className="px-5 py-2 text-slate-700">
                          <span className="mr-1 text-slate-400">{aberto === k ? "▾" : "▸"}</span>
                          {emp}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-600" title={p.modalidade}>
                          {p.sigla}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-600">
                          nº {p.numero} · {p.dataPedido}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <Selo color={corSituacao(p.situacao)}>{p.situacao}</Selo>
                          <div className="mt-0.5 text-[11px] text-slate-400">desde {p.dataSituacao}</div>
                          {r.emAtraso > 0 ? <Selo color="#dc2626">{r.emAtraso} em atraso</Selo> : null}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700">{fmtMoney(p.valorConsolidado)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                          {r.pagas} / {p.qtdParcelas}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-600">{fmtMoney(p.parcelaBasica)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-600">{fmtMoney(r.valorPago)}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-800">{r.ativo ? fmtMoney(r.saldoEstimado) : "—"}</td>
                        <td className="px-3 py-2 text-xs tabular-nums text-slate-500">{ult ? `${ult.mes} · ${ult.arrecadacao}` : "—"}</td>
                      </tr>
                      {aberto === k ? (
                        <tr className="border-b border-slate-100 bg-slate-50/60">
                          <td colSpan={10} className="px-5 py-3">
                            <Detalhe p={p} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800">
                  <td className="px-5 py-2">Total: {linhas.length}</td>
                  <td />
                  <td />
                  <td />
                  <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(tot.consolidado)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{tot.pagas}</td>
                  <td />
                  <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(tot.pago)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(tot.saldo)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <p className="border-t border-slate-100 px-5 py-2 text-[11px] text-slate-400">
          Saldo estimado = parcelas restantes × parcela básica (sem a correção pela Selic de cada parcela). Clique num pedido para ver os
          débitos incluídos e as parcelas pagas.
        </p>
      </Card>

      {semDetalhe.length > 0 && (
        <Card className="p-0">
          <div className="px-5 pb-3 pt-4 text-sm font-semibold uppercase tracking-wide text-slate-600">Na Situação Fiscal, sem pedido importado</div>
          <div className="overflow-x-auto border-t border-slate-100">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-5 py-2 font-medium">Empresa</th>
                  <th className="px-3 py-2 font-medium">Origem</th>
                  <th className="px-3 py-2 font-medium">Identificador</th>
                  <th className="px-3 py-2 font-medium">Modalidade</th>
                </tr>
              </thead>
              <tbody>
                {semDetalhe.map(({ emp, x }, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0">
                    <td className="px-5 py-1.5 text-xs text-slate-700">{emp}</td>
                    <td className="px-3 py-1.5 text-xs text-slate-600">{x.origem}</td>
                    <td className="px-3 py-1.5 font-mono text-xs text-slate-600">{x.identificador}</td>
                    <td className="px-3 py-1.5 text-xs text-slate-500">{[x.tipo, x.modalidade].filter(Boolean).join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800">
                  <td className="px-5 py-2" colSpan={4}>
                    Total: {semDetalhe.length}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function Detalhe({ p }: { p: Parcelamento }) {
  const tOrig = r2(p.debitos.reduce((s, d) => s + d.saldoOriginal, 0));
  const tAtu = r2(p.debitos.reduce((s, d) => s + d.valorAtualizado, 0));
  const tPago = r2(p.pagamentos.reduce((s, x) => s + x.valor, 0));
  const th = "px-3 py-1.5 font-medium";
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Débitos incluídos · consolidação {p.dataConsolidacao}
        </div>
        {p.debitos.length === 0 ? (
          <p className="text-xs text-slate-400">Importe a página da consolidação para ver os débitos.</p>
        ) : (
          <table className="w-full rounded border border-slate-200 bg-white text-xs">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className={th}>PA</th>
                <th className={th}>Vencimento</th>
                <th className={th}>Processo</th>
                <th className={`${th} text-right`}>Saldo original</th>
                <th className={`${th} text-right`}>Atualizado</th>
              </tr>
            </thead>
            <tbody>
              {p.debitos.map((d, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-3 py-1 tabular-nums">{d.periodo}</td>
                  <td className="px-3 py-1 tabular-nums">{d.vencimento}</td>
                  <td className="px-3 py-1 font-mono text-[11px]">{d.processo || "—"}</td>
                  <td className="px-3 py-1 text-right tabular-nums">{fmtMoney(d.saldoOriginal)}</td>
                  <td className="px-3 py-1 text-right tabular-nums">{fmtMoney(d.valorAtualizado)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                <td className="px-3 py-1.5" colSpan={3}>
                  Total: {p.debitos.length}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmtMoney(tOrig)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmtMoney(tAtu)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Parcelas pagas</div>
        {p.pagamentos.length === 0 ? (
          <p className="text-xs text-slate-400">Importe a página do demonstrativo de pagamentos para ver as parcelas.</p>
        ) : (
          <table className="w-full rounded border border-slate-200 bg-white text-xs">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className={th}>Parcela</th>
                <th className={th}>Vencimento DAS</th>
                <th className={th}>Pago em</th>
                <th className={`${th} text-right`}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {p.pagamentos.map((x, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-3 py-1 tabular-nums">{x.mes}</td>
                  <td className="px-3 py-1 tabular-nums">{x.vencimento}</td>
                  <td className="px-3 py-1 tabular-nums">{x.arrecadacao || "—"}</td>
                  <td className="px-3 py-1 text-right tabular-nums">{fmtMoney(x.valor)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                <td className="px-3 py-1.5" colSpan={3}>
                  Total: {p.pagamentos.length} de {p.qtdParcelas}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmtMoney(tPago)}</td>
              </tr>
            </tfoot>
          </table>
        )}
        <p className="mt-1 text-[11px] text-slate-400">Fonte: {p.arquivos.join(", ")} · emitido em {p.emitidoEm}</p>
      </div>
    </div>
  );
}
