"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { ManagedUser } from "@/lib/types";
import { useServerDraft } from "@/lib/use-server-draft";

/** As chamadas da API para um tipo de usuário (de empresa ou admin). */
export type ManagedUserActions = {
  update: (
    userId: number,
    payload: { name: string; email: string },
  ) => Promise<ManagedUser>;
  resetPassword: (userId: number) => Promise<{ temporaryPassword: string }>;
  setDisabled: (userId: number, disabled: boolean) => Promise<ManagedUser>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function ManagedUserCard({
  user,
  actions,
  isSelf,
  disableNote,
  onChanged,
  onTemporaryPassword,
}: {
  user: ManagedUser;
  actions: ManagedUserActions;
  isSelf: boolean;
  disableNote: string;
  onChanged: (user: ManagedUser) => void;
  onTemporaryPassword: (user: ManagedUser, password: string) => void;
}) {
  const [name, setName] = useServerDraft(user.name);
  const [email, setEmail] = useServerDraft(user.email);
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
      const updated = await actions.update(user.id, { name, email });
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
      const { temporaryPassword } = await actions.resetPassword(user.id);
      onTemporaryPassword(user, temporaryPassword);
      onChanged({ ...user, mustChangePassword: true });
    }, "Não foi possível gerar a nova senha.");
  }

  function toggleDisabled() {
    if (
      !isDisabled &&
      !window.confirm(
        `Desativar ${user.name}? A pessoa não consegue mais entrar e as sessões abertas são encerradas. ${disableNote}`,
      )
    ) {
      return;
    }

    run(async () => {
      onChanged(await actions.setDisabled(user.id, !isDisabled));
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
            {isSelf ? (
              <span className="badge badge-primary badge-outline">Você</span>
            ) : null}
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
              disabled={isSelf}
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
              disabled={isSelf}
            />
          </label>
        </div>

        {error ? <div className="alert alert-error text-sm">{error}</div> : null}

        {isSelf ? (
          // A API recusa mudanças na própria conta por aqui (a troca de senha do perfil pede a atual).
          <p className="text-sm text-base-content/60">
            Seu nome e sua senha mudam em{" "}
            <Link href="/dashboard/profile" className="link link-primary">
              Meu perfil
            </Link>
            .
          </p>
        ) : (
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
        )}
      </form>
    </article>
  );
}

export function ManagedUserList({
  users,
  actions,
  currentUserId,
  disableNote,
  emptyMessage,
  onUserChanged,
  onTemporaryPassword,
}: {
  users: ManagedUser[];
  actions: ManagedUserActions;
  /** Quem está logado: o card dessa pessoa fica só para leitura. */
  currentUserId?: number;
  /** Completa o aviso de desativação: o que acontece com o que a pessoa fez. */
  disableNote: string;
  emptyMessage: string;
  onUserChanged: (user: ManagedUser) => void;
  onTemporaryPassword: (user: ManagedUser, password: string) => void;
}) {
  if (users.length === 0) {
    return <p className="text-sm text-base-content/60">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-3">
      {users.map((user) => (
        <ManagedUserCard
          key={user.id}
          user={user}
          actions={actions}
          isSelf={user.id === currentUserId}
          disableNote={disableNote}
          onChanged={onUserChanged}
          onTemporaryPassword={onTemporaryPassword}
        />
      ))}
    </div>
  );
}
