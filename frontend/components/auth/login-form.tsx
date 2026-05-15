"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { login } from "@/lib/api";
import { dashboardPathForRole } from "@/lib/session";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const session = await login({ email, password });
        router.push(dashboardPathForRole(session.user.role));
      } catch {
        setErrorMessage(
          "Não foi possível autenticar. Verifique e-mail, senha e a disponibilidade da API.",
        );
      }
    });
  }

  return (
    <section className="app-surface card border">
      <div className="card-body gap-6">
        <div>
          <div className="badge badge-outline badge-primary mb-4">
            Acesso seguro
          </div>
          <h2 className="text-3xl font-semibold tracking-tight">Entrar</h2>
          <p className="mt-2 text-sm leading-6 text-base-content/65">
            Faça login com seu e-mail e senha para acessar o painel conforme o
            seu perfil.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="form-control">
            <span className="label-text mb-2">E-mail</span>
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              className="input input-bordered w-full"
              placeholder="voce@empresa.com"
            />
          </label>

          <label className="form-control">
            <span className="label-text mb-2">Senha</span>
            <input
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              className="input input-bordered w-full"
              placeholder="Digite sua senha"
            />
          </label>

          {errorMessage ? (
            <div className="alert alert-error text-sm">{errorMessage}</div>
          ) : null}

          <button type="submit" className="btn btn-primary w-full mt-4" disabled={isPending}>
            {isPending ? "Autenticando..." : "Entrar"}
          </button>
        </form>
      </div>
    </section>
  );
}
