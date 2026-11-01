"use client";

// Repositório de documentos importados: PDFs originais da Situação Fiscal, CNDT,
// CND FGTS e parcelamentos (bucket 'docs-fiscais') e os comprovantes de DARF
// (bucket 'darf-pdfs'), com filtro e botão para abrir o arquivo.
import { useMemo, useState } from "react";
import type { Documento } from "@/lib/dbDocumentos";
import { urlDocumento } from "@/lib/dbDocumentos";
import { urlPdf } from "@/lib/dbDup";
import type { DarfRow } from "@/lib/darf";
import { createClient } from "@/lib/supabase/client";
import { fmtMoney } from "@/lib/format";
import { Card, Selo } from "@/components/ui";

const TIPOS: Record<string, { rotulo: string; cor: string }> = {
  situacao_fiscal: { rotulo: "Situação Fiscal", cor: "#2563eb" },
  cndt: { rotulo: "CNDT", cor: "#7c3aed" },
  fgts: { rotulo: "CND FGTS", cor: "#0891b2" },
  parcelamento: { rotulo: "Parcelamento", cor: "#d97706" },
};

const dig = (s: string) => (s || "").replace(/\D/g, "");
const dataBR = (iso: string) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
const isoBR = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
const kb = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

type Props = {
  documentos: Documento[];
  darfs: DarfRow[];
  empresas: { cnpj: string; nome: string }[];
  carregado: boolean;
};

