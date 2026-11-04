"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    if (q.has("expirado")) setAviso("Sessão encerrada por inatividade. Entre novamente.");
    else if (q.has("sem_acesso"))
      setAviso("Seu usuário não tem acesso a este painel. Fale com um administrador.");
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push("/");
      router.refresh();
    } catch (e) {
      // Só "credenciais inválidas" é senha errada. O resto (chave do Supabase errada,
      // sem rede…) aparece com a mensagem real: tudo virar "senha incorreta" escondeu
      // um problema de configuração no Portal Benevix (04/11/2026).
      const m = e instanceof Error ? e.message : String(e);
      setError(/invalid login credentials/i.test(m) ? "E-mail ou senha incorretos." : `Não consegui entrar: ${m}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 inline-block rounded-lg bg-[var(--brand)] px-4 py-2">
            <span className="text-sm font-bold text-white">Xipp · Tributos</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Controle de Tributos Federais
          </h1>
          <p className="mt-1 text-sm text-slate-500">Entre na sua conta</p>
        </div>

        {aviso && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-sm text-amber-800">
            {aviso}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <label className="block">
            <span className="text-xs font-medium text-slate-600">E-mail</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Senha</span>
            <div style={{ position: "relative" }}>
              <input
                type={verSenha ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
              style={{ paddingRight: 40 }}
              />
              {/* Olho: mostra a senha digitada (pedido dela, 04/11/2026, em todos os portais). */}
              <button type="button" onClick={() => setVerSenha((v) => !v)} aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"} title={verSenha ? "Ocultar senha" : "Mostrar senha"}
                style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: 0, padding: 6, margin: 0, width: "auto", cursor: "pointer", color: "#64748b", display: "flex" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                  <circle cx="12" cy="12" r="3" />
                  {!verSenha && <line x1="3" y1="3" x2="21" y2="21" />}
                </svg>
              </button>
            </div>
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
