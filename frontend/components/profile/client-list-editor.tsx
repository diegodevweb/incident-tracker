"use client";

import { useState, useTransition } from "react";
import { resetClientPassword, setClientDisabled, updateClient } from "@/lib/api";
import type { ClientAccount } from "@/lib/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function ClientCard({
  client,
  onChanged,
  onTemporaryPassword,
}: {
  client: ClientAccount;
  onChanged: (client: ClientAccount) => void;
  onTemporaryPassword: (client: ClientAccount, password: string) => void;
}) {
  const [name, setName] = useState(client.name);
  const [email, setEmail] = useState(client.email);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isDisabled = client.disabledAt !== null;
  const hasChanges =
    name.trim() !== client.name || email.trim().toLowerCase() !== client.email;

  function run(action: () => Promise<void>, fallbackError: string) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : fallbackError);
      }
    });
  }

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(async () => {
      const updated = await updateClient(client.id, { name, email });
      setName(updated.name);
      setEmail(updated.email);
      onChanged(updated);
    }, "Não foi possível salvar o cliente.");
  }

  function resetPassword() {
    if (
      !window.confirm(
        `Gerar uma nova senha temporária para ${client.name}? A senha atual deixa de valer e as sessões abertas do cliente são encerradas.`,
      )
    ) {
      return;
    }

    run(async () => {
      const { temporaryPassword } = await resetClientPassword(client.id);
      onTemporaryPassword(client, temporaryPassword);
      onChanged({ ...client, mustChangePassword: true });
    }, "Não foi possível gerar a nova senha.");
  }

  function toggleDisabled() {
    if (
      !isDisabled &&
      !window.confirm(
        `Desativar ${client.name}? O cliente não consegue mais entrar, as sessões abertas são encerradas e as chaves de webhook dele param de funcionar.`,
      )
    ) {
      return;
    }

    run(async () => {
      onChanged(await setClientDisabled(client.id, !isDisabled));
    }, "Não foi possível alterar a situação do cliente.");
  }

  return (
    <article className="app-surface card border">
      <form className="card-body gap-5" onSubmit={save}>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{client.name}</h2>
            <p className="text-sm text-base-content/60">
              Cliente desde {formatDate(client.createdAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isDisabled ? (
              <span className="badge badge-error badge-outline">Desativado</span>
            ) : (
              <span className="badge badge-success badge-outline">Ativo</span>
            )}
            {client.mustChangePassword ? (
              <span className="badge badge-warning badge-outline">
                Senha temporária pendente
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_1fr_12rem]">
          <label className="form-control">
            <span className="label-text mb-2">Nome</span>
            <input
              required
              type="text"
              maxLength={191}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="input input-bordered w-full"
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
            />
          </label>
          <div className="app-surface-muted rounded-2xl border p-4">
            <p className="text-sm text-base-content/60">Chamados em aberto</p>
            <p className="mt-1 text-2xl font-semibold">{client.openIncidents}</p>
          </div>
        </div>

        {error ? <div className="alert alert-error text-sm">{error}</div> : null}

        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={resetPassword}
            disabled={isPending || isDisabled}
          >
            Gerar nova senha temporária
          </button>
          <button
            type="button"
            className={isDisabled ? "btn btn-outline" : "btn btn-outline btn-error"}
            onClick={toggleDisabled}
            disabled={isPending}
          >
            {isDisabled ? "Reativar" : "Desativar"}
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isPending || !hasChanges}
          >
            Salvar
          </button>
        </div>
      </form>
    </article>
  );
}

export function ClientListEditor({
  clients,
  onClientChanged,
  onTemporaryPassword,
}: {
  clients: ClientAccount[];
  onClientChanged: (client: ClientAccount) => void;
  onTemporaryPassword: (client: ClientAccount, password: string) => void;
}) {
  return (
    <section className="space-y-4">
      {clients.map((client) => (
        <ClientCard
          key={client.id}
          client={client}
          onChanged={onClientChanged}
          onTemporaryPassword={onTemporaryPassword}
        />
      ))}
    </section>
  );
}