export default function Documentos({ documentos, darfs, empresas, carregado }: Props) {
  const [emp, setEmp] = useState("");
  const [tipo, setTipo] = useState("");
  const [busca, setBusca] = useState("");
  const [abrindo, setAbrindo] = useState("");

  const nome = useMemo(() => new Map(empresas.map((e) => [dig(e.cnpj), e.nome])), [empresas]);
  const rot = (cnpj: string, razao: string) => nome.get(dig(cnpj)) || razao || cnpj || "—";
  const q = busca.trim().toLowerCase();

  const docs = documentos.filter(
    (d) =>
      (!emp || dig(d.cnpj) === dig(emp)) &&
      (!tipo || d.tipo === tipo) &&
      (!q || `${d.arquivo} ${d.referencia} ${d.razaoSocial} ${rot(d.cnpj, d.razaoSocial)}`.toLowerCase().includes(q))
  );

  // Comprovantes de DARF: 1 linha por PDF de origem.
  const comprovantes = useMemo(() => {
    const m = new Map<string, { path: string; arquivo: string; cnpj: string; empresa: string; qtde: number; total: number; de: string; ate: string }>();
    for (const r of darfs) {
      if (!r.arquivoPath) continue;
      const g = m.get(r.arquivoPath) ?? { path: r.arquivoPath, arquivo: r.arquivo, cnpj: r.cnpj, empresa: r.empresa, qtde: 0, total: 0, de: "", ate: "" };
      g.qtde++;
      g.total = Math.round((g.total + r.total) * 100) / 100;
      const rec = r.recolhimento || "";
      if (rec && (!g.de || rec < g.de)) g.de = rec;
      if (rec && (!g.ate || rec > g.ate)) g.ate = rec;
      m.set(r.arquivoPath, g);
    }
    return [...m.values()].sort((a, b) => b.ate.localeCompare(a.ate));
  }, [darfs]);
  const comps = tipo && tipo !== "darf" ? [] : comprovantes.filter(
    (c) => (!emp || dig(c.cnpj) === dig(emp)) && (!q || `${c.arquivo} ${c.empresa}`.toLowerCase().includes(q))
  );
  const docsVis = tipo === "darf" ? [] : docs;

  async function abrir(chave: string, fn: () => Promise<string | null>) {
    setAbrindo(chave);
    try {
      const url = await fn();
      if (url) window.open(url, "_blank", "noopener");
      else alert("Não foi possível abrir o arquivo (sem acesso ou arquivo removido).");
    } finally {
      setAbrindo("");
    }
  }

  const sel = "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm";
  const btn = "rounded-md border border-[var(--brand)] px-2.5 py-1 text-xs font-semibold text-[var(--brand)] hover:bg-[var(--brand-soft)] disabled:opacity-50";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <select className={sel} value={emp} onChange={(e) => setEmp(e.target.value)}>
          <option value="">Todas as empresas</option>
          {empresas.map((e) => (
            <option key={e.cnpj} value={e.cnpj}>
              {e.nome}
            </option>
          ))}
        </select>
        <select className={sel} value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Todos os tipos</option>
          {Object.entries(TIPOS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.rotulo}
            </option>
          ))}
          <option value="darf">Comprovantes de DARF</option>
        </select>
        <input className={`${sel} min-w-[220px] flex-1`} placeholder="Buscar por arquivo, empresa ou referência" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      {tipo !== "darf" && (
        <Card className="p-0">
          <div className="px-5 pb-3 pt-4 text-sm font-semibold uppercase tracking-wide text-slate-600">Documentos fiscais importados</div>
          {!carregado ? (
            <p className="border-t border-slate-100 px-5 py-6 text-sm text-slate-400">Carregando…</p>
          ) : docsVis.length === 0 ? (
            <p className="border-t border-slate-100 px-5 py-6 text-sm text-slate-400">
              Nenhum documento {documentos.length ? "para o filtro" : "guardado ainda"}. Os PDFs passam a ser guardados a partir desta versão, a
              cada importação (Situação Fiscal, CNDT, CND FGTS e parcelamentos). Os importados antes precisam ser enviados de novo para entrar
              aqui.
            </p>
          ) : (
            <div className="overflow-x-auto border-t border-slate-100">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-5 py-2 font-medium">Tipo</th>
                    <th className="px-3 py-2 font-medium">Empresa</th>
                    <th className="px-3 py-2 font-medium">Referência</th>
                    <th className="px-3 py-2 font-medium">Arquivo</th>
                    <th className="px-3 py-2 font-medium">Enviado em</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {docsVis.map((d) => (
                    <tr key={d.id} className="border-b border-slate-100 align-top last:border-0">
                      <td className="px-5 py-2">
                        <Selo color={TIPOS[d.tipo]?.cor}>{TIPOS[d.tipo]?.rotulo || d.tipo}</Selo>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-700">
                        {rot(d.cnpj, d.razaoSocial)}
                        <div className="font-mono text-[11px] text-slate-400">{d.cnpj}</div>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">{d.referencia || "—"}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {d.arquivo}
                        <div className="text-[11px] text-slate-400">{kb(d.tamanho)}</div>
                      </td>
                      <td className="px-3 py-2 text-xs tabular-nums text-slate-500">{dataBR(d.enviadoEm)}</td>
                      <td className="px-3 py-2 text-right">
                        <button className={btn} disabled={abrindo === d.path} onClick={() => abrir(d.path, () => urlDocumento(createClient(), d.path))}>
                          {abrindo === d.path ? "Abrindo…" : "Abrir"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800">
                    <td className="px-5 py-2" colSpan={6}>
                      Total: {docsVis.length} documento(s)
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      )}

      {(!tipo || tipo === "darf") && (
        <Card className="p-0">
          <div className="px-5 pb-3 pt-4 text-sm font-semibold uppercase tracking-wide text-slate-600">Comprovantes de DARF</div>
          {comps.length === 0 ? (
            <p className="border-t border-slate-100 px-5 py-6 text-sm text-slate-400">Nenhum comprovante de DARF com PDF guardado para o filtro.</p>
          ) : (
            <div className="overflow-x-auto border-t border-slate-100">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-5 py-2 font-medium">Empresa</th>
                    <th className="px-3 py-2 font-medium">Arquivo</th>
                    <th className="px-3 py-2 font-medium">Recolhimento</th>
                    <th className="px-3 py-2 text-right font-medium">DARFs</th>
                    <th className="px-3 py-2 text-right font-medium">Total pago</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {comps.map((c) => (
                    <tr key={c.path} className="border-b border-slate-100 align-top last:border-0">
                      <td className="px-5 py-2 text-xs text-slate-700">{c.empresa}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">{c.arquivo}</td>
                      <td className="px-3 py-2 text-xs tabular-nums text-slate-500">
                        {c.de === c.ate ? isoBR(c.de) : `${isoBR(c.de)} a ${isoBR(c.ate)}`}
                      </td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-600">{c.qtde}</td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-700">{fmtMoney(c.total)}</td>
                      <td className="px-3 py-2 text-right">
                        <button className={btn} disabled={abrindo === c.path} onClick={() => abrir(c.path, () => urlPdf(createClient(), c.path))}>
                          {abrindo === c.path ? "Abrindo…" : "Abrir"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800">
                    <td className="px-5 py-2" colSpan={3}>
                      Total: {comps.length} arquivo(s)
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{comps.reduce((s, c) => s + c.qtde, 0)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(Math.round(comps.reduce((s, c) => s + c.total, 0) * 100) / 100)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
