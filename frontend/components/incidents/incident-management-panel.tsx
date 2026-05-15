"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateIncident } from "@/lib/api";
import { incidentStatusLabel } from "@/lib/labels";
import type { Incident, IncidentStatus, UserRole } from "@/lib/types";

const statusOptions: IncidentStatus[] = ["OPEN", "PENDING", "IN_PROGRESS", "RESOLVED"];

export function IncidentManagementPanel({
  incident,
  role,
}: {
  incident: Incident;
  role: UserRole;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<IncidentStatus>(incident.status);
  const [correctiveActions, setCorrectiveActions] = useState(
    incident.correctiveActions ?? "",
  );
  const [correctiveAttachmentFiles, setCorrectiveAttachmentFiles] = useState<File[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const readOnly = role === "CLIENT";
  const correctiveAttachments = incident.attachments.filter(
    (attachment) => attachment.category === "CORRECTIVE_ACTION",
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setError(null);

    startTransition(async () => {
      try {
        await updateIncident(incident.id, {
          status,
          correctiveActions,
          correctiveActionAttachments: correctiveAttachmentFiles,
        });
        setFeedback("Chamado atualizado com sucesso.");
        router.refresh();
      } catch {
        setError("Não foi possível atualizar o chamado.");
      }
    });
  }

  function handleAttachmentChange(event: React.ChangeEvent<HTMLInputElement>) {
    setCorrectiveAttachmentFiles(Array.from(event.target.files ?? []));
  }

  return (
    <section className="app-surface card border">
      <div className="card-body gap-6">
        <div>
          <h3 className="text-lg font-semibold">Gestão do chamado</h3>
          <p className="text-sm text-base-content/60">
            Atualize status, descreva a ação corretiva executada e relacione prints da solução.
          </p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <label className="form-control">
            <span className="label-text mb-2">Status do chamado</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as IncidentStatus)}
              className="select select-bordered w-full"
              disabled={readOnly}
            >
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {incidentStatusLabel[option]}
                </option>
              ))}
            </select>
          </label>

          <label className="form-control">
            <span className="label-text mb-2">Ações corretivas</span>
            <textarea
              rows={6}
              value={correctiveActions}
              onChange={(event) => setCorrectiveActions(event.target.value)}
              className="textarea textarea-bordered w-full"
              placeholder="Descreva o que foi feito para resolver o incidente."
              disabled={readOnly}
            />
          </label>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">Prints da correção</p>
                <p className="text-sm text-base-content/60">
                  Anexe arquivos da correção para salvar no armazenamento do chamado.
                </p>
              </div>
            </div>

            {!readOnly ? (
              <label className="form-control">
                <span className="label-text mb-2">Adicionar novos prints</span>
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                  multiple
                  onChange={handleAttachmentChange}
                  className="file-input file-input-bordered w-full"
                />
                {correctiveAttachmentFiles.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {correctiveAttachmentFiles.map((file) => (
                      <span
                        key={`${file.name}-${file.size}`}
                        className="badge badge-outline"
                      >
                        {file.name}
                      </span>
                    ))}
                  </div>
                ) : null}
              </label>
            ) : null}

            {correctiveAttachments.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {correctiveAttachments.map((attachment) => (
                  <a
                    key={attachment.id}
                    href={attachment.url}
                    target="_blank"
                    rel="noreferrer"
                    className="app-surface-muted rounded-2xl border p-4"
                  >
                    <p className="font-medium">{attachment.filename}</p>
                    <p className="mt-1 text-sm text-base-content/60">
                      {attachment.mimeType}
                    </p>
                  </a>
                ))}
              </div>
            ) : (
              <div className="app-surface-muted rounded-2xl border border-dashed p-4 text-sm text-base-content/60">
                Nenhum print informado.
              </div>
            )}
          </div>

          {feedback ? <div className="alert alert-success text-sm">{feedback}</div> : null}
          {error ? <div className="alert alert-error text-sm">{error}</div> : null}

          {!readOnly ? (
            <div className="flex justify-end">
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                {isPending ? "Salvando..." : "Salvar atualização"}
              </button>
            </div>
          ) : null}
        </form>
      </div>
    </section>
  );
}
