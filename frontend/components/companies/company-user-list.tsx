"use client";

import { useState, useTransition } from "react";
import {
  resetCompanyUserPassword,
  setCompanyUserDisabled,
  updateCompanyUser,
} from "@/lib/api";
import type { CompanyUser } from "@/lib/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function CompanyUserCard({
  companyId,
  user,
  onChanged,
  onTemporaryPassword,
}: {
  companyId: number;
  user: CompanyUser;
  onChanged: (user: CompanyUser) => void;
  onTemporaryPassword: (user: CompanyUser, password: string) => void;
}) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isDisabled = user.disabledAt !== null;
  const hasChanges =
    name.trim() !== user.name || email.trim().toLowerCase() !== user.email;

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
      const updated = await updateCompanyUser(companyId, user.id, {
        name,
        email,
      });
      setName(updated.name);
      setEmail(updated.email);
      onChanged(updated);
    }, "Não foi possível salvar o usuário.");
  }

  function resetPassword() {
    if (
      !window.confirm(
        `Gerar uma nova senha temporária para ${user.name}? A senha atual deixa de valer e as sessões abertas dessa pessoa são encerradas.`,
      )
    ) {
      return;
    }

    run(async () => {
      const { temporaryPassword } = await resetCompanyUserPassword(
        companyId,
        user.id,
      );
      onTemporaryPassword(user, temporaryPassword);
      onChanged({ ...user, mustChangePassword: true });
    }, "Não foi possível gerar a nova senha.");
  }

  function toggleDisabled() {
    if (
      !isDisabled &&
      !window.confirm(
        `Desativar ${user.name}? A pessoa não consegue mais entrar e as sessões abertas são encerradas. Os chamados dela continuam com a empresa.`,
      )
    ) {
      return;
    }

    run(async () => {
      onChanged(await setCompanyUserDisabled(companyId, user.id, !isDisabled));
    }, "Não foi possível alterar a situação do usuário.");
  }

  return (
    <article className="app-surface-muted rounded-2xl border">
      <form className="space-y-4 p-4" onSubmit={save}>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="font-semibold">{user.name}</h3>
            <p className="text-sm text-base-content/60">
              Usuário desde {formatDate(user.createdAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isDisabled ? (
              <span className="badge badge-error badge-outline">Desativado</span>
            ) : (
              <span className="badge badge-success badge-outline">Ativo</span>
            )}
            {user.mustChangePassword ? (
              <span className="badge badge-warning badge-outline">
                Senha temporária pendente
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
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
        </div>

        {error ? <div className="alert alert-error text-sm">{error}</div> : null}

        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={resetPassword}
            disabled={isPending || isDisabled}
          >
            Gerar nova senha temporária
          </button>
          <button
            type="button"
            className={
              isDisabled
                ? "btn btn-outline btn-sm"
                : "btn btn-outline btn-error btn-sm"
            }
            onClick={toggleDisabled}
            disabled={isPending}
          >
            {isDisabled ? "Reativar" : "Desativar"}
          </button>
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={isPending || !hasChanges}
          >
            Salvar
          </button>
        </div>
      </form>
    </article>
  );
}

export function CompanyUserList({
  companyId,
  users,
  onUserChanged,
  onTemporaryPassword,
}: {
  companyId: number;
  users: CompanyUser[];
  onUserChanged: (user: CompanyUser) => void;
  onTemporaryPassword: (user: CompanyUser, password: string) => void;
}) {
  if (users.length === 0) {
    return (
      <p className="text-sm text-base-content/60">
        Nenhum usuário cadastrado nesta empresa ainda.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {users.map((user) => (
        <CompanyUserCard
          key={user.id}
          companyId={companyId}
          user={user}
          onChanged={onUserChanged}
          onTemporaryPassword={onTemporaryPassword}
        />
      ))}
    </div>
  );
}
