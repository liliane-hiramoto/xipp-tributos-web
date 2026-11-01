// Helpers de formatação (pt-BR).

const moneyFmt = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function fmtMoney(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return "—";
  return moneyFmt.format(v);
}

export function fmtNum(v: number, casas = 0): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(v);
}

/** "2026-01-13" -> "13/01/2026" */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function fmtPct(v: number, casas = 1): string {
  return `${(v * 100).toFixed(casas)}%`;
}
