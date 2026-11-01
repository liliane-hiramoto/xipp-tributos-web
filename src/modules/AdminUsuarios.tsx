"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, SecTitle, Selo } from "@/components/ui";

interface Usuario {
  id: number;
  email: string;
  nome: string | null;
  papel: "admin" | "usuario";
  ativo: boolean;
  created_at: string;
}

export default function AdminUsuarios({ meuEmail }: { meuEmail: string }) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [novoEmail, setNovoEmail] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [novoPapel, setNovoPapel] = useState<"admin" | "usuario">("usuario");
  const [salvando, setSalvando] = useState(false);

  const supabase = createClient();

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    const { data, error } = await supabase
      .from("trib_usuarios")
      .select("id, email, nome, papel, ativo, created_at")
      .order("created_at", { ascending: true });
    if (error) setErro(error.message);
    else setUsuarios((data ?? []) as Usuario[]);
    setCarregando(false);
  }, [supabase]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    const email = novoEmail.trim().toLowerCase();
    if (!email) return;
    setSalvando(true);
    setErro(null);
    const { error } = await supabase
      .from("trib_usuarios")
      .insert({ email, nome: novoNome.trim() || null, papel: novoPapel, ativo: true });
    setSalvando(false);
    if (error) {
      setErro(error.message.includes("duplicate") ? "Este e-mail já está cadastrado." : error.message);
      return;
    }
    setNovoEmail("");
    setNovoNome("");
    setNovoPapel("usuario");
    carregar();
  }

  async function atualizar(id: number, campos: Partial<Usuario>) {
    setErro(null);
    const { error } = await supabase.from("trib_usuarios").update(campos).eq("id", id);
    if (error) setErro(error.message);
    else carregar();
  }

  async function remover(u: Usuario) {
    if (!confirm(`Remover o acesso de ${u.email}?`)) return;
    setErro(null);
    const { error } = await supabase.from("trib_usuarios").delete().eq("id", u.id);
    if (error) setErro(error.message);
    else carregar();
  }

  return (
    <div className="space-y-6">
      <Card>
        <SecTitle>Adicionar usuário</SecTitle>
        <p className="-mt-1 mb-3 text-xs text-slate-400">
          Libera o acesso pelo e-mail. A pessoa precisa ter (ou criar) uma conta com esse
          mesmo e-mail para entrar. Administradores gerenciam usuários e importam dados.
        </p>
        <form onSubmit={adicionar} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">E-mail</span>
            <input
              type="email"
              required
              value={novoEmail}
              onChange={(e) => setNovoEmail(e.target.value)}
              placeholder="pessoa@empresa.com"
              className="w-64 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-[var(--brand)]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Nome</span>
            <input
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              className="w-48 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-[var(--brand)]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Papel</span>
            <select
              value={novoPapel}
              onChange={(e) => setNovoPapel(e.target.value as "admin" | "usuario")}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-[var(--brand)]"
            >
              <option value="usuario">Usuário</option>
              <option value="admin">Administrador</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={salvando}
            className="rounded-lg bg-[var(--brand)] px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {salvando ? "Adicionando…" : "Adicionar"}
          </button>
        </form>
        {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}
      </Card>

      <Card className="p-0">
        <div className="border-b border-slate-200 px-5 py-3">
          <SecTitle>Usuários com acesso — {usuarios.length}</SecTitle>
        </div>
        {carregando ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">Carregando…</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-2 font-medium">E-mail</th>
                <th className="px-3 py-2 font-medium">Nome</th>
                <th className="px-3 py-2 font-medium">Papel</th>
                <th className="px-3 py-2 text-center font-medium">Ativo</th>
                <th className="px-3 py-2 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => {
                const souEu = u.email === meuEmail;
                return (
                  <tr key={u.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-5 py-2 text-slate-700">
                      {u.email}
                      {souEu && <span className="ml-2 text-xs text-slate-400">(você)</span>}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{u.nome ?? "—"}</td>
                    <td className="px-3 py-2">
                      <select
                        value={u.papel}
                        disabled={souEu}
                        onChange={(e) => atualizar(u.id, { papel: e.target.value as "admin" | "usuario" })}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-[var(--brand)] disabled:opacity-60"
                      >
                        <option value="usuario">Usuário</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => atualizar(u.id, { ativo: !u.ativo })}
                        disabled={souEu}
                        title={u.ativo ? "Desativar acesso" : "Reativar acesso"}
                        className="disabled:opacity-40"
                      >
                        {u.ativo ? (
                          <Selo color="#059669">ativo</Selo>
                        ) : (
                          <Selo color="#dc2626">inativo</Selo>
                        )}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => remover(u)}
                        disabled={souEu}
                        className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                );
              })}
              {usuarios.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                    Nenhum usuário cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
