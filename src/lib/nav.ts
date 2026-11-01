// Árvore de navegação (menu lateral) do Controle de Tributos Federais.

export interface NavItem {
  page: string;
  icon: string;
  label: string;
  admin?: boolean; // visível apenas para administradores
}

export interface NavGroup {
  id: string;
  title: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    id: "visao",
    title: "Visão",
    items: [
      { page: "insights", icon: "✦", label: "Insights" },
      { page: "overview", icon: "⌂", label: "Visão Geral" },
      { page: "atrasos", icon: "⏱", label: "Vencimentos & Atrasos" },
    ],
  },
  {
    id: "tributos",
    title: "Tributos",
    items: [
      { page: "tabela", icon: "▤", label: "Todos os DARFs" },
      { page: "por_tributo", icon: "≡", label: "Por Tributo" },
      { page: "por_periodo", icon: "▦", label: "Por Mês" },
    ],
  },
  {
    id: "fiscal",
    title: "Fiscal",
    items: [
      { page: "fiscal_situacao", icon: "⚖", label: "Situação Fiscal" },
      { page: "fiscal_parcelamentos", icon: "📑", label: "Parcelamentos" },
      { page: "fiscal_documentos", icon: "🗂", label: "Documentos" },
    ],
  },
  {
    id: "auditoria",
    title: "Auditoria",
    items: [{ page: "duplicidades", icon: "⚠", label: "Duplicidades" }],
  },
  // "Usuários" saiu deste módulo: o controle de acesso é centralizado no SSO do
  // Portal (Admin do portal · user_modules). Ver o /admin do o portal da instância.
];

export const PAGE_LABELS: Record<string, string> = Object.fromEntries(
  NAV.flatMap((g) => g.items.map((i) => [i.page, i.label]))
);
