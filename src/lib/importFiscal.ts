// Parser dos relatórios de "Situação Fiscal" do e-CAC (RFB + PGFN, PDF com texto).
// Lê TUDO: cadastro, sócios, certidão, débitos (SIEF, com multa/juros quando há),
// processos (+ processos de crédito), parcelamentos (SIEFPAR/SISPAR/PARCSN), omissões
// de declaração (DCTFWeb etc.), inscrições na dívida ativa (SIDA) e Sistema DIVIDA.
// Validado contra dezenas de relatórios reais.
// Extração em ordem natural (pdfText.ts); os documentos NÃO são gravados — só o parseado.
"use client";

import { lerPaginasNaturais } from "@/lib/pdfText";
import { totaisFiscais } from "@/lib/fiscal";
import type {
  FiscalEmpresa,
  FiscalCadastro,
  Socio,
  FiscalCertidao,
  FiscalDebito,
  FiscalProcesso,
  FiscalParcelamento,
  FiscalInscricao,
  FiscalDivida,
  FiscalOmissao,
} from "@/data/fiscal-tipos";

// Versão do leitor. Suba a cada mudança que altere o resultado do parse: só se
// compara (tags novo/baixado) relatórios lidos pela MESMA versão — um snapshot
// antigo, lido com bugs, geraria falsos "novo"/"baixado".
export const VERSAO_LEITOR = 2;

const VAL = "(?:\\d{1,3}(?:\\.\\d{3})*,\\d{2}|0,00)";

