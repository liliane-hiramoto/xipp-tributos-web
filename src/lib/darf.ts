// Camada de domínio dos DARFs: categorização de tributos, cálculo de atraso
// (vencimento × recolhimento) e agregações para os painéis.

import { DARFS, type DarfLinha } from "@/data/darfs";

// ---- Categoria (família) por código de tributo ----------------------------
const CATEGORIA_POR_CODIGO: Record<string, string> = {
  // IRRF / Imposto de Renda Retido na Fonte
  "0481": "IRRF",
  "8053": "IRRF",
  "3426": "IRRF",
  "0561": "IRRF",
  "1708": "IRRF",
  "8045": "IRRF",
  // Retenções PIS/COFINS/CSLL sobre pagamentos PJ→PJ
  "5952": "Retenção PCC",
  "5987": "Retenção PCC",
  // Contribuições previdenciárias (INSS) e terceiros
  "1082": "INSS / Previdenciária",
  "1099": "INSS / Previdenciária",
  "1138": "INSS / Previdenciária",
  "1646": "INSS / Previdenciária",
  "1170": "INSS / Previdenciária",
  "1176": "INSS / Previdenciária",
  // IRPJ
  "2362": "IRPJ",
  "5993": "IRPJ",
  // CSLL
  "2484": "CSLL",
  // PIS / COFINS
  "5856": "PIS/COFINS",
  "6912": "PIS/COFINS",
  // Parcelamentos (juros TJLP)
  "0387": "Parcelamento (TJLP)",
  "0389": "Parcelamento (TJLP)",
  "0391": "Parcelamento (TJLP)",
};

export function categoriaDe(codigo: string): string {
  return CATEGORIA_POR_CODIGO[codigo] ?? "Outros";
}

// Cor por categoria (usada em gráficos e selos).
export const COR_CATEGORIA: Record<string, string> = {
  IRRF: "#2563eb",
  "INSS / Previdenciária": "#0d9488",
  "PIS/COFINS": "#7c3aed",
  CSLL: "#db2777",
  IRPJ: "#ea580c",
  "Retenção PCC": "#0891b2",
  "Parcelamento (TJLP)": "#65758b",
  Outros: "#94a3b8",
};

export function corCategoria(cat: string): string {
  return COR_CATEGORIA[cat] ?? "#94a3b8";
}

// ---- Empresas (cadastro único: CNPJ -> apelido / razão social) -------------
export interface EmpresaReg {
  cnpj: string;
  apelido: string;
  nome: string;
  ativo?: boolean;
}

// Fallback local (offline / pré-migração). A fonte de verdade é o Cadastro Central
// (public.empresas do hub da instância), lido via lib/empresas.ts e injetado no
// DashboardShell. Este array só é usado quando o cadastro do hub está vazio ou
// indisponível — num clone de outra empresa (Flórida/RQ), edite ou esvazie aqui.
// Golden-source LIMPO: sem empresas embutidas. Cada instância (Affix, RQ, Flórida)
// provê as suas pelo cadastro central (public.empresas) do seu próprio hub.
export const EMPRESAS_PADRAO: EmpresaReg[] = [];

export function mapaEmpresas(empresas: EmpresaReg[]): Record<string, EmpresaReg> {
  return Object.fromEntries(empresas.map((e) => [e.cnpj, e]));
}

const MAPA_PADRAO = mapaEmpresas(EMPRESAS_PADRAO);

/** Apelido da empresa (fallback: razão social, depois "CNPJ x"). */
export function apelidoDe(cnpj: string, mapa: Record<string, EmpresaReg> = MAPA_PADRAO): string {
  const e = mapa[cnpj];
  return e?.apelido || e?.nome || `CNPJ ${cnpj || "—"}`;
}

/** Razão social da empresa (para cabeçalhos). */
export function empresaNome(cnpj: string, mapa: Record<string, EmpresaReg> = MAPA_PADRAO): string {
  const e = mapa[cnpj];
  return e?.nome || `CNPJ ${cnpj || "—"}`;
}

