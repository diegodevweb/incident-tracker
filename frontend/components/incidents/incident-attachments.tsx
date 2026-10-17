"use client";

import { useRef, useState, useTransition } from "react";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import { addIncidentAttachments } from "@/lib/api";
import type { Incident } from "@/lib/types";

// Mesmo limite da API por envio.
const MAX_FILES_PER_UPLOAD = 5;

/** Anexos do chamado e o envio de evidência depois de aberto, para os dois papéis. */
export function IncidentAttachments({
  incident,
  onUpdated,
  onRefresh,
}: {
  incident: Incident;
  onUpdated: (incident: Incident) => void;
  onRefresh: () => Promise<void>;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (files.length > MAX_FILES_PER_UPLOAD) {
      setError(`Envie até ${MAX_FILES_PER_UPLOAD} imagens por vez.`);
      return;
    }

    startTransition(async () => {
      try {
        onUpdated(await addIncidentAttachments(incident.id, files));
        setFiles([]);
        if (inputRef.current) {
          inputRef.current.value = "";
        }
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Não foi possível anexar as imagens.",
        );
      }
    });
  }

  return (
    <aside className="app-surface card border">
      <div className="card-body">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Prints e anexos</h3>
            <p className="text-sm text-base-content/60">
              Evidências gerais e anexos cadastrados para o chamado.
            </p>
          </div>
          <RefreshButton label="Atualizar anexos" onRefresh={onRefresh} />
        </div>

        {incident.attachments.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {incident.attachments.map((attachment) => (
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
          <div className="app-surface-muted mt-4 rounded-2xl border border-dashed p-5 text-sm text-base-content/60">
            Nenhum arquivo anexado.
          </div>
        )}

        <form className="mt-6 space-y-3" onSubmit={handleSubmit}>
          <label className="form-control">
            <span className="label-text mb-2">Anexar evidência</span>
            <input
              ref={inputRef}
              type="file"
              accept=".png,.jpg,.jpeg,image/png,image/jpeg"
              multiple
              onChange={(event) =>
                setFiles(Array.from(event.target.files ?? []))
              }
              className="file-input file-input-bordered w-full"
            />
            <span className="mt-2 text-xs text-base-content/60">
              Até {MAX_FILES_PER_UPLOAD} prints por envio, em PNG ou JPEG.
            </span>
          </label>

          {error ? <div className="alert alert-error text-sm">{error}</div> : null}

          <div className="flex justify-end">
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={isPending || !files.length}
            >
              {isPending ? "Enviando..." : "Enviar evidência"}
            </button>
          </div>
        </form>
      </div>
    </aside>
  );
}
