"use client";

import { useRef, useState, useTransition } from "react";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import { updateIncident } from "@/lib/api";
import { getIncidentPriorityLabel, incidentStatusLabel } from "@/lib/labels";
import type {
  Incident,
  IncidentAttachment,
  IncidentLevel,
  IncidentStatus,
  UserRole,
} from "@/lib/types";
import { useServerDraft } from "@/lib/use-server-draft";
import { IncidentPriorityBadge } from "./incident-priority-badge";
import { IncidentStatusBadge } from "./incident-status-badge";
import { SlaRuleList, useSlaRules } from "./sla-rules";

const statusOptions: IncidentStatus[] = ["OPEN", "PENDING", "IN_PROGRESS", "RESOLVED"];
const priorityOptions: IncidentLevel[] = ["CRITICAL", "ERROR", "WARNING", "INFO"];

// O que cada status quer dizer para quem abriu o chamado.
const clientStatusHint: Record<IncidentStatus, string> = {
  OPEN: "Recebemos seu chamado. Ele está na fila da equipe de suporte e será analisado em breve.",
  PENDING:
    "O atendimento está aguardando para seguir. Se a equipe precisar de alguma informação sua, ela vai pedir na conversa.",
  IN_PROGRESS: "A equipe de suporte está trabalhando na solução.",
  RESOLVED: "Atendimento concluído.",
};

/** Admin gerencia o atendimento; o cliente acompanha o andamento e a solução. */
export function IncidentManagementPanel({
  incident,
  role,
  onUpdated,
  onRefresh,
}: {
  incident: Incident;
  role: UserRole;
  onUpdated: (incident: Incident) => void;
  onRefresh: () => Promise<void>;
}) {
  if (role === "CLIENT") {
    return <IncidentFollowUp incident={incident} onRefresh={onRefresh} />;
  }

  return (
    <IncidentManagementForm
      incident={incident}
      onUpdated={onUpdated}
      onRefresh={onRefresh}
    />
  );
}

function getCorrectiveAttachments(incident: Incident) {
  return incident.attachments.filter(
    (attachment) => attachment.category === "CORRECTIVE_ACTION",
  );
}

