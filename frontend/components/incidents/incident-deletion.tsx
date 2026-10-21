"use client";

import { useState, useTransition } from "react";
import { deleteIncident, restoreIncident } from "@/lib/api";
import type { Incident, UserRole } from "@/lib/types";

// Mesmo limite da API.
const MAX_REASON_LENGTH = 1_000;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function errorMessage(caught: unknown, fallback: string) {
  return caught instanceof Error ? caught.message : fallback;
}

/**
 * Pede o motivo e exclui. O chamado sai das listas, do relatório e dos avisos;
 * o admin pode restaurá-lo pela lixeira.
 */
export function IncidentDeleteForm({
  incident,
  role,
  onCancel,
  onDeleted,
}: {
  incident: Incident;
  role: UserRole;
  onCancel: () => void;
  onDeleted: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        await deleteIncident(incident.id, reason);
        onDeleted();
      } catch (caught) {
        setError(errorMessage(caught, "Não foi possível excluir o chamado."));
      }
    });
  }

  return (
    <form
      className="space-y-3 rounded-2xl border border-error/30 bg-error/5 p-4"
      onSubmit={handleSubmit}
    >
      <div>
        <p className="font-medium">Excluir o chamado #{incident.id}</p>
        <p className="mt-1 text-sm text-base-content/70">
          {role === "ADMIN"
            ? "O chamado sai das listas, do relatório e dos avisos da empresa. Ele fica no filtro Excluídos e pode ser restaurado."
            : "O chamado sai da lista da sua empresa. Se precisar dele de volta, peça à equipe de suporte."}
        </p>
      </div>

      <label className="form-control">
        <span className="label-text mb-2">Motivo da exclusão</span>
        <textarea
          rows={3}
          required
          maxLength={MAX_REASON_LENGTH}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="textarea textarea-bordered w-full"
          placeholder="Ex.: aberto em duplicidade com o chamado #12."
        />
      </label>

      {error ? <div className="alert alert-error text-sm">{error}</div> : null}

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          disabled={isPending}
          onClick={onCancel}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="btn btn-sm btn-error"
          disabled={isPending || !reason.trim()}
        >
          {isPending ? "Excluindo..." : "Excluir chamado"}
        </button>
      </div>
    </form>
  );
}

/** O chamado está na lixeira: quem excluiu, quando, por quê, e o restaurar. */
export function IncidentDeletedNotice({
  incident,
  onRestored,
}: {
  incident: Incident;
  onRestored: (incident: Incident) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!incident.deletedAt) {
    return null;
  }

  function handleRestore() {
    setError(null);
    startTransition(async () => {
      try {
        onRestored(await restoreIncident(incident.id));
      } catch (caught) {
        setError(errorMessage(caught, "Não foi possível restaurar o chamado."));
      }
    });
  }

  return (
    <div className="rounded-3xl border border-warning/40 bg-warning/10 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="font-semibold">Chamado excluído</p>
          <p className="text-sm text-base-content/70">
            Excluído
            {incident.deletedByName ? ` por ${incident.deletedByName}` : ""} em{" "}
            {formatDate(incident.deletedAt)}. Ele não aparece para a empresa,
            nas listas nem no relatório, e não pode ser alterado até ser
            restaurado.
          </p>
          {incident.deletionReason ? (
            <p className="whitespace-pre-wrap break-words text-sm">
              <span className="font-medium">Motivo:</span>{" "}
              {incident.deletionReason}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className="btn btn-sm btn-warning"
          disabled={isPending}
          onClick={handleRestore}
        >
          {isPending ? "Restaurando..." : "Restaurar chamado"}
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-error">{error}</p> : null}
    </div>
  );
}
