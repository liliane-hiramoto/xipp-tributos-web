# Replicar o módulo Tributos para uma instância

Este repositório (`tributos-web`) é o **golden-source** (canônico) do módulo de
Controle de Tributos Federais (DARF). É **neutro**: sem marca, sem dados de empresa,
tabelas com prefixo neutro `trib_`. Instâncias (Affix, RQ, Flórida, …) clonam daqui.

> Regra de ouro: **feature nova entra AQUI primeiro**, depois propaga às instâncias.

## O que muda entre instâncias (só isto)
| Arquivo | O que trocar |
|---|---|
| `src/app/globals.css` | `--brand` / `--brand-soft` (cor da marca da instância) |
| `src/components/Sidebar.tsx` | nome exibido no topo (ex.: "RQ · Tributos") |
| `src/app/login/page.tsx` | nome/logo no login |
| `src/app/layout.tsx` | `metadata` (title/description) |
| `next.config.ts` | `basePath` (ex.: `/tributos`, `/fiscal`) |
| `.env.local` | `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` do hub da instância + `ANTHROPIC_API_KEY` (caixa de perguntas do módulo fiscal; só no servidor) |
| tabelas `trib_*` | opcional: renomear pro prefixo da instância (ex.: `rq_*`) no `src` e `supabase/migrations` |
| `supabase/migrations/0007_*` | `user_modules.modulo` gate (ex.: `'tributos'`) + e-mail do dono |

## Dados
- **Nada embutido.** DARFs entram por importação de PDF (comprovantes/e-CAC).
- Empresas vêm do **cadastro central** (`public.empresas`) do hub da instância.
- Y570 e CNPJ são **ferramentas** (apps próprios, sem login) linkadas no menu lateral;
  o portal da instância roteia `/y570` e `/cnpj` para elas.
- O Y570 (`/y570`) também saiu do menu (30/10/2026): card próprio "Y570 · ECF" no
  portal, com histórico no banco de cada portal (`/api/y570-base` do portal).
- A Consulta CNPJ (`/cnpj`) **não** fica no menu do Tributos desde 30/10/2026:
  no portal ela tem card e acesso próprios ("Consulta CNPJ e SN") — base
  cadastral (dado público) não fica atrás do dado fiscal sigiloso.

## Passos
1. Copiar esta base (sem `.git`/`.vercel`/`.env`/`.next`).
2. Rebrandear os arquivos da tabela acima + ajustar `basePath`.
3. Criar o hub Supabase (ou reusar) e rodar `supabase/migrations/*` (ajustando o
   prefixo/gate se desejar). Instância começa vazia.
4. Publicar no Vercel + ligar no portal da instância (rewrite multi-zone).
