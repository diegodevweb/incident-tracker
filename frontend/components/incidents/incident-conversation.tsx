"use client";

import { useState, useTransition } from "react";
import { addIncidentComment } from "@/lib/api";
import type { Incident, UserRole } from "@/lib/types";

// Mesmo limite da API.
const MAX_MESSAGE_LENGTH = 10_000;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

/**
 * Conversa entre a empresa e a equipe. O admin escreve quando quiser; o
 * cliente responde depois que a equipe mandou a primeira mensagem (a API
 * confere a mesma regra).
 */
export function IncidentConversation({
  incident,
  role,
  onUpdated,
}: {
  incident: Incident;
  role: UserRole;
  onUpdated: (incident: Incident) => void;
}) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const comments = incident.comments;
  const canWrite =
    role === "ADMIN" ||
    comments.some((comment) => comment.authorRole === "ADMIN");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        onUpdated(await addIncidentComment(incident.id, message));
        setMessage("");
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Não foi possível enviar a mensagem.",
        );
      }
    });
  }

  return (
    <section className="app-surface card border">
      <div className="card-body gap-6">
        <div>
          <h3 className="text-lg font-semibold">Conversa</h3>
          <p className="text-sm text-base-content/60">
            {role === "ADMIN"
              ? "Mensagens trocadas com a empresa sobre este chamado."
              : "Mensagens trocadas com a equipe de suporte sobre este chamado."}
          </p>
        </div>

        {comments.length ? (
          <ol className="space-y-3">
            {comments.map((comment) => (
              <li
                key={comment.id}
                className={`rounded-2xl border p-4 ${
                  comment.authorRole === "ADMIN"
                    ? "border-primary/30 bg-primary/5"
                    : "app-surface-muted"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{comment.authorName}</span>
                  {comment.authorRole === "ADMIN" ? (
                    <span className="badge badge-primary badge-sm">Suporte</span>
                  ) : null}
                  <span className="text-base-content/55">
                    {formatDate(comment.createdAt)}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">
                  {comment.message}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <div className="app-surface-muted rounded-2xl border border-dashed p-5 text-sm text-base-content/60">
            {role === "ADMIN"
              ? "Nenhuma mensagem ainda. Depois da primeira resposta da equipe, a empresa também pode escrever aqui."
              : "Nenhuma mensagem ainda."}
          </div>
        )}

        {canWrite ? (
          <form className="space-y-3" onSubmit={handleSubmit}>
            <label className="form-control">
              <span className="label-text mb-2">
                {role === "ADMIN" ? "Responder à empresa" : "Responder à equipe"}
              </span>
              <textarea
                rows={4}
                required
                maxLength={MAX_MESSAGE_LENGTH}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="textarea textarea-bordered w-full"
                placeholder={
                  role === "ADMIN"
                    ? "Escreva para a empresa: andamento, pedido de informação, orientação."
                    : "Acrescente informações, responda à equipe ou avise se o problema mudou."
                }
              />
            </label>

            {error ? <div className="alert alert-error text-sm">{error}</div> : null}

            <div className="flex justify-end">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isPending || !message.trim()}
              >
                {isPending ? "Enviando..." : "Enviar mensagem"}
              </button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-base-content/60">
            Você poderá responder aqui assim que a equipe de suporte enviar a
            primeira mensagem. Enquanto isso, acompanhe o status e anexe
            evidências no chamado.
          </p>
        )}
      </div>
    </section>
  );
}