function num(s: string): number {
  const t = (s || "").trim();
  if (!t || t === "-") return 0;
  const n = parseFloat(t.replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}
function clean(s: string): string {
  return (s || "").replace(/\s*_{2,}[\s\S]*$/, "").replace(/\s*Final do Relatório[\s\S]*$/, "").trim();
}
// Corpo da seção: sem a régua "____" do título nem o que vier após a régua final.
function corpo(s: string): string {
  return clean((s || "").replace(/^\s*_+\s*/, ""));
}
function g1(t: string, re: RegExp): string {
  const m = t.match(re);
  return m ? m[1].trim() : "";
}

// Cada seção existe como "Pendência - X" e/ou "X com Exigibilidade Suspensa".
const SECOES: [string, RegExp][] = [
  ["dados", /Dados Cadastrais da Matriz/],
  ["socios", /Sócios e Administradores/],
  ["cert", /Certidão Emitida/],
  ["omissao", /Pendência - Omissão de [^_]+?(?=\s*_{2,}|\s+\()/],
  ["debito", /Pendência - Débito \(SIEF\)|Débito com Exigibilidade Suspensa \(SIEF\)/],
  ["processo", /Pendência - Processo Fiscal \(SIEF\)|Processo Fiscal com Exigibilidade Suspensa \(SIEF\)/],
  ["siefpar", /(?:Pendência - Parcelamento|Parcelamento com Exigibilidade Suspensa) \(SIEFPAR\)/],
  ["parcsn", /(?:Pendência - Parcelamento|Parcelamento com Exigibilidade Suspensa) \(PARCSN\/PARCMEI\)/],
  ["sida", /Pendência - Inscrição \(SIDA\)|Inscrição com Exigibilidade Suspensa \(SIDA\)/],
  ["sispar", /(?:Pendência - Parcelamento|Parcelamento com Exigibilidade Suspensa) \(SISPAR\)/],
  ["divida", /Pendência - Inscrição \(Sistema DIVIDA\)|Inscrição com Exigibilidade Suspensa \(Sistema DIVIDA\)/],
  ["fim", /Diagnóstico Fiscal na (?:Receita Federal|Procuradoria-Geral da Fazenda Nacional)|Final do Relatório/],
];

function escRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Uma sequência de páginas é um relatório de Situação Fiscal? */
export function ehRelatorioSituacaoFiscal(paginas: string[]): boolean {
  const t = paginas.join(" ");
  return /INFORMA[ÇC][ÕO]ES DE APOIO PARA EMISS[ÃA]O DE CERTID[ÃA]O/i.test(t) && /Dados Cadastrais da Matriz/i.test(t);
}

export function parseSituacaoFiscal(paginas: string[], arquivo: string): FiscalEmpresa {
  const full0 = paginas.join(" ");
  const hm = full0.match(/CNPJ:\s*(\d{2}\.\d{3}\.\d{3})\s*-\s*(.+?)\s+Dados Cadastrais/);
  const cnpjRaiz = hm ? hm[1] : "";
  const razaoSocial = hm ? hm[2].trim() : "";
  const dc = full0.match(/(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2})/);
  const dataConsulta = dc ? dc[1] : "";

  // Remove cabeçalho/rodapé repetidos de cada página e concatena o corpo. O
  // cabeçalho termina em "CNPJ: <raiz> - <razão>" (literal, igual em toda página):
  // removê-lo pelo texto exato evita comer as linhas de dados que vêm logo depois.
  const cabRazao = cnpjRaiz && razaoSocial ? new RegExp(`^\\s*CNPJ:\\s*${escRe(cnpjRaiz)}\\s*-\\s*${escRe(razaoSocial)}\\s*`) : null;
  const body = paginas
    .map((pg) => {
      let t = pg.replace(/^.*?INFORMA[ÇC][ÕO]ES DE APOIO PARA EMISS[ÃA]O DE CERTID[ÃA]O\s*/, "");
      if (cabRazao && cabRazao.test(t)) t = t.replace(cabRazao, "");
      else t = t.replace(/^\s*CNPJ:\s*\d{2}\.\d{3}\.\d{3}\s*-\s*[A-ZÀ-Ú0-9 .,&/-]+?(?=\s*(?:Dados Cadastrais|\d{4}-\d{2} -|Pendência|Inscrição|Parcelamento|Débito|Processo|Diagnóstico|Final|$))/, "");
      return t.replace(/Página:\s*\d+\s*\/\s*\d+/g, " ");
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  // Fatia por seções (na ordem em que aparecem).
  const hits: { key: string; start: number; end: number }[] = [];
  for (const [key, re] of SECOES) {
    const g = new RegExp(re.source, "g");
    let m: RegExpExecArray | null;
    while ((m = g.exec(body))) hits.push({ key, start: m.index, end: g.lastIndex });
  }
  hits.sort((a, b) => a.start - b.start);
  const segs = hits.map((h, i) => ({
    key: h.key,
    hdr: body.slice(h.start, h.end),
    txt: body.slice(h.end, i + 1 < hits.length ? hits[i + 1].start : body.length),
  }));

  const e: FiscalEmpresa = {
    cnpj: "",
    cnpjRaiz,
    razaoSocial,
    apelido: "",
    dataConsulta,
    arquivo,
    versaoLeitor: VERSAO_LEITOR,
    cadastro: {
      cnpj: "", ua: "", codigoUA: "", endereco: "", bairro: "", cep: "", municipio: "", uf: "",
      responsavel: "", situacao: "", natureza: "", abertura: "", cnae: "", porte: "", simples: [],
    },
    socios: [],
    certidao: { tipo: "", codigo: "", emissao: "", validade: "" },
    debitos: [],
    processos: [],
    parcelamentos: [],
    inscricoes: [],
    divida: [],
    omissoes: [],
    rfSemPendencias: false,
    pgfnSemPendencias: false,
    semPendencias: false,
    totalOriginal: 0, totalSaldo: 0, totalMulta: 0, totalJuros: 0, totalConsolidado: 0, totalSuspenso: 0,
  };

  for (const s of segs) {
    if (s.key === "dados") e.cadastro = parseCadastro(s.txt, e);
    else if (s.key === "socios") e.socios = parseSocios(s.txt);
    else if (s.key === "cert") e.certidao = parseCert(s.txt);
    else if (s.key === "debito") e.debitos.push(...parseDebitos(s.txt));
    else if (s.key === "processo") e.processos.push(...parseProcessos(s.txt));
    else if (s.key === "omissao") e.omissoes!.push(...parseOmissoes(s.hdr, s.txt));
    else if (s.key === "siefpar") e.parcelamentos.push(...parseSiefpar(s.txt));
    else if (s.key === "parcsn") e.parcelamentos.push(...parseParcsn(s.txt));
    else if (s.key === "sida") e.inscricoes.push(...parseSida(s.txt));
    else if (s.key === "sispar") e.parcelamentos.push(...parseSispar(s.txt));
    else if (s.key === "divida") e.divida.push(...parseDivida(s.txt));
  }

  // Totais = só débitos vencidos; os "A VENCER" somam à parte (totalAVencer).
  const t = totaisFiscais(e);
  e.totalOriginal = t.original;
  e.totalSaldo = t.saldo;
  e.totalMulta = t.multa;
  e.totalJuros = t.juros;
  e.totalConsolidado = t.consolidado;
  e.totalAVencer = t.aVencer;
  e.totalSuspenso = round(e.parcelamentos.reduce((a, p) => a + (p.valorSuspenso || 0), 0));
  e.rfSemPendencias =
    e.debitos.length === 0 &&
    e.processos.length === 0 &&
    e.omissoes!.length === 0 &&
    e.parcelamentos.filter((p) => p.origem !== "SISPAR").length === 0;
  e.pgfnSemPendencias =
    e.inscricoes.length === 0 && e.divida.length === 0 && e.parcelamentos.filter((p) => p.origem === "SISPAR").length === 0;
  // "Não foram detectadas pendências" vem POR ÓRGÃO (RFB e PGFN separados): só é
  // "sem pendências" quando nenhum dos dois tem nada.
  e.semPendencias = e.rfSemPendencias && e.pgfnSemPendencias;
  return e;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function parseCadastro(t: string, e: FiscalEmpresa): FiscalCadastro {
  const c: FiscalCadastro = {
    cnpj: g1(t, /CNPJ:\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/),
    ua: g1(t, /UA de Domicílio:\s*(.+?)\s+Código da UA:/),
    codigoUA: g1(t, /Código da UA:\s*([\d.]+)/),
    endereco: g1(t, /Endereço:\s*(.+?)\s+Bairro:/),
    bairro: g1(t, /Bairro:\s*(.+?)\s+CEP:/),
    cep: g1(t, /CEP:\s*([\d-]+)/),
    municipio: g1(t, /Município:\s*(.+?)\s+UF:/),
    uf: g1(t, /UF:\s*([A-Z]{2})/),
    responsavel: g1(t, /Responsável:\s*(.+?)\s+Situação:/),
    situacao: g1(t, /Situação:\s*(\S+)/),
    natureza: g1(t, /Natureza Jurídica:\s*(.+?)\s+Data de Abertura:/),
    abertura: g1(t, /Data de Abertura:\s*(\d{2}\/\d{2}\/\d{4})/),
    cnae: g1(t, /CNAE:\s*(.+?)\s+Porte da Empresa:/),
    porte: g1(t, /Porte da Empresa:\s*([A-ZÀ-Ú ]+?)(?:\s+Opção pelo Simples|$)/),
    simples: [],
  };
  e.cnpj = c.cnpj;
  const sm = t.match(/Opção pelo Simples Nacional Inclusão Exclusão\s*(.+)$/);
  if (sm) {
    const ds = sm[1].match(/\d{2}\/\d{2}\/\d{4}/g) || [];
    for (let i = 0; i < ds.length; i += 2) c.simples.push({ inclusao: ds[i], exclusao: ds[i + 1] || "" });
  }
  return c;
}

const QUALIF =
  /(SÓCIO-ADMINISTRADOR|SÓCIO|ADMINISTRADOR|DIRETOR|PRESIDENTE|VICE-PRESIDENTE|CONSELHEIRO DE ADMINISTRAÇ[ÃA]O|TITULAR|PROCURADOR|INVENTARIANTE|CURADOR)/;
const CPF_CNPJ = /\d{3}\.\d{3}\.\d{3}-\d{2}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g;

function parseSocios(t: string): Socio[] {
  const bodyStr = t
    .replace(/^CPF\/CNPJ Nome Qualificação Situação Cadastral(?: Cap\. Social)?(?: Cap\. Votante)?/, "")
    .trim();
  const idxs: number[] = [];
  let m: RegExpExecArray | null;
  const anchor = new RegExp(CPF_CNPJ.source, "g");
  // CPF do representante legal de sócio PJ não é um sócio.
  while ((m = anchor.exec(bodyStr))) if (!/Representante Legal:\s*$/.test(bodyStr.slice(0, m.index))) idxs.push(m.index);
  const out: Socio[] = [];
  for (let i = 0; i < idxs.length; i++) {
    let chunk = bodyStr.slice(idxs[i], i + 1 < idxs.length ? idxs[i + 1] : bodyStr.length).trim();
    chunk = chunk.replace(/\s*CPF Representante Legal:[\s\S]*$/, "").replace(/\s*Qualif\. Resp\.:[\s\S]*$/, "").trim();
    const docm = chunk.match(new RegExp(CPF_CNPJ.source));
    if (!docm) continue;
    const doc = docm[0];
    let rest = chunk.slice(doc.length).trim();
    const cap = rest.match(/\d{1,3},\d{2}%/g) || [];
    rest = rest.replace(/\d{1,3},\d{2}%/g, "").trim();
    const sm = rest.match(/\b(REGULAR|ATIVA|INATIVA|SUSPENSA|BAIXADA|INAPTA|NULA)\b/);
    const situacaoCadastral = sm ? sm[1] : "";
    const nomeQualif = (sm ? rest.slice(0, sm.index) : rest).trim();
    const qm = nomeQualif.match(QUALIF);
    const qualificacao = qm ? qm[1] : "";
    const nome = (qm ? nomeQualif.slice(0, qm.index) : nomeQualif).trim();
    out.push({ cpfCnpj: doc, nome, qualificacao, situacaoCadastral, capSocial: cap[0] || "", capVotante: cap[1] || "" });
  }
  return out;
}

function parseCert(t: string): FiscalCertidao {
  const m = t.match(
    /Certidão\s+(Positiva com Efeitos de Negativa|Negativa|Positiva)[^:]*:\s*([0-9A-F.]+)\s+Emissão:\s*(\d{2}\/\d{2}\/\d{4})\s+Data de Validade:\s*(\d{2}\/\d{2}\/\d{4})/
  );
  if (!m) return { tipo: "", codigo: "", emissao: "", validade: "" };
  return { tipo: `Certidão ${m[1]}`, codigo: m[2], emissao: m[3], validade: m[4] };
}

// Início de uma linha de débito: "0561-07 - IRRF" ou receitas sem código ("SIMPLES NAC.").
const INI_DEB = "\\d{4}-\\d{2}\\s*-|SIMPLES NAC\\.";
// PA/Exercício: 20/01/2026 · 03/2025 · 2025 · 1º TRIM/2026 (IRPJ/CSLL trimestral).
const PA = "\\d{2}\\/\\d{2}\\/\\d{4}|\\d{2}\\/\\d{4}|\\d[º°o]?\\s*(?:TRIM|SEM|QUAD)\\/\\d{4}|\\d{4}";

function parseDebitos(t: string): FiscalDebito[] {
  const re = new RegExp(
    `(?:(\\d{4}-\\d{2})\\s*-\\s*(.+?)|(SIMPLES NAC\\.))\\s+(${PA})\\s+(\\d{2}\\/\\d{2}\\/\\d{4})\\s+((?:${VAL}\\s+){1,4}${VAL})\\s+(.+?)(?=\\s*(?:${INI_DEB})|$)`,
    "g"
  );
  const out: FiscalDebito[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const vals = m[6].trim().split(/\s+/).map(num);
    const vo = vals[0] || 0;
    const sd = vals[1] || 0;
    let mu = 0,
      ju = 0,
      co = sd;
    if (vals.length >= 5) {
      mu = vals[2];
      ju = vals[3];
      co = vals[4];
    }
    let tail = clean(m[7]);
    let nota = "";
    const nm = tail.match(/Notificação de lançamento:\s*(\S+)/);
    if (nm) {
      nota = nm[1];
      tail = tail.replace(/Notificação de lançamento:\s*\S+/, "").trim();
    }
    out.push({
      origem: "SIEF",
      receita: m[1] ? `${m[1]} - ${m[2].trim()}` : m[3],
      periodo: m[4].replace(/\s+/g, " "),
      vencimento: m[5],
      valorOriginal: vo,
      saldoDevedor: sd,
      multa: mu,
      juros: ju,
      consolidado: co,
      situacao: tail,
      nota,
    });
  }
  return out;
}

// Situações de processo em MAIÚSCULAS (as demais vêm em caixa mista, ex.: "Medida
// Judicial Pendente de Comprovação", e são separadas da localização pela caixa).
const SIT_PROC = /^(DEVEDOR|SUSPENSO|EM PARCELAMENTO|PARCELADO|EXIGIBILIDADE SUSPENSA|EM COBRAN[ÇC]A|EM AN[ÁA]LISE)\b/;
const NUM_PROC = /\d{5}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g;

function parseProcessos(t: string): FiscalProcesso[] {
  const txt = clean(t.replace(/^.*?Processo Situação Localização\s*/, ""));
  const out: FiscalProcesso[] = [];
  const idx: number[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(NUM_PROC.source, "g");
  // Número de processo no início de linha (não o de "Processos de crédito: ...").
  while ((m = re.exec(txt))) if (!/crédito:\s*$/.test(txt.slice(0, m.index))) idx.push(m.index);
  for (let i = 0; i < idx.length; i++) {
    const chunk = txt.slice(idx[i], i + 1 < idx.length ? idx[i + 1] : txt.length).trim();
    const numero = chunk.slice(0, 21);
    let rest = chunk.slice(21).trim();
    const creditos: string[] = [];
    rest = rest.replace(/\s*Processos de crédito:\s*([\d./\-, ]+)/g, (_, c: string) => {
      creditos.push(...(c.match(NUM_PROC) || []));
      return "";
    }).trim();
    let situacao = "";
    let localizacao = "";
    const sm = rest.match(SIT_PROC);
    if (sm) {
      situacao = sm[1];
      localizacao = rest.slice(sm[0].length).trim();
    } else {
      // Caixa mista: a situação vai até a última palavra com minúscula.
      const ws = rest.split(" ");
      let k = -1;
      ws.forEach((w, j) => {
        if (/[a-zà-ú]/.test(w)) k = j;
      });
      if (k >= 0) {
        situacao = ws.slice(0, k + 1).join(" ");
        localizacao = ws.slice(k + 1).join(" ");
      } else {
        situacao = ws[0] || "";
        localizacao = ws.slice(1).join(" ");
      }
    }
    out.push({ origem: "SIEF", numero, situacao, localizacao, processosCredito: creditos });
  }
  return out;
}

function parseSiefpar(t: string): FiscalParcelamento[] {
  const re = /Parcelamento:\s*(\S+)\s+Valor Suspenso:\s*(\d[\d.,]*)/g;
  const out: FiscalParcelamento[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) out.push({ origem: "SIEFPAR", identificador: m[1], valorSuspenso: num(m[2]), tipo: "", modalidade: "" });
  return out;
}

// PARCSN/PARCMEI (parcelamento do Simples Nacional / MEI na RFB): o relatório só
// traz a descrição, ex.: "SIMPLES NACIONAL - EM PARCELAMENTO".
function parseParcsn(t: string): FiscalParcelamento[] {
  const out: FiscalParcelamento[] = [];
  const txt = corpo(t).replace(/CNPJ:\s*\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g, "\n").trim();
  for (const linha of txt.split("\n").map((x) => x.trim()).filter(Boolean)) {
    const m = linha.match(/^(.+?)\s+-\s+(.+)$/);
    out.push({
      origem: "PARCSN/PARCMEI",
      identificador: m ? m[1].trim() : linha,
      valorSuspenso: 0,
      tipo: m ? m[2].trim() : "",
      modalidade: "",
    });
  }
  return out;
}

// "Pendência - Omissão de DCTFWeb*": lista de períodos (ex.: "2025 - AGO") sem entrega.
const MES = "JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ";
function parseOmissoes(hdr: string, t: string): FiscalOmissao[] {
  const declaracao = hdr.replace(/^Pendência - Omissão de\s*/, "").replace(/\*+$/, "").trim();
  const txt = corpo(t)
    .replace(/\*[^*]*$/, "") // nota de rodapé "*Ausência de entrega ..."
    .replace(/CNPJ:\s*\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g, " ")
    .replace(/\([^)]*\)/g, " ");
  const re = new RegExp(`\\d{4}\\s*-\\s*(?:${MES})|\\d{2}\\/\\d{4}|\\d[º°o]?\\s*TRIM\\/\\d{4}|\\b\\d{4}\\b`, "g");
  const periodos = txt.match(re) || [];
  if (!periodos.length) return [{ declaracao, periodo: txt.trim() }];
  return periodos.map((p) => ({ declaracao, periodo: p.replace(/\s+/g, " ") }));
}

function parseSispar(t: string): FiscalParcelamento[] {
  const re = /Conta\s+(\d+)\s+(.+?)\s+Modalidade:\s*(.+?)(?=\s*Conta\s+\d|$)/g;
  const out: FiscalParcelamento[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)))
    out.push({ origem: "SISPAR", identificador: m[1], valorSuspenso: 0, tipo: m[2].trim(), modalidade: clean(m[3]) });
  return out;
}

function parseSida(t: string): FiscalInscricao[] {
  const re =
    /(8\d\.\d\.\d{2}\.\d{6}-\d{2})\s+(.+?)\s+(\d{2}\/\d{2}\/\d{4})\s+(?:(\d{2}\/\d{2}\/\d{4})\s+)?(\d{5}\.\d{3}\.\d{3}\/\d{4}-\d{2})\s+(DEVEDOR \w+(?: \w+)?)\s+Situação:\s*(.+?)(?=\s*8\d\.\d\.\d{2}\.\d{6}-\d{2}|$)/g;
  const out: FiscalInscricao[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)))
    out.push({
      origem: "SIDA",
      inscricao: m[1],
      receita: m[2].trim(),
      inscritoEm: m[3],
      ajuizadoEm: m[4] || "",
      processo: m[5],
      tipoDevedor: m[6].trim(),
      situacao: clean(m[7]),
    });
  return out;
}

function parseDivida(t: string): FiscalDivida[] {
  const re = /Inscrição:\s*([\d.-]+)\s+Situação:\s*(.+?)(?=\s*Inscrição:|$)/g;
  const out: FiscalDivida[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) out.push({ inscricao: m[1], situacao: clean(m[2]) });
  return out;
}

export interface FiscalImportResult {
  empresas: FiscalEmpresa[];
  rejeitados: number; // PDF com texto, mas não é relatório de Situação Fiscal
  escaneados: number; // imagem (sem texto) — precisa OCR
}

export async function importarFiscal(files: File[]): Promise<FiscalImportResult> {
  const empresas: FiscalEmpresa[] = [];
  let rejeitados = 0;
  let escaneados = 0;
  for (const f of files) {
    let r;
    try {
      r = await lerPaginasNaturais(f);
    } catch {
      rejeitados++;
      continue;
    }
    if (r.chars < 30) {
      escaneados++;
      continue;
    }
    if (!ehRelatorioSituacaoFiscal(r.paginas)) {
      rejeitados++;
      continue;
    }
    empresas.push(parseSituacaoFiscal(r.paginas, f.name));
  }
  return { empresas, rejeitados, escaneados };
}
