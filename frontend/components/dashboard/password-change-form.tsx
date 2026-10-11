"use client";

import { useState, useTransition } from "react";
import { changePassword } from "@/lib/api";

// Mesma regra do backend (password-policy.ts); lá ela é conferida de verdade.
const MIN_PASSWORD_LENGTH = 12;

export function PasswordChangeForm({
  currentPasswordLabel = "Senha atual",
  submitLabel = "Atualizar senha",
  onChanged,
}: {
  currentPasswordLabel?: string;
  submitLabel?: string;
  onChanged: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (newPassword !== confirmation) {
      setError("A confirmação não confere com a nova senha.");
      return;
    }

    startTransition(async () => {
      try {
        await changePassword({ currentPassword, newPassword });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmation("");
        onChanged();
      } catch (caught) {
        // A mensagem do backend diz o que falta (senha atual, política...).
        setError(
          caught instanceof Error
            ? caught.message
            : "Não foi possível trocar a senha.",
        );
      }
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="form-control">
          <span className="label-text mb-2">{currentPasswordLabel}</span>
          <input
            required
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="input input-bordered w-full"
          />
        </label>
        <label className="form-control">
          <span className="label-text mb-2">Nova senha</span>
          <input
            required
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="input input-bordered w-full"
          />
        </label>
        <label className="form-control">
          <span className="label-text mb-2">Confirmar nova senha</span>
          <input
            required
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            className="input input-bordered w-full"
          />
        </label>
      </div>

      <p className="text-sm text-base-content/60">
        Pelo menos {MIN_PASSWORD_LENGTH} caracteres. Uma frase longa funciona
        bem; evite sequências, senhas comuns e o início do seu e-mail.
      </p>

      {error ? <div className="alert alert-error text-sm">{error}</div> : null}

      <div className="flex justify-end">
        <button type="submit" className="btn btn-primary" disabled={isPending}>
          {isPending ? "Salvando..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
