"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/api";
import type { ClientAccount } from "@/lib/types";

export function NewClientForm({
  onCreated,
}: {
  onCreated: (client: ClientAccount, temporaryPassword: string) => void;
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
        const { client, temporaryPassword } = await createClient({ name, email });
        setName("");
        setEmail("");
        onCreated(client, temporaryPassword);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Não foi possível cadastrar o cliente.",
        );
      }
    });
  }

  return (
    <section className="app-surface card border">
      <form className="card-body gap-5" onSubmit={handleSubmit}>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Novo cliente</h2>
          <p className="mt-1 text-sm text-base-content/60">
            O sistema gera uma senha temporária para você repassar; o cliente
            define a senha dele no primeiro acesso.
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
              placeholder="Empresa ou responsável"
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
              placeholder="contato@empresa.com"
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={isPending}>
            {isPending ? "Cadastrando..." : "Cadastrar cliente"}
          </button>
        </div>

        {error ? <div className="alert alert-error text-sm">{error}</div> : null}
      </form>
    </section>
  );
}
