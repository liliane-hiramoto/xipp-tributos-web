# CLAUDE.md — Xipp · Tributos (instância)

Instância **Xipp** do canônico `liliane-hiramoto/tributos-web` (versão
`ad5e0bf`, 01/11/2026): Controle de Tributos Federais — DARFs, Situação
Fiscal, certidões, parcelamentos, documentos. **Feature nova entra no canônico
primeiro** e vem para cá por PR (ver `REPLICAR.md`).

## Como trabalhar com a usuária
- Ela é **não-dev**: explicar em português e guiar clique a clique.
- **PR automático (18/10/2026, vale para TODOS os repositórios dela):** abrir o
  PR sem perguntar e, com a verificação verde e sem conflito, fazer o merge.
- SQL deste módulo mora no `portal-xipp` (ver abaixo) — colar o SQL inteiro
  no chat, ela aplica no Supabase › SQL Editor.

## O que muda em relação ao canônico (só isto)
| arquivo | o quê |
|---|---|
| `next.config.ts` | `basePath = "/tributos"` — o Portal Xipp faz o rewrite |
| `src/app/layout.tsx`, `src/app/login/page.tsx`, `src/components/Sidebar.tsx`, `package.json` | nome "Xipp · Tributos" |
| `src/app/page.tsx` | acesso por `trib_is_user()` / `trib_is_admin()` (régua de `user_modules`, módulo `tributos`), não pelo módulo `fiscal` |
| `supabase/migrations/` | vazio de propósito: as tabelas `trib_*` nascem no SETUP do `portal-xipp` |
| `src/app/globals.css` | ⚠️ ainda a paleta neutra do canônico: trocar pela da Xipp junto com o portal |

## Ambiente / deploy
- Projeto na Vercel **`xipp-tributos-web`** (o Portal aponta para
  `https://xipp-tributos-web.vercel.app/tributos`).
- Variáveis: `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` — as
  MESMAS do Portal Xipp (mesmo banco, mesmo login) — e, opcional,
  `ANTHROPIC_API_KEY` (caixa de perguntas do Fiscal; só no servidor).
- npm: espelho em `.npmrc` (registry.yarnpkg.com).