// ---- Linha enriquecida ------------------------------------------------------
export interface DarfRow extends DarfLinha {
  empresa: string;
  categoria: string;
  diasAtraso: number | null; // recolhimento − vencimento; null se faltar data
  encargos: number; // multa + juros
  // Dois sinais independentes (não confundir):
  //  - emAtraso: recolhimento posterior ao vencimento (status pedido, por data).
  //  - comEncargos: pagou multa e/ou juros. A Receita só cobra encargos em atraso,
  //    mas a "Data de Vencimento" do comprovante nem sempre traz o prazo legal, então
  //    há linhas com encargos sem diferença de data.
  emAtraso: boolean;
  comEncargos: boolean;
  situacaoAtraso: string; // "no prazo" | "Nd" | "c/ acréscimos"
  mesRecolhimento: string | null; // "AAAA-MM" — regime CAIXA (data de pagamento)
  mesCompetencia: string | null; // "AAAA-MM" — regime COMPETÊNCIA (apuração; vencimento como proxy quando ausente)
  mesVencimento: string | null;
}

// Regime de análise: caixa (data de recolhimento) ou competência (apuração).
export type Regime = "caixa" | "competencia";

/** Mês (AAAA-MM) da linha segundo o regime escolhido. */
export function mesDe(r: DarfRow, regime: Regime): string | null {
  return regime === "competencia" ? r.mesCompetencia : r.mesRecolhimento;
}

