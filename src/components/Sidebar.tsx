"use client";

import { NAV } from "@/lib/nav";

export default function Sidebar({
  current,
  onNavigate,
  isAdmin = false,
}: {
  current: string;
  onNavigate: (page: string) => void;
  isAdmin?: boolean;
}) {
  const grupos = NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.admin || isAdmin),
  })).filter((g) => g.items.length > 0);

  return (
    <aside className="flex w-64 shrink-0 flex-col bg-[var(--brand)] text-slate-100">
      <a
        href="/"
        className="flex items-center gap-2 border-b border-white/10 px-5 py-3 text-xs font-medium text-slate-200 transition hover:bg-white/10 hover:text-white"
      >
        ← Menu do Portal
      </a>
      <div className="px-5 py-5">
        <div className="inline-block rounded-md bg-white px-3 py-2">
          <span className="text-sm font-bold text-[var(--brand)]">
            Xipp · Tributos
          </span>
        </div>
        <div className="mt-2 text-[11px] font-light tracking-wide text-slate-300">
          Controle de Tributos Federais · DARF
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto pb-6">
        {grupos.map((group) => (
          <div key={group.id} className="mt-2">
            <div className="px-5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {group.title}
            </div>
            {group.items.map((item) => {
              const active = item.page === current;
              return (
                <button
                  key={item.page}
                  onClick={() => onNavigate(item.page)}
                  className={`flex w-full items-center gap-3 px-5 py-2 text-left text-sm transition ${
                    active
                      ? "bg-white/15 font-medium text-white"
                      : "text-slate-200 hover:bg-white/10"
                  }`}
                >
                  <span className="w-4 text-center opacity-80">{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}

        {/* "Ferramentas" saiu do menu (30/10/2026): a Consulta CNPJ e SN e o Y570 · ECF
            são cards próprios no menu do portal, com acesso e histórico separados do
            dado fiscal sigiloso. */}
      </nav>

      <div className="px-5 py-4 text-[10px] leading-relaxed text-slate-400">
        Fonte: comprovantes de arrecadação (Receita Federal).
      </div>
    </aside>
  );
}
