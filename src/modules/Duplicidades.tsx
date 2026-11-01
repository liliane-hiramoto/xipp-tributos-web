"use client";

import { useEffect, useMemo, useState } from "react";
import { duplicidades, corCategoria, type DarfRow } from "@/lib/darf";
import { fmtMoney, fmtDate } from "@/lib/format";
import { Card, Kpi, Selo } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { fetchNotas, salvarNota, chaveGrupo, urlPdf, type DupNote } from "@/lib/dbDup";

export default function Duplicidades({ rows }: { rows: DarfRow[] }) {
  const grupos = useMemo(() => duplicidades(rows), [rows]);
  const [notas, setNotas] = useState<Record<string, DupNote>>({});
  const [coment, setComent] = useState<Record<string, string>>({});
  const [just, setJust] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState<string | null>(null);

  useEffect(() => {
    fetchNotas(createClient()).then(setNotas).catch(() => {});
  }, []);

  const notaDe = (ch: string): DupNote => notas[ch] ?? { comentario: "", naoDuplicidade: false, justificativa: "" };

  async function patch(ch: string, p: Partial<DupNote>) {
    const novo = { ...notaDe(ch), ...p };
    setSalvando(ch);
    try {
      await salvarNota(createClient(), ch, novo);
      setNotas((n) => ({ ...n, [ch]: novo }));
    } catch (e) {
      alert("Falha ao salvar (a migração 0006 foi rodada no Supabase?): " + (e as Error).message);
    } finally {
      setSalvando(null);
    }
  }

  async function abrirPdf(path: string) {
    const url = await urlPdf(createClient(), path);
    if (url) window.open(url, "_blank", "noopener");
    else alert("Não foi possível abrir o PDF (não armazenado ou sem acesso).");
  }

  const chaves = grupos.map((g) => chaveGrupo(g.cnpj, g.codigo, g.competencia, g.vencimento, g.valor));
  const ativos = grupos.filter((_, i) => !notaDe(chaves[i]).naoDuplicidade);
  const marcados = grupos.length - ativos.length;
  const envolvidos = ativos.reduce((s, g) => s + g.qtd, 0);
  const potencial = ativos.reduce((s, g) => s + g.potencial, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Grupos potenciais" value={String(ativos.length)} sub={marcados ? `${marcados} marcado(s) como não-duplicidade` : "mesmo tributo, competência e valor"} tone={ativos.length > 0 ? "danger" : "ok"} />
        <Kpi label="Lançamentos envolvidos" value={String(envolvidos)} />
        <Kpi label="Valor potencial em duplicidade" value={fmtMoney(potencial)} sub="soma dos totais excedentes (todos menos o 1º)" tone={potencial > 0 ? "danger" : "ok"} />
        <Kpi label="Marcados p/ não-duplicidade" value={String(marcados)} sub="excluídos dos totais acima" />
      </div>

      <p className="text-xs text-slate-400">
        Critério: mesma empresa, mesmo código de tributo, mesma competência (período de apuração; quando em
        branco, usa-se o vencimento), <b>mesmo vencimento</b> e mesmo valor, com 2+ lançamentos. Cotas do
        IRPJ/CSLL presumido (mesma competência, <b>vencimentos diferentes</b>) NÃO são duplicidade.
        Verifica <b>toda a base</b>.
        Marque <b>&ldquo;não é duplicidade&rdquo;</b> (com justificativa) para tirar dos totais. Comentários e
        marcações ficam salvos.
      </p>

      {grupos.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-12 text-center">
          <div className="text-3xl opacity-30">✓</div>
          <h2 className="mt-3 text-lg font-semibold text-slate-700">Nenhuma duplicidade potencial encontrada</h2>
          <p className="mt-1 text-sm text-slate-500">Não há tributos com mesma competência e mesmo valor recolhidos mais de uma vez.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {grupos.map((g, i) => {
            const ch = chaves[i];
            const nota = notaDe(ch);
            const j = just[ch] ?? "";
            return (
              <Card key={ch} className={`p-0 ${nota.naoDuplicidade ? "opacity-70" : ""}`}>
                <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-3">
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{g.empresa}</span>
                  <span className="font-mono text-xs text-slate-500">{g.codigo}</span>
                  <Selo color={corCategoria(g.categoria)}>{g.categoria}</Selo>
                  <span className="font-medium text-slate-700">{g.tributo}</span>
                  {nota.naoDuplicidade ? <Selo color="#059669">não é duplicidade</Selo> : null}
                  <span className="ml-auto flex flex-wrap items-center gap-4 text-xs text-slate-500">
                    <span>Competência: <b className="text-slate-700">{g.competencia ? fmtDate(g.competencia) : "n/d"}</b>{g.usouVencimento && <span className="text-slate-400"> (por vencimento)</span>}</span>
                    <span>Valor: <b className="text-slate-700">{fmtMoney(g.valor)}</b></span>
                    <span className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium" style={g.mesmoDia ? { backgroundColor: "#fee2e2", color: "#b91c1c" } : { backgroundColor: "#fef3c7", color: "#b45309" }}>{g.qtd}× · {g.mesmoDia ? "mesmo dia" : "dias diferentes"}</span>
                  </span>
                </div>

                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                      <th className="px-5 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">Competência</th>
                      <th className="px-3 py-2 font-medium">Vencimento</th>
                      <th className="px-3 py-2 font-medium">Recolhimento</th>
                      <th className="px-3 py-2 font-medium">Nº do Documento</th>
                      <th className="px-3 py-2 font-medium">Origem</th>
                      <th className="px-3 py-2 text-right font-medium">Multa</th>
                      <th className="px-3 py-2 text-right font-medium">Juros</th>
                      <th className="px-3 py-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.linhas.map((l, jx) => (
                      <tr key={l.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-5 py-2 text-slate-400">{jx === 0 ? <span className="text-emerald-600" title="1º recolhimento (referência)">1º</span> : <span className="text-red-500" title="potencial duplicidade">{jx + 1}º</span>}</td>
                        <td className="px-3 py-2 tabular-nums text-slate-500">{fmtDate(l.periodoApuracao)}</td>
                        <td className="px-3 py-2 tabular-nums text-slate-500">{fmtDate(l.vencimento)}</td>
                        <td className="px-3 py-2 tabular-nums text-slate-700">{fmtDate(l.recolhimento)}</td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-500">{l.numeroDocumento || "—"}</td>
                        <td className="px-3 py-2 text-xs text-slate-400">
                          {l.arquivoPath ? (
                            <button onClick={() => abrirPdf(l.arquivoPath!)} className="rounded border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-[var(--brand)] hover:bg-slate-50" title="Abrir PDF de origem">📎 PDF</button>
                          ) : (
                            l.arquivo || "—"
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-red-600">{l.multa > 0 ? fmtMoney(l.multa) : "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-red-600">{l.juros > 0 ? fmtMoney(l.juros) : "—"}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-800">{fmtMoney(l.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Análise: comentário + não é duplicidade */}
                <div className="space-y-3 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="flex-1 min-w-[220px]">
                      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400">Comentário da análise</label>
                      <textarea
                        rows={2}
                        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                        placeholder="Observações sobre esta duplicidade…"
                        value={coment[ch] ?? nota.comentario}
                        onChange={(e) => setComent((c) => ({ ...c, [ch]: e.target.value }))}
                      />
                    </div>
                    <button
                      onClick={() => patch(ch, { comentario: coment[ch] ?? nota.comentario })}
                      disabled={salvando === ch}
                      className="rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      {salvando === ch ? "Salvando…" : "Salvar comentário"}
                    </button>
                  </div>

                  {nota.naoDuplicidade ? (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-slate-500">Justificativa: <b className="text-slate-700">{nota.justificativa || "—"}</b></span>
                      <button onClick={() => patch(ch, { naoDuplicidade: false })} disabled={salvando === ch} className="ml-auto rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-600 hover:bg-white disabled:opacity-60">
                        Reverter (é duplicidade)
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="flex-1 min-w-[220px]">
                        <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400">Justificativa p/ &ldquo;não é duplicidade&rdquo; (mín. 10 caracteres)</label>
                        <input
                          className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                          placeholder="Ex.: são competências distintas; recolhimentos de matriz e filial…"
                          value={j}
                          onChange={(e) => setJust((s) => ({ ...s, [ch]: e.target.value }))}
                        />
                      </div>
                      <button
                        onClick={() => patch(ch, { naoDuplicidade: true, justificativa: j.trim() })}
                        disabled={salvando === ch || j.trim().length < 10}
                        title={j.trim().length < 10 ? "Justificativa precisa de ≥10 caracteres" : ""}
                        className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 disabled:opacity-50"
                      >
                        Marcar: não é duplicidade
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
