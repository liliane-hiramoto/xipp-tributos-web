import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AUTH_ENABLED } from "@/lib/supabase/middleware";
import { fetchDarfs } from "@/lib/dbDarfs";
import type { DarfLinha } from "@/data/darfs";
import DashboardShell from "@/components/DashboardShell";

export default async function Home() {
  // Sem Supabase configurado, o painel roda aberto (dados estáticos embutidos).
  if (!AUTH_ENABLED) return <DashboardShell />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const email = user.email ?? "";
  // Acesso pela régua do Portal Xipp (portal-fiscal-modelo, 0007): módulo
  // `tributos` em user_modules (qualquer papel lê; editor/admin grava), admin do
  // portal ou super-admin. As RLS das tabelas trib_* usam as MESMAS funções
  // (trib_is_user / trib_is_admin), então a tela e o dado concordam.
  const [{ data: temAcesso }, { data: podeGravar }] = await Promise.all([
    supabase.rpc("trib_is_user"),
    supabase.rpc("trib_is_admin"),
  ]);
  if (!temAcesso) redirect("/login?sem_acesso=1");
  // "isAdmin" aqui = pode fazer as ações de dados (importar/limpar/upload).
  const isAdmin = !!podeGravar;

  // DARFs vêm do banco (fonte única). Se a consulta falhar, o app cai no
  // conjunto embutido e o admin pode gravar no banco pela tela.
  let dbDarfs: DarfLinha[] = [];
  try {
    dbDarfs = await fetchDarfs(supabase);
  } catch {
    dbDarfs = [];
  }

  return (
    <DashboardShell
      userEmail={email}
      userNome={email}
      isAdmin={isAdmin}
      dbDarfs={dbDarfs}
    />
  );
}
