"use client";

import { rotuloMes, type Regime } from "@/lib/darf";

export default function TopBar({
  empresas,
  empresa,
  ano,
  mes,
  anos,
  meses,
  regime,
  total,
  filtrado,
  importados,
  importando,
  onEmpresa,
  onPeriodo,
  onRegime,
  onLimpar,
  onImportar,
}: {
  empresas: { cnpj: string; nome: string }[];
  empresa: string;
  ano: string;
  mes: string;
  anos: string[];
  meses: string[];
  regime: Regime;
  total: number;
  filtrado: number;
  importados: number;
  importando: boolean;
  onEmpresa: (cnpj: string) => void;
  onPeriodo: (ano: string, mes: string) => void;
  onRegime: (r: Regime) => void;
  onLimpar: () => void;
  onImportar: (files: File[]) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-slate-500">Base de análise</span>
        <div className="flex rounded-lg bg-slate-100 p-0.5">
          {(
            [
              ["caixa", "Caixa (pagamento)"],
              ["competencia", "Competência (apuração)"],
            ] as [Regime, string][]
          ).map(([val, label]) => (
            <button
              key={val}
              onClick={() => onRegime(val)}
              title={
                val === "caixa"
                  ? "Agrupa pela data de recolhimento (pagamento)"
                  : "Agrupa pela data de apuração do tributo (competência)"
              }
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                regime === val
                  ? "bg-white text-[var(--brand)] shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <span className="self-center pl-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        Empresa
      </span>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-slate-500">Empresa (CNPJ)</span>
        <select
          value={empresa}
          onChange={(e) => onEmpresa(e.target.value)}
          className="max-w-[320px] rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-[var(--brand)]"
        >
          <option value="">{empresas.length > 1 ? "Todas" : empresas[0]?.nome ?? "—"}</option>
          {empresas.map((e) => (
            <option key={e.cnpj} value={e.cnpj}>
              {e.nome} — {e.cnpj}
            </option>
          ))}
        </select>
      </label>

      <span className="self-center pl-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        Período
      </span>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-slate-500">Ano (AAAA)</span>
        <select
          value={ano}
          onChange={(e) => {
            const a = e.target.value;
            onPeriodo(a, mes && a && mes.slice(0, 4) !== a ? "" : mes);
          }}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-[var(--brand)]"
        >
          <option value="">Todos</option>
          {anos.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-slate-500">Mês (MMM/AAAA)</span>
        <select
          value={mes}
          onChange={(e) => {
            const m = e.target.value;
            onPeriodo(m ? m.slice(0, 4) : ano, m);
          }}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-[var(--brand)]"
        >
          <option value="">Todos</option>
          {meses.map((m) => (
            <option key={m} value={m}>
              {rotuloMes(m)}
            </option>
          ))}
        </select>
      </label>
      {(empresa || ano || mes) && (
        <button
          onClick={onLimpar}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
        >
          ✕ limpar
        </button>
      )}
      <span className="self-center text-xs text-slate-400">
        {filtrado} de {total} lançamentos
      </span>

      <div className="ml-auto flex items-center gap-3">
        {importados > 0 && <span className="text-xs text-slate-400">{importados} importado(s)</span>}
        <label
          className={`rounded-lg border border-[var(--brand)] px-3 py-1.5 text-sm font-medium text-[var(--brand)] ${
            importando ? "cursor-wait opacity-60" : "cursor-pointer hover:bg-[var(--brand-soft)]"
          }`}
        >
          {importando ? "⌛ Lendo PDF…" : "⤒ Importar DARFs (PDF)"}
          <input
            type="file"
            accept="application/pdf,.pdf"
            multiple
            disabled={importando}
            className="hidden"
            onChange={(e) => {
              const fs = e.target.files ? [...e.target.files] : [];
              if (fs.length) onImportar(fs);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    </div>
  );
}