function diffDias(aIso: string | null, bIso: string | null): number | null {
  if (!aIso || !bIso) return null;
  const a = new Date(aIso + "T00:00:00");
  const b = new Date(bIso + "T00:00:00");
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

function enrichOne(d: DarfLinha, mapa: Record<string, EmpresaReg>): DarfRow {
  const diasAtraso = diffDias(d.recolhimento, d.vencimento);
  const encargos = Math.round((d.multa + d.juros) * 100) / 100;
  const emAtraso = diasAtraso != null && diasAtraso > 0;
  const comEncargos = encargos > 0;
  const situacaoAtraso = emAtraso ? `${diasAtraso}d` : comEncargos ? "c/ acréscimos" : "no prazo";
  return {
    ...d,
    empresa: apelidoDe(d.cnpj, mapa),
    categoria: categoriaDe(d.codigo),
    diasAtraso,
    encargos,
    emAtraso,
    comEncargos,
    situacaoAtraso,
    mesRecolhimento: d.recolhimento ? d.recolhimento.slice(0, 7) : null,
    mesCompetencia: (() => {
      const comp = d.periodoApuracao ?? d.vencimento;
      return comp ? comp.slice(0, 7) : null;
    })(),
    mesVencimento: d.vencimento ? d.vencimento.slice(0, 7) : null,
  };
}

/**
 * Dedup (mesmo doc+código+valores) + enriquecimento. Usado com a base e imports.
 * `mapa` = Cadastro Central de Empresas (public.empresas do hub da instância);
 * default = MAPA_PADRAO (fallback local embutido). Assim o mesmo código roda em
 * qualquer instância — cada uma injeta o mapa do seu hub via DashboardShell.
 */
export function buildRows(raw: DarfLinha[], mapa: Record<string, EmpresaReg> = MAPA_PADRAO): DarfRow[] {
  const seen = new Set<string>();
  const out: DarfLinha[] = [];
  for (const d of raw) {
    const k = `${d.numeroDocumento}|${d.codigo}|${d.principal}|${d.multa}|${d.juros}|${d.total}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(d);
  }
  return out.map((d, i) => enrichOne({ ...d, id: i + 1 }, mapa));
}

export const ROWS: DarfRow[] = buildRows(DARFS);

export function empresasDisponiveis(rows: DarfRow[]): { cnpj: string; nome: string }[] {
  const m = new Map<string, string>();
  for (const r of rows) if (!m.has(r.cnpj)) m.set(r.cnpj, r.empresa);
  return [...m.entries()].map(([cnpj, nome]) => ({ cnpj, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
}

// ---- Agregações -------------------------------------------------------------
export interface Resumo {
  qtdLinhas: number;
  qtdDarfs: number; // documentos distintos
  totalRecolhido: number;
  totalPrincipal: number;
  totalMulta: number;
  totalJuros: number;
  totalEncargos: number;
  qtdEmAtraso: number; // linhas com recolhimento > vencimento (por data)
  totalEmAtraso: number; // soma do total das linhas pagas em atraso (por data)
  qtdComEncargos: number; // linhas que pagaram multa e/ou juros
  pctNoPrazo: number; // 0..1 — recolhimento ≤ vencimento
}

export function resumir(rows: DarfRow[]): Resumo {
  const docs = new Set(rows.map((r) => r.numeroDocumento));
  let totalRecolhido = 0,
    totalPrincipal = 0,
    totalMulta = 0,
    totalJuros = 0,
    qtdEmAtraso = 0,
    totalEmAtraso = 0,
    qtdComEncargos = 0;
  for (const r of rows) {
    totalRecolhido += r.total;
    totalPrincipal += r.principal;
    totalMulta += r.multa;
    totalJuros += r.juros;
    if (r.emAtraso) {
      qtdEmAtraso++;
      totalEmAtraso += r.total;
    }
    if (r.comEncargos) qtdComEncargos++;
  }
  return {
    qtdLinhas: rows.length,
    qtdDarfs: docs.size,
    totalRecolhido,
    totalPrincipal,
    totalMulta,
    totalJuros,
    totalEncargos: totalMulta + totalJuros,
    qtdEmAtraso,
    totalEmAtraso,
    qtdComEncargos,
    pctNoPrazo: rows.length ? (rows.length - qtdEmAtraso) / rows.length : 1,
  };
}

export interface GrupoAgg {
  chave: string;
  rotulo: string;
  qtd: number;
  total: number;
  encargos: number;
  emAtraso: number;
}

export function agruparPorCategoria(rows: DarfRow[]): GrupoAgg[] {
  return agrupar(rows, (r) => r.categoria, (r) => r.categoria);
}

export function agruparPorCodigo(rows: DarfRow[]): GrupoAgg[] {
  return agrupar(
    rows,
    (r) => r.codigo,
    (r) => `${r.codigo} · ${r.tributo}`
  );
}

export function agruparPorMes(rows: DarfRow[], regime: Regime = "caixa"): GrupoAgg[] {
  return agrupar(
    rows.filter((r) => mesDe(r, regime)),
    (r) => mesDe(r, regime)!,
    (r) => mesDe(r, regime)!
  ).sort((a, b) => a.chave.localeCompare(b.chave));
}

function agrupar(
  rows: DarfRow[],
  chaveFn: (r: DarfRow) => string,
  rotuloFn: (r: DarfRow) => string
): GrupoAgg[] {
  const map = new Map<string, GrupoAgg>();
  for (const r of rows) {
    const k = chaveFn(r);
    let g = map.get(k);
    if (!g) {
      g = { chave: k, rotulo: rotuloFn(r), qtd: 0, total: 0, encargos: 0, emAtraso: 0 };
      map.set(k, g);
    }
    g.qtd++;
    g.total += r.total;
    g.encargos += r.encargos;
    if (r.emAtraso) g.emAtraso++;
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

// "AAAA-MM" -> "mmm/aa" (ex.: 2026-01 -> jan/26)
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export function rotuloMes(ym: string): string {
  const [y, m] = ym.split("-");
  return `${MESES[Number(m) - 1]}/${y.slice(2)}`;
}

// ---- Filtro de período global (por data de recolhimento) --------------------
export function anosDisponiveis(): string[] {
  return [...new Set(ROWS.map((r) => r.mesRecolhimento?.slice(0, 4)).filter(Boolean) as string[])].sort();
}

export function mesesDisponiveis(ano?: string): string[] {
  return [
    ...new Set(
      ROWS.map((r) => r.mesRecolhimento).filter(
        (m): m is string => !!m && (!ano || m.slice(0, 4) === ano)
      )
    ),
  ].sort();
}

/** Filtra por ano (AAAA) e/ou mês (AAAA-MM), no regime escolhido. Mês tem precedência. */
export function filtrarPeriodo(
  rows: DarfRow[],
  ano: string,
  mes: string,
  regime: Regime = "caixa"
): DarfRow[] {
  if (!ano && !mes) return rows;
  return rows.filter((r) => {
    const m = mesDe(r, regime);
    if (!m) return false;
    if (mes) return m === mes;
    return m.slice(0, 4) === ano;
  });
}

// ---- Auditoria: potenciais duplicidades -------------------------------------
// Mesma empresa (base única), mesmo código de tributo, mesma competência e mesmo
// valor, com 2+ lançamentos — recolhidos no mesmo dia ou em dias diferentes.
// A competência usa o período de apuração; quando ele vem em branco (DARFs de
// estimativa com placeholder), usa-se o vencimento como proxy — assim estimativas
// de meses distintos NÃO são marcadas como duplicidade.
export interface GrupoDup {
  cnpj: string;
  empresa: string;
  codigo: string;
  tributo: string;
  categoria: string;
  competencia: string | null; // período de apuração (ISO) ou null
  vencimento: string | null; // vencimento (entra na chave — separa cotas)
  usouVencimento: boolean; // true = competência inferida pelo vencimento
  valor: number; // valor base (principal; ou total quando principal = 0)
  qtd: number;
  mesmoDia: boolean; // todos recolhidos na mesma data
  linhas: DarfRow[]; // ordenadas por recolhimento
  totalGrupo: number; // soma dos totais do grupo
  potencial: number; // soma dos totais excedentes (todos menos o 1º recolhido)
}

export function duplicidades(rows: DarfRow[]): GrupoDup[] {
  const map = new Map<string, DarfRow[]>();
  for (const r of rows) {
    const valorRef = r.principal > 0 ? r.principal : r.total;
    if (valorRef <= 0) continue;
    const comp = r.periodoApuracao ?? r.vencimento ?? "n/d";
    // O vencimento entra na chave: IRPJ/CSLL do presumido pode ser pago em COTAS
    // (mesma competência e valor, vencimentos diferentes) — não é duplicidade.
    const venc = r.vencimento ?? "n/d";
    const key = `${r.cnpj}|${r.codigo}|${comp}|${venc}|${valorRef.toFixed(2)}`;
    const arr = map.get(key);
    if (arr) arr.push(r);
    else map.set(key, [r]);
  }
  const grupos: GrupoDup[] = [];
  for (const ls of map.values()) {
    if (ls.length < 2) continue;
    const ordered = [...ls].sort((a, b) =>
      (a.recolhimento ?? "").localeCompare(b.recolhimento ?? "")
    );
    const datas = new Set(ordered.map((l) => l.recolhimento));
    const base = ordered[0];
    const totalGrupo = ordered.reduce((s, l) => s + l.total, 0);
    grupos.push({
      cnpj: base.cnpj,
      empresa: base.empresa,
      codigo: base.codigo,
      tributo: base.tributo,
      categoria: base.categoria,
      competencia: base.periodoApuracao,
      vencimento: base.vencimento,
      usouVencimento: !base.periodoApuracao,
      valor: base.principal > 0 ? base.principal : base.total,
      qtd: ordered.length,
      mesmoDia: datas.size === 1,
      linhas: ordered,
      totalGrupo,
      potencial: totalGrupo - base.total,
    });
  }
  return grupos.sort((a, b) => b.potencial - a.potencial || b.qtd - a.qtd);
}
