"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PAGE_LABELS } from "@/lib/nav";
import { DARFS, type DarfLinha } from "@/data/darfs";
import {
  buildRows,
  filtrarPeriodo,
  empresaNome,
  mapaEmpresas,
  mesDe,
  EMPRESAS_PADRAO,
  type EmpresaReg,
  type Regime,
} from "@/lib/darf";
import { fetchEmpresas } from "@/lib/empresas";
import { importarPdfs } from "@/lib/importPdf";
import { importarDocumentos } from "@/lib/importDocs";
import { fetchAtuaisEAnteriores, fetchEvolucao, salvarSnapshots, type PontoEvolucao } from "@/lib/dbFiscal";
import { fetchParcelamentos, salvarParcelamentos } from "@/lib/dbParcelamentos";
import { arquivarDocumentos, fetchDocumentos, type Documento } from "@/lib/dbDocumentos";
import Documentos from "@/modules/Documentos";
import type { Parcelamento } from "@/data/parcelamentos";
import { fetchCertidoes, salvarCertidoes } from "@/lib/dbCertidoes";
import { uploadPdf } from "@/lib/dbDup";
import type { FiscalEmpresa } from "@/data/fiscal-tipos";
import type { Certidao } from "@/data/certidoes";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import Overview from "@/modules/Overview";
import Atrasos from "@/modules/Atrasos";
import Tabela from "@/modules/Tabela";
import PorTributo from "@/modules/PorTributo";
import PorPeriodo from "@/modules/PorPeriodo";
import Duplicidades from "@/modules/Duplicidades";
import FiscalSituacao from "@/modules/FiscalSituacao";
import FiscalParcelamentos from "@/modules/FiscalParcelamentos";
import FiscalPerguntas from "@/modules/FiscalPerguntas";
import FiscalInsights from "@/modules/FiscalInsights";
import { gerarInsights } from "@/lib/insights";

const IMPORT_KEY = "trib_darf_importados";
const IDLE_MS = 15 * 60 * 1000; // encerra a sessão após 15 min de inatividade

