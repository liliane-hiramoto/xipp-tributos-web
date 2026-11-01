"use client";

// Caixa de perguntas da página Insights. O servidor (/api/perguntar) lê do banco a
// Situação Fiscal, certidões e parcelamentos; os DARFs vão daqui, exatamente os
// que estão na tela (filtro de empresa/período do topo). Só responde com base
// nesses dados.
import { useMemo, useState } from "react";
import { Card } from "@/components/ui";
import type { DarfRow } from "@/lib/darf";

// Limite de DARFs por pergunta: acima disso, pede p/ filtrar (nunca corta em silêncio).
const MAX_DARFS = 5000;
const COLUNAS_DARF = ["empresa", "cnpj", "codigo", "tributo", "periodoApuracao", "vencimento", "recolhimento", "principal", "multa", "juros", "total", "diasAtraso", "situacaoAtraso"] as const;

type Troca = { pergunta: string; resposta: string; erro?: boolean };

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

const SUGESTOES = [
  "Quanto foi pago de multa e juros em DARFs no período, por empresa?",
  "Quais empresas têm tributos retidos não recolhidos e qual o valor?",
  "Quais inscrições estão ajuizadas e em quais processos?",
  "Qual a situação dos parcelamentos e quantas parcelas foram pagas?",
];

export default function FiscalPerguntas({ cnpj, escopo, darfs = [] }: { cnpj: string; escopo: string; darfs?: DarfRow[] }) {
  const muitos = darfs.length > MAX_DARFS;
  const darfsPayload = useMemo(
    () => (muitos ? null : { colunas: COLUNAS_DARF, linhas: darfs.map((r) => COLUNAS_DARF.map((c) => r[c] ?? null)) }),
    [darfs, muitos]
  );
  const [pergunta, setPergunta] = useState("");
  const [trocas, setTrocas] = useState<Troca[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [aberto, setAberto] = useState(false);

  // Histórico só vale dentro do mesmo escopo (empresa + filtro de período).
  const [escopoAtual, setEscopoAtual] = useState(escopo);
  if (escopoAtual !== escopo) {
    setEscopoAtual(escopo);
    setTrocas([]);
  }

  async function enviar(texto: string) {
    const q = texto.trim();
    if (!q || carregando) return;
    if (muitos) {
      setTrocas((t) => [...t, { pergunta: q, resposta: `Há ${darfs.length} DARFs no filtro atual (limite ${MAX_DARFS}). Filtre por empresa ou período no topo e pergunte de novo.`, erro: true }]);
      return;
    }
    setCarregando(true);
    setPergunta("");
    try {
      const r = await fetch(`${BASE}/api/perguntar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pergunta: q, cnpj, escopo, darfs: darfsPayload, historico: trocas.filter((t) => !t.erro).slice(-4) }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.erro) setTrocas((t) => [...t, { pergunta: q, resposta: j.erro || `Erro ${r.status}.`, erro: true }]);
      else
        setTrocas((t) => [
          ...t,
          { pergunta: q, resposta: j.truncada ? `${j.resposta}\n\n(resposta cortada por tamanho — refine a pergunta)` : j.resposta },
        ]);
    } catch {
      setTrocas((t) => [...t, { pergunta: q, resposta: "Falha de conexão.", erro: true }]);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <Card className="p-0">
      <button className="flex w-full items-center gap-2 px-5 py-3 text-left" onClick={() => setAberto(!aberto)}>
        <span className="text-sm font-semibold uppercase tracking-wide text-slate-600">Pergunte sobre os dados</span>
        <span className="text-xs text-slate-400">· {escopo}</span>
        <span className="ml-auto text-slate-400">{aberto ? "▾" : "▸"}</span>
      </button>
      {aberto && (
        <div className="space-y-3 border-t border-slate-100 px-5 py-4">
          <p className="text-[11px] text-slate-400">
            As respostas usam somente os dados importados do escopo selecionado no topo: DARFs pagos ({darfs.length} no filtro), Situação
            Fiscal, certidões e parcelamentos. O que não constar nos dados é informado como &quot;não consta&quot;. Confira os números nas
            telas antes de decidir.
          </p>

          {trocas.length === 0 && (
            <div className="flex flex-wrap gap-1.5">
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  onClick={() => enviar(s)}
                  disabled={carregando}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {trocas.map((t, i) => (
            <div key={i} className="space-y-1">
              <div className="text-sm font-medium text-slate-800">{t.pergunta}</div>
              <div className={`whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${t.erro ? "bg-red-50 text-red-700" : "bg-slate-50 text-slate-700"}`}>{t.resposta}</div>
            </div>
          ))}
          {carregando && <div className="text-xs text-slate-400">Consultando os dados…</div>}

          <form
            className="flex gap-2"
            onSubmit={(ev) => {
              ev.preventDefault();
              enviar(pergunta);
            }}
          >
            <input
              value={pergunta}
              onChange={(ev) => setPergunta(ev.target.value)}
              maxLength={2000}
              placeholder="Ex.: qual o consolidado de IRRF da HDS?"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
            />
            <button
              type="submit"
              disabled={carregando || !pergunta.trim()}
              className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Perguntar
            </button>
          </form>
        </div>
      )}
    </Card>
  );
}
