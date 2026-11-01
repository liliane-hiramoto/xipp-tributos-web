// Helpers da área Fiscal (Situação Fiscal / CNDs / Parcelamentos).
import { FISCAL, type FiscalEmpresa } from "@/data/fiscal-tipos";

export { FISCAL };
export type { FiscalEmpresa };

// "dd/mm/aaaa" -> Date (meia-noite local).
export function parseBR(d: string): Date | null {
  const m = (d || "").match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00`) : null;
}

// Data de referência: hoje.
function hoje(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export interface StatusCND {
  label: string;
  cor: string;
  vencida: boolean;
}

/** Situação da certidão a partir do tipo e da validade. */
export function statusCND(tipo: string, validade: string): StatusCND {
  const v = parseBR(validade);
  const vencida = !!v && v < hoje();
  if (vencida) return { label: "Vencida", cor: "#dc2626", vencida: true };
  // "Positiva com Efeitos de Negativa" também termina em "Negativa": testar antes.
  if (/Efeitos de Negativa/i.test(tipo)) return { label: "Regular (positiva c/ efeito)", cor: "#0891b2", vencida: false };
  if (/Negativa$/i.test(tipo)) return { label: "Regular (negativa)", cor: "#059669", vencida: false };
  if (/Positiva/i.test(tipo)) return { label: "Positiva", cor: "#d97706", vencida: false };
  return { label: tipo || "—", cor: "#64748b", vencida: false };
}

/** Empresas fiscais filtradas pelo CNPJ selecionado (vazio = todas), sobre a lista
 *  informada (snapshots do banco). Rótulo: apelido do cadastro central ou razão. */
export function empresasFiscais(cnpj: string, lista: FiscalEmpresa[] = FISCAL): FiscalEmpresa[] {
  const digs = (cnpj || "").replace(/\D/g, "");
  const rs = digs ? lista.filter((e) => e.cnpj.replace(/\D/g, "") === digs) : lista;
  const rot = (e: FiscalEmpresa) => e.apelido || e.razaoSocial || e.cnpj;
  return [...rs].sort((a, b) => rot(a).localeCompare(rot(b)));
}

// Débito "A VENCER" (ex.: "A ANALISAR-A VENCER", em Débito com Exigibilidade
// Suspensa): fica num bloco próprio e fora do total vencido.
export function ehAVencer(d: { situacao: string }): boolean {
  return /A VENCER/i.test(d.situacao || "");
}

export interface TotaisFiscais {
  original: number;
  saldo: number;
  multa: number;
  juros: number;
  consolidado: number;
  aVencer: number; // soma do Sdo. Devedor dos débitos a vencer
}

/** Totais recalculados a partir dos débitos (vale também p/ snapshots antigos,
 *  cujos totais gravados incluíam os débitos a vencer). */
export function totaisFiscais(e: FiscalEmpresa): TotaisFiscais {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const t: TotaisFiscais = { original: 0, saldo: 0, multa: 0, juros: 0, consolidado: 0, aVencer: 0 };
  for (const d of e.debitos) {
    if (ehAVencer(d)) {
      t.aVencer += d.saldoDevedor;
      continue;
    }
    t.original += d.valorOriginal;
    t.saldo += d.saldoDevedor;
    t.multa += d.multa;
    t.juros += d.juros;
    t.consolidado += d.consolidado;
  }
  return {
    original: r2(t.original), saldo: r2(t.saldo), multa: r2(t.multa),
    juros: r2(t.juros), consolidado: r2(t.consolidado), aVencer: r2(t.aVencer),
  };
}