export default function DashboardShell({
  userEmail,
  userNome,
  isAdmin = false,
  dbDarfs,
}: {
  userEmail?: string;
  userNome?: string;
  isAdmin?: boolean;
  dbDarfs?: DarfLinha[];
} = {}) {
  const router = useRouter();
  const autenticado = !!userEmail;
  const bancoTemDados = !!dbDarfs && dbDarfs.length > 0;
  const [page, setPage] = useState("overview");
  const [empresa, setEmpresa] = useState("");
  const [ano, setAno] = useState("");
  const [mes, setMes] = useState("");
  const [regime, setRegime] = useState<Regime>("caixa");
  const [importados, setImportados] = useState<DarfLinha[]>([]);
  const [salvandoBanco, setSalvandoBanco] = useState(false);
  // Cadastro Central de Empresas (public.empresas do hub desta instância).
  const [empresasCad, setEmpresasCad] = useState<EmpresaReg[]>([]);
  // Situação Fiscal (snapshots do e-CAC): atual + anterior por CNPJ (p/ divergências).
  const [fiscais, setFiscais] = useState<FiscalEmpresa[]>([]);
  const [fiscalPrev, setFiscalPrev] = useState<Record<string, FiscalEmpresa>>({});
  const [evolucao, setEvolucao] = useState<PontoEvolucao[]>([]);
  const [parcelamentos, setParcelamentos] = useState<Parcelamento[]>([]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [docsCarregados, setDocsCarregados] = useState(false);
  const [certidoes, setCertidoes] = useState<Certidao[]>([]);
  const [certidoesPrev, setCertidoesPrev] = useState<Record<string, Certidao>>({});
  const [importandoFiscal, setImportandoFiscal] = useState(false);

  const logout = useCallback(
    async (motivo?: "inatividade") => {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push(motivo === "inatividade" ? "/login?expirado=1" : "/login");
      router.refresh();
    },
    [router]
  );

  // Auto-logout por inatividade (só quando autenticado).
  useEffect(() => {
    if (!autenticado) return;
    let timer: ReturnType<typeof setTimeout>;
    const reiniciar = () => {
      clearTimeout(timer);
      timer = setTimeout(() => logout("inatividade"), IDLE_MS);
    };
    const eventos = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];
    eventos.forEach((e) => window.addEventListener(e, reiniciar, { passive: true }));
    reiniciar();
    return () => {
      clearTimeout(timer);
      eventos.forEach((e) => window.removeEventListener(e, reiniciar));
    };
  }, [autenticado, logout]);

  // No modo aberto (sem login) mantém importados no navegador; no modo
  // autenticado a fonte é o banco (localStorage não é usado).
  useEffect(() => {
    if (autenticado) return;
    try {
      const s = localStorage.getItem(IMPORT_KEY);
      if (s) setImportados(JSON.parse(s));
    } catch {
      /* ignore */
    }
  }, [autenticado]);

  // Carrega o Cadastro Central de Empresas do hub (só autenticado; RLS exige login).
  useEffect(() => {
    if (!autenticado) return;
    let vivo = true;
    (async () => {
      const lista = await fetchEmpresas(createClient());
      if (vivo) setEmpresasCad(lista);
    })();
    return () => {
      vivo = false;
    };
  }, [autenticado]);

  const recarregarDocs = useCallback(async () => {
    const sb = createClient();
    try {
      const { atuais, anteriorPorCnpj } = await fetchAtuaisEAnteriores(sb);
      setFiscais(atuais);
      setFiscalPrev(anteriorPorCnpj);
    } catch {
      /* tabela ausente / sem acesso → degrada vazio */
    }
    try {
      setEvolucao(await fetchEvolucao(sb));
    } catch {
      /* idem */
    }
    try {
      setParcelamentos(await fetchParcelamentos(sb));
    } catch {
      /* tabela trib_parcelamentos ainda não criada (migração 0009) → vazio */
    }
    try {
      setDocumentos(await fetchDocumentos(sb));
    } catch {
      /* tabela trib_documentos ainda não criada (migração 0010) → vazio */
    }
    setDocsCarregados(true);
    try {
      const { atuais, anteriorPorChave } = await fetchCertidoes(sb);
      setCertidoes(atuais);
      setCertidoesPrev(anteriorPorChave);
    } catch {
      /* idem */
    }
  }, []);

  // Carrega Situação Fiscal + certidões (snapshots) do hub.
  useEffect(() => {
    if (!autenticado) return;
    recarregarDocs();
  }, [autenticado, recarregarDocs]);

  // Import único: aceita Situação Fiscal + CNDT + CND FGTS e roteia por tipo.
  async function handleImportDocs(files: File[]) {
    if (!files.length) return;
    setImportandoFiscal(true);
    try {
      const res = await importarDocumentos(files);
      if (!res.fiscais.length && !res.certidoes.length && !res.parcelamentos.length) {
        alert(
          res.escaneados
            ? `${res.escaneados} PDF(s) são imagem (sem texto) — precisam de OCR.`
            : "Nenhum documento reconhecido (Situação Fiscal, CNDT, CND FGTS ou pedido de parcelamento do e-CAC)."
        );
        return;
      }
      const sb = createClient();
      const rf = res.fiscais.length ? await salvarSnapshots(sb, res.fiscais) : { inseridos: 0, duplicados: 0 };
      const rc = res.certidoes.length ? await salvarCertidoes(sb, res.certidoes) : { inseridos: 0, duplicados: 0 };
      const rp = res.parcelamentos.length ? await salvarParcelamentos(sb, res.parcelamentos) : { novos: 0, atualizados: 0 };
      // PDFs originais no repositório de documentos (não bloqueia a importação dos dados).
      const ra = res.arquivos.length ? await arquivarDocumentos(sb, res.arquivos) : { guardados: 0, existentes: 0, falhas: 0 };
      await recarregarDocs();
      const partes: string[] = [];
      if (res.fiscais.length) partes.push(`Situação Fiscal: ${res.fiscais.length} lido(s), ${rf.inseridos} novo(s) no histórico${rf.duplicados ? `, ${rf.duplicados} idêntico(s) (data da consulta atualizada)` : ""}.`);
      if (res.certidoes.length) partes.push(`Certidões (CNDT/FGTS): ${res.certidoes.length} lida(s), ${rc.inseridos} novo(s) no histórico${rc.duplicados ? `, ${rc.duplicados} idêntica(s)` : ""}.`);
      if (res.parcelamentos.length) partes.push(`Parcelamentos: ${res.parcelamentos.length} pedido(s) lido(s), ${rp.novos} novo(s), ${rp.atualizados} atualizado(s).`);
      if (res.arquivos.length)
        partes.push(
          `Repositório de documentos: ${ra.guardados} PDF(s) guardado(s)${ra.existentes ? `, ${ra.existentes} já existia(m)` : ""}${ra.falhas ? `, ${ra.falhas} falha(s) ao guardar (verifique a migração 0010)` : ""}.`
        );
      if (res.rejeitados) partes.push(`${res.rejeitados} arquivo(s) ignorado(s) (tipo não reconhecido).`);
      alert(partes.join("\n"));
    } catch (e) {
      alert("Falha ao importar: " + (e as Error).message);
    } finally {
      setImportandoFiscal(false);
    }
  }

  // Fonte dos DARFs: autenticado = SOMENTE o banco (vazio = vazio, sem fallback
  // para os embutidos); modo aberto = dados embutidos + importados locais.
  // Cadastro efetivo: o do hub quando houver; senão o fallback local embutido.
  const cadastro = empresasCad.length ? empresasCad : EMPRESAS_PADRAO;
  const mapa = useMemo(() => mapaEmpresas(cadastro), [cadastro]);

  // Snapshots fiscais com apelido resolvido pelo Cadastro Central (fallback: razão).
  const fiscaisView = useMemo(() => {
    const byDig = new Map(cadastro.map((e) => [e.cnpj.replace(/\D/g, ""), e]));
    return fiscais.map((f) => ({ ...f, apelido: byDig.get(f.cnpj.replace(/\D/g, ""))?.apelido || f.apelido || f.razaoSocial }));
  }, [fiscais, cadastro]);

  // Página Insights: seguem a empresa selecionada no topo.
  const insightsVisao = useMemo(() => {
    const d = empresa.replace(/\D/g, "");
    const so = <T extends { cnpj: string }>(xs: T[]) => (d ? xs.filter((x) => x.cnpj.replace(/\D/g, "") === d) : xs);
    return gerarInsights(so(fiscaisView), so(parcelamentos));
  }, [fiscaisView, parcelamentos, empresa]);

  const allRows = useMemo(() => {
    const fonte = autenticado ? dbDarfs ?? [] : [...DARFS, ...importados];
    return buildRows(fonte, mapa);
  }, [autenticado, dbDarfs, importados, mapa]);
  // Cadastro único: o seletor lista todas as empresas do grupo (têm DARF ou não).
  const empresas = useMemo(
    () => cadastro.map((e) => ({ cnpj: e.cnpj, nome: e.apelido })),
    [cadastro]
  );

  // Grava (com dedup) linhas no banco e recarrega os dados do servidor.
  const gravarNoBanco = useCallback(
    async (linhas: DarfLinha[]) => {
      const { salvarDarfs } = await import("@/lib/dbDarfs");
      const supabase = createClient();
      const res = await salvarDarfs(supabase, linhas);
      if (res.inseridos > 0) router.refresh();
      return res;
    },
    [router]
  );

  async function limparBanco() {
    if (!confirm("Apagar TODOS os DARFs do banco para recomeçar do zero? Esta ação não pode ser desfeita.")) return;
    setSalvandoBanco(true);
    try {
      const { limparDarfs } = await import("@/lib/dbDarfs");
      const n = await limparDarfs(createClient());
      router.refresh();
      alert(`${n} lançamento(s) apagados. Banco zerado — pode iniciar as importações do zero.`);
    } catch (e) {
      alert("Não foi possível limpar o banco: " + (e as Error).message);
    } finally {
      setSalvandoBanco(false);
    }
  }

  const baseRows = useMemo(
    () => (empresa ? allRows.filter((r) => r.cnpj === empresa) : allRows),
    [allRows, empresa]
  );
  const anos = useMemo(
    () => [...new Set(baseRows.map((r) => mesDe(r, regime)?.slice(0, 4)).filter(Boolean) as string[])].sort(),
    [baseRows, regime]
  );
  const meses = useMemo(
    () =>
      [
        ...new Set(
          baseRows
            .map((r) => mesDe(r, regime))
            .filter((m): m is string => !!m && (!ano || m.slice(0, 4) === ano))
        ),
      ].sort(),
    [baseRows, ano, regime]
  );
  const rows = useMemo(
    () => filtrarPeriodo(baseRows, ano, mes, regime),
    [baseRows, ano, mes, regime]
  );

  const [importando, setImportando] = useState(false);
  async function handleImport(files: File[]) {
    if (!files.length) return;
    setImportando(true);
    // Processa arquivo a arquivo para vincular cada DARF ao seu PDF de origem
    // (Storage). Autenticado: sobe o PDF e guarda o path; modo aberto: só lê.
    const todas: DarfLinha[] = [];
    let escaneados = 0;
    let rejeitados = 0;
    const sb = autenticado ? createClient() : null;
    try {
      for (const f of files) {
        let r;
        try {
          r = await importarPdfs([f]);
        } catch {
          rejeitados++;
          continue;
        }
        escaneados += r.escaneados;
        rejeitados += r.rejeitados;
        if (r.linhas.length && sb) {
          const path = await uploadPdf(sb, f).catch(() => null);
          if (path) for (const l of r.linhas) l.arquivoPath = path;
        }
        todas.push(...r.linhas);
      }
    } finally {
      setImportando(false);
    }
    const res = { linhas: todas, escaneados, rejeitados };

    let salvos = { inseridos: res.linhas.length, jaNoBanco: 0, noArquivo: 0 };
    if (res.linhas.length) {
      if (autenticado) {
        try {
          salvos = await gravarNoBanco(res.linhas); // grava no banco (dedup por documento)
        } catch (e) {
          alert("Lidos do PDF, mas falha ao salvar no banco: " + (e as Error).message);
          return;
        }
      } else {
        const novos = [...importados, ...res.linhas];
        setImportados(novos);
        try {
          localStorage.setItem(IMPORT_KEY, JSON.stringify(novos));
        } catch {
          /* ignore */
        }
      }
    }

    let msg =
      res.linhas.length > 0
        ? autenticado
          ? `${salvos.inseridos} novo(s) lançamento(s) salvos no banco.`
          : `${res.linhas.length} lançamento(s) importado(s) de comprovante(s) PDF.`
        : "Nenhum comprovante de arrecadação (DARF) encontrado nos arquivos.";
    if (salvos.jaNoBanco)
      msg += `\n${salvos.jaNoBanco} já estavam no banco (não importados novamente).`;
    if (salvos.noArquivo)
      msg += `\n${salvos.noArquivo} repetido(s) dentro do próprio arquivo (mesmo código e valores, sem nº de documento) — não importados.`;
    if (res.escaneados)
      msg += `\n\n${res.escaneados} PDF(s) são imagem digitalizada (sem texto) e precisam de OCR — envie esses para processamento.`;
    if (res.rejeitados)
      msg += `\n\n${res.rejeitados} arquivo(s) ignorado(s) por não serem Comprovante de Arrecadação (DARF).`;
    if (res.linhas.length) msg += '\n\n⚠️ Confira os valores importados na aba "Todos os DARFs".';
    alert(msg);
  }

  // Cabeçalho: empresa selecionada, ou única, ou "Todas".
  const header =
    empresa
      ? { nome: empresaNome(empresa, mapa), sub: `CNPJ ${empresa}` }
      : empresas.length === 1
      ? { nome: empresas[0].nome, sub: `CNPJ ${empresas[0].cnpj}` }
      : { nome: "Todas as empresas", sub: `${empresas.length} CNPJs` };

  return (
    <div className="flex h-screen">
      <Sidebar current={page} onNavigate={setPage} isAdmin={isAdmin} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <h1 className="text-lg font-semibold text-slate-900">{PAGE_LABELS[page] ?? "—"}</h1>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm font-medium text-slate-700">{header.nome}</div>
              <div className="text-xs text-slate-400">{header.sub}</div>
            </div>
            {autenticado && (
              <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
                <div className="text-right">
                  <div className="text-xs font-medium text-slate-600">{userNome}</div>
                  <div className="text-[11px] text-slate-400">
                    {userEmail}
                    {isAdmin && <span className="ml-1 text-[var(--brand)]">· admin</span>}
                  </div>
                </div>
                <button
                  onClick={() => logout()}
                  title="Encerrar sessão"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                >
                  ⎋ Sair
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          {autenticado && isAdmin && bancoTemDados && !page.startsWith("fiscal_") && (
            <div className="mb-4 flex justify-end">
              <button
                onClick={limparBanco}
                disabled={salvandoBanco}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
                title="Apaga todos os DARFs do banco"
              >
                {salvandoBanco ? "Processando…" : "🗑 Limpar dados do banco"}
              </button>
            </div>
          )}
          {!page.startsWith("fiscal_") && (
            <div className="mb-6">
              <TopBar
                empresas={empresas}
                empresa={empresa}
                ano={ano}
                mes={mes}
                anos={anos}
                meses={meses}
                regime={regime}
                total={allRows.length}
                filtrado={page === "duplicidades" ? baseRows.length : rows.length}
                importados={importados.length}
                importando={importando}
                onEmpresa={setEmpresa}
                onPeriodo={(a, m) => {
                  setAno(a);
                  setMes(m);
                }}
                onRegime={(r) => {
                  setRegime(r);
                  setMes(""); // o mês selecionado pode não existir no outro regime
                }}
                onLimpar={() => {
                  setEmpresa("");
                  setAno("");
                  setMes("");
                }}
                onImportar={handleImport}
              />
            </div>
          )}

          {page === "insights" ? (
            <div className="space-y-6">
              {insightsVisao.length ? (
                <FiscalInsights insights={insightsVisao} mostrarEmpresa={!empresa} />
              ) : (
                <p className="rounded-xl border border-slate-200 bg-white px-5 py-6 text-sm text-slate-500">
                  Nenhum insight para o filtro atual. Os insights são gerados a partir da Situação Fiscal e dos parcelamentos importados.
                </p>
              )}
              {autenticado ? (
                <FiscalPerguntas
                  cnpj={empresa}
                  darfs={rows}
                  escopo={[
                    empresa ? empresas.find((e) => e.cnpj === empresa)?.nome || empresa : "Todas as empresas",
                    mes ? `mês ${mes.split("-").reverse().join("/")}` : ano ? `ano ${ano}` : "todo o período",
                    regime === "caixa" ? "regime caixa" : "regime competência",
                  ].join(" · ")}
                />
              ) : null}
            </div>
          ) : page === "overview" ? (
            <Overview rows={rows} regime={regime} />
          ) : page === "atrasos" ? (
            <Atrasos rows={rows} />
          ) : page === "tabela" ? (
            <Tabela rows={rows} />
          ) : page === "por_tributo" ? (
            <PorTributo rows={rows} />
          ) : page === "por_periodo" ? (
            <PorPeriodo rows={rows} regime={regime} />
          ) : page === "duplicidades" ? (
            <Duplicidades rows={baseRows} />
          ) : page === "fiscal_situacao" ? (
            <FiscalSituacao
              fiscais={fiscaisView}
              anteriorPorCnpj={fiscalPrev}
              evolucao={evolucao}
              certidoes={certidoes}
              certidoesPrev={certidoesPrev}
              onImportar={handleImportDocs}
              importando={importandoFiscal}
              canEdit={isAdmin}
            />
          ) : page === "fiscal_documentos" ? (
            <Documentos documentos={documentos} darfs={allRows} empresas={empresas} carregado={docsCarregados || !autenticado} />
          ) : page === "fiscal_parcelamentos" ? (
            <FiscalParcelamentos
              parcelamentos={parcelamentos}
              fiscais={fiscaisView}
              onImportar={handleImportDocs}
              importando={importandoFiscal}
              canEdit={isAdmin}
            />
          ) : (
            <Overview rows={rows} regime={regime} />
          )}
        </main>
      </div>
    </div>
  );
}
