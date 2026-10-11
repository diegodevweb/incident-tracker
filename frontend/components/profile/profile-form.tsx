"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PasswordChangeForm } from "@/components/dashboard/password-change-form";
import { updateAccount } from "@/lib/api";
import type { AccountProfile } from "@/lib/types";

export function ProfileForm({
  account,
  onUpdated,
}: {
  account: AccountProfile;
  onUpdated: (account: AccountProfile) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(account.name);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    startTransition(async () => {
      try {
        const updated = await updateAccount({ name });
        onUpdated(updated);
        setMessage("Nome atualizado.");
        // A barra lateral e o topo leem o nome do cookie da sessão, que a
        // rota do Next já regravou.
        router.refresh();
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Não foi possível salvar o nome.",
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="app-surface card border">
        <form className="card-body gap-6" onSubmit={handleSubmit}>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Dados da conta</h2>
            <p className="mt-1 text-sm text-base-content/60">
              O e-mail é o seu login; para trocá-lo, fale com o administrador.
            </p>
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
              <span className="label-text mb-2">E-mail</span>
              <input
                type="email"
                value={account.email}
                readOnly
                className="input input-bordered w-full"
              />
            </label>
          </div>

          {message ? <div className="alert alert-success text-sm">{message}</div> : null}
          {error ? <div className="alert alert-error text-sm">{error}</div> : null}

          <div className="flex justify-end">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isPending || name.trim() === account.name}
            >
              {isPending ? "Salvando..." : "Salvar nome"}
            </button>
          </div>
        </form>
      </section>

      <section className="app-surface card border">
        <div className="card-body gap-6">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Senha</h2>
            <p className="mt-1 text-sm text-base-content/60">
              Ao trocar a senha, as outras sessões abertas com a sua conta são
              encerradas.
            </p>
          </div>

          {passwordMessage ? (
            <div className="alert alert-success text-sm">{passwordMessage}</div>
          ) : null}

          <PasswordChangeForm
            onChanged={() =>
              setPasswordMessage(
                "Senha alterada. As outras sessões foram encerradas.",
              )
            }
          />
        </div>
      </section>
    </div>
  );
}
