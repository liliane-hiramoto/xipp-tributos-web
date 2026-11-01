"use client";

import { useMemo } from "react";
import { statusCND, parseBR } from "@/lib/fiscal";
import type { FiscalEmpresa } from "@/data/fiscal-tipos";
import type { Certidao } from "@/data/certidoes";
import { chaveCert } from "@/lib/dbCertidoes";
import { Card, Kpi, SecTitle, Selo } from "@/components/ui";

type Props = {
  fiscais: FiscalEmpresa[];
  certidoes: Certidao[];
  certidoesPrev: Record<string, Certidao>;
};

type Status = { label: string; cor: string; vencida: boolean };

export function statusCert(c: Certidao): Status {
  const v = parseBR(c.validade);
  const hoje = new Date(new Date().toDateString());
  if (!c.regular) return { label: c.tipo === "fgts" ? "Irregular" : "Positiva", cor: "#dc2626", vencida: false };
  if (v && v < hoje) return { label: "Vencida", cor: "#dc2626", vencida: true };
  return { label: c.tipo === "fgts" ? "Regular" : "Regular (negativa)", cor: "#059669", vencida: false };
}

type Linha = {
  cnpj: string;
  apelido: string;
  federal?: { s: Status; validade: string };
  cndt?: Certidao;
  fgts?: Certidao;
};

// Painel consolidado de certidões (Federal RFB/PGFN + CNDT + FGTS), sem upload.
// O envio dos PDFs é pela barra de import da Situação Fiscal (import único).
export default function CndConsolidado({ fiscais, certidoes, certidoesPrev }: Props) {
  const linhas = useMemo<Linha[]>(() => {
    const map = new Map<string, Linha>();
    const get = (cnpj: string, apelido: string) => {
      let l = map.get(cnpj);
      if (!l) {
        l = { cnpj, apelido };
        map.set(cnpj, l);
      }
      if (apelido && !l.apelido) l.apelido = apelido;
      return l;
    };
    for (const e of fiscais) {
      const l = get(e.cnpj, e.apelido || e.razaoSocial);
      if (e.certidao.tipo) l.federal = { s: statusCND(e.certidao.tipo, e.certidao.validade), validade: e.certidao.validade };
    }
    for (const c of certidoes) {
      const l = get(c.cnpj, c.razaoSocial);
      if (c.tipo === "cndt") l.cndt = c;
      else if (c.tipo === "fgts") l.fgts = c;
    }
    return [...map.values()].sort((a, b) => (a.apelido || a.cnpj).localeCompare(b.apelido || b.cnpj));
  }, [fiscais, certidoes]);

  const divergencias = useMemo(() => {
    const out: { rotulo: string; texto: string }[] = [];
    for (const c of certidoes) {
      const p = certidoesPrev[chaveCert(c.cnpj, c.tipo)];
      if (!p) continue;
      const rot = `${c.razaoSocial} · ${c.tipo.toUpperCase()}`;
      if (p.validade !== c.validade) out.push({ rotulo: rot, texto: `validade ${p.validade || "—"} → ${c.validade || "—"}` });
      if (p.numero !== c.numero) out.push({ rotulo: rot, texto: `nº ${p.numero || "—"} → ${c.numero || "—"}` });
      if (p.situacao !== c.situacao) out.push({ rotulo: rot, texto: `situação ${p.situacao || "—"} → ${c.situacao || "—"}` });
    }
    return out;
  }, [certidoes, certidoesPrev]);

  const cndts = certidoes.filter((c) => c.tipo === "cndt").length;
  const fgtss = certidoes.filter((c) => c.tipo === "fgts").length;
  const vencidas = certidoes.filter((c) => statusCert(c).vencida || !c.regular).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Empresas" value={String(linhas.length)} sub="com alguma certidão" />
        <Kpi label="CNDT (trabalhista)" value={String(cndts)} sub="certidões carregadas" />
        <Kpi label="FGTS (CRF)" value={String(fgtss)} sub="certificados carregados" />
        <Kpi label="Vencidas / irregulares" value={String(vencidas)} tone={vencidas ? "danger" : "ok"} sub="CNDT + FGTS" />
      </div>

      {divergencias.length > 0 && (
        <Card className="p-0">
          <div className="border-b border-amber-100 bg-amber-50/60 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
            Divergências vs. certidão anterior ({divergencias.length})
          </div>
          <ul className="space-y-1 px-5 py-3">
            {divergencias.map((d, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <Selo color="#d97706">mudou</Selo>
                <span className="text-slate-400">{d.rotulo}:</span>
                <span className="text-slate-700">{d.texto}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-0">
        <div className="border-b border-slate-200 px-5 py-3">
          <SecTitle>Status das certidões (Federal · Trabalhista · FGTS)</SecTitle>
          <p className="-mt-2 text-xs text-slate-400">
            Federal (RFB/PGFN) vem do relatório de Situação Fiscal. Trabalhista (CNDT) e FGTS entram por
            upload (botão acima). Certidão estadual/municipal não consta aqui.
          </p>
        </div>
        {linhas.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">Nenhuma certidão carregada ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-5 py-2 font-medium">Empresa</th>
                  <th className="px-3 py-2 font-medium">Federal (RFB/PGFN)</th>
                  <th className="px-3 py-2 font-medium">Trabalhista (CNDT)</th>
                  <th className="px-3 py-2 font-medium">FGTS (CRF)</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.cnpj} className="border-b border-slate-100 align-top last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-2">
                      <div className="font-medium text-slate-700">{l.apelido}</div>
                      <div className="font-mono text-[11px] text-slate-400">{l.cnpj}</div>
                    </td>
                    <td className="px-3 py-2">{l.federal ? <Cel s={l.federal.s} validade={l.federal.validade} /> : <span className="text-xs text-slate-300">—</span>}</td>
                    <td className="px-3 py-2">{l.cndt ? <Cel s={statusCert(l.cndt)} validade={l.cndt.validade} numero={l.cndt.numero} /> : <span className="text-xs text-slate-300">sem CNDT</span>}</td>
                    <td className="px-3 py-2">{l.fgts ? <Cel s={statusCert(l.fgts)} validade={l.fgts.validade} numero={l.fgts.numero} /> : <span className="text-xs text-slate-300">sem FGTS</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Cel({ s, validade, numero }: { s: Status; validade: string; numero?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <Selo color={s.cor}>{s.label}</Selo>
      <span className="text-[11px] text-slate-500">val. {validade || "—"}</span>
      {numero ? <span className="font-mono text-[10px] text-slate-400">{numero}</span> : null}
    </div>
  );
}