function AttachmentLinks({ attachments }: { attachments: IncidentAttachment[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {attachments.map((attachment) => (
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
  );
}

function IncidentFollowUp({
  incident,
  onRefresh,
}: {
  incident: Incident;
  onRefresh: () => Promise<void>;
}) {
  const solution = incident.correctiveActions?.trim();
  const solutionAttachments = getCorrectiveAttachments(incident);
  const resolved = incident.status === "RESOLVED";
  const slaRules = useSlaRules();
  const currentRule = slaRules?.find((rule) => rule.priority === incident.priority);

  return (
    <section className="app-surface card border">
      <div className="card-body gap-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Acompanhamento do chamado</h3>
            <p className="text-sm text-base-content/60">
              Em que etapa está o atendimento e o que a equipe de suporte fez
              para resolver.
            </p>
          </div>
          <RefreshButton
            label="Atualizar acompanhamento"
            onRefresh={onRefresh}
          />
        </div>

        <div className="app-surface-muted flex flex-wrap items-center gap-3 rounded-2xl border p-4">
          <IncidentStatusBadge status={incident.status} />
          <p className="text-sm text-base-content/70">
            {clientStatusHint[incident.status]}
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-medium">Criticidade</p>
            <IncidentPriorityBadge
              priority={incident.priority}
              source={incident.source}
            />
            {currentRule ? (
              <span className="text-sm text-base-content/60">
                Primeira resposta {currentRule.firstResponseTarget}
              </span>
            ) : null}
          </div>
          <details className="app-surface-muted rounded-2xl border p-4">
            <summary className="cursor-pointer text-sm font-medium">
              O que significa cada criticidade
            </summary>
            <p className="mt-2 text-sm text-base-content/60">
              A equipe pode ajustar a criticidade depois de analisar o impacto.
            </p>
            <div className="mt-3">
              <SlaRuleList
                rules={slaRules}
                source={incident.source}
                current={incident.priority}
              />
            </div>
          </details>
        </div>

        <div className="space-y-3">
          <p className="font-medium">Solução aplicada</p>
          {solution ? (
            <p className="whitespace-pre-wrap break-words text-sm leading-6">
              {solution}
            </p>
          ) : (
            <div className="app-surface-muted rounded-2xl border border-dashed p-4 text-sm text-base-content/60">
              {resolved
                ? "Nenhuma solução foi registrada pela equipe para este chamado."
                : "A equipe ainda não registrou a solução. Ela aparece aqui assim que for informada."}
            </div>
          )}
        </div>

        {solutionAttachments.length ? (
          <div className="space-y-3">
            <div>
              <p className="font-medium">Prints da solução</p>
              <p className="text-sm text-base-content/60">
                Imagens enviadas pela equipe mostrando a correção.
              </p>
            </div>
            <AttachmentLinks attachments={solutionAttachments} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function IncidentManagementForm({
  incident,
  onUpdated,
  onRefresh,
}: {
  incident: Incident;
  onUpdated: (incident: Incident) => void;
  onRefresh: () => Promise<void>;
}) {
  // Ao atualizar o card, os campos que o admin não mexeu passam a mostrar o
  // que está no servidor (o cliente pode ter encerrado ou reaberto o chamado).
  const [status, setStatus] = useServerDraft<IncidentStatus>(incident.status);
  const [priority, setPriority] = useServerDraft<IncidentLevel>(
    incident.priority,
  );
  const [correctiveActions, setCorrectiveActions] = useServerDraft(
    incident.correctiveActions ?? "",
  );
  const [correctiveAttachmentFiles, setCorrectiveAttachmentFiles] = useState<File[]>([]);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const correctiveAttachments = getCorrectiveAttachments(incident);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setError(null);

    startTransition(async () => {
      try {
        const updatedIncident = await updateIncident(incident.id, {
          status,
          priority,
          correctiveActions,
          correctiveAttachments: correctiveAttachmentFiles,
        });
        onUpdated(updatedIncident);
        setCorrectiveAttachmentFiles([]);
        if (attachmentInputRef.current) {
          attachmentInputRef.current.value = "";
        }
        setFeedback("Chamado atualizado com sucesso.");
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
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Gestão do chamado</h3>
            <p className="text-sm text-base-content/60">
              Atualize status e criticidade, descreva a ação corretiva executada e relacione prints da solução. A empresa é avisada no painel.
            </p>
          </div>
          <RefreshButton
            label="Atualizar gestão do chamado"
            onRefresh={onRefresh}
          />
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="form-control">
              <span className="label-text mb-2">Status do chamado</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as IncidentStatus)}
                className="select select-bordered w-full"
              >
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {incidentStatusLabel[option]}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-control">
              <span className="label-text mb-2">Criticidade</span>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as IncidentLevel)}
                className="select select-bordered w-full"
              >
                {priorityOptions.map((option) => (
                  <option key={option} value={option}>
                    {getIncidentPriorityLabel(option, incident.source)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="form-control">
            <span className="label-text mb-2">Ações corretivas</span>
            <textarea
              rows={6}
              value={correctiveActions}
              onChange={(event) => setCorrectiveActions(event.target.value)}
              className="textarea textarea-bordered w-full"
              placeholder="Descreva o que foi feito para resolver o incidente."
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

            <label className="form-control">
              <span className="label-text mb-2">Adicionar novos prints</span>
              <input
                ref={attachmentInputRef}
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

            {correctiveAttachments.length ? (
              <AttachmentLinks attachments={correctiveAttachments} />
            ) : (
              <div className="app-surface-muted rounded-2xl border border-dashed p-4 text-sm text-base-content/60">
                Nenhum print informado.
              </div>
            )}
          </div>

          {feedback ? <div className="alert alert-success text-sm">{feedback}</div> : null}
          {error ? <div className="alert alert-error text-sm">{error}</div> : null}

          <div className="flex justify-end">
            <button type="submit" className="btn btn-primary" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar atualização"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
