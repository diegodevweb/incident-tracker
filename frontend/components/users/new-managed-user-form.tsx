"use client";

import { useState, useTransition } from "react";
import { createCompanyUser } from "@/lib/api";
import type { CompanyUser } from "@/lib/types";

export function NewCompanyUserForm({
  companyId,
  onCreated,
}: {
  companyId: number;
  onCreated: (user: CompanyUser, temporaryPassword: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const { user, temporaryPassword } = await createCompanyUser(companyId, {
          name,
          email,
        });
        setName("");
        setEmail("");
        onCreated(user, temporaryPassword);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Não foi possível cadastrar o usuário.",
        );
      }
    });
  }

  return (
    <form
      className="app-surface-muted space-y-4 rounded-2xl border p-4"
      onSubmit={handleSubmit}
    >
      <div>
        <h3 className="font-semibold">Novo usuário</h3>
        <p className="mt-1 text-sm text-base-content/60">
          O sistema gera uma senha temporária para você repassar; a pessoa
          define a senha dela no primeiro acesso.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <label className="form-control">
          <span className="label-text mb-2">Nome</span>
          <input
            required
            type="text"
            maxLength={191}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="input input-bordered w-full"
            placeholder="Nome da pessoa"
          />
        </label>
        <label className="form-control">
          <span className="label-text mb-2">E-mail de acesso</span>
          <input
            required
            type="email"
            maxLength={191}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="input input-bordered w-full"
            placeholder="pessoa@empresa.com"
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={isPending}>
          {isPending ? "Cadastrando..." : "Cadastrar usuário"}
        </button>
      </div>

      {error ? <div className="alert alert-error text-sm">{error}</div> : null}
    </form>
  );
}
