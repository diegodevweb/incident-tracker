"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ApiError, createIncident } from "@/lib/api";
import {
  dashboardIncidentPriorityLabel,
  incidentEnvironmentLabel,
  userRoleLabel,
} from "@/lib/labels";
import { CompanyPicker } from "@/components/companies/company-picker";
import { useAuthSession } from "@/components/dashboard/auth-session-provider";
import type { IncidentEnvironment, IncidentLevel } from "@/lib/types";
import { SlaRuleList, useSlaRules } from "./sla-rules";

const priorityOptions: IncidentLevel[] = ["CRITICAL", "ERROR", "WARNING", "INFO"];
const environmentOptions: IncidentEnvironment[] = ["production", "staging", "local"];

function RequiredMark() {
  return <span className="text-error"> *</span>;
}

export function NewIncidentForm() {
  const router = useRouter();
  const session = useAuthSession();
  const role = session?.user.role ?? "CLIENT";
  // Quem abre é quem mais sabe do problema: o cliente escolhe a criticidade
  // (sem valor pré-marcado) e manda ao menos um print. A API confere o mesmo.
  const isClient = role === "CLIENT";
  const slaRules = useSlaRules();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [environment, setEnvironment] = useState<IncidentEnvironment>("production");
  const [priority, setPriority] = useState<IncidentLevel | "">(
    isClient ? "" : "ERROR",
  );
  const [contactName, setContactName] = useState(session?.user.name ?? "");
  const [contactEmail, setContactEmail] = useState(session?.user.email ?? "");
  const [companyId, setCompanyId] = useState("");
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!session) {
      router.replace("/login");
      return;
    }
  }, [router, session]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // O cliente abre na própria empresa; o admin escolhe em nome de qual.
    if (role === "ADMIN" && !companyId) {
      setErrorMessage("Escolha a empresa do ticket.");
      return;
    }

    if (!priority) {
      setErrorMessage("Escolha a criticidade do problema.");
      return;
    }

    if (isClient && !attachmentFiles.length) {
      setErrorMessage("Anexe ao menos um print do problema.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await createIncident({
          companyId: role === "ADMIN" ? Number(companyId) : undefined,
          title,
          description,
          environment,
          priority,
          attachments: attachmentFiles,
        });

        setSuccessMessage(result.message || "Ticket criado com sucesso.");
        router.push(`/dashboard/incidents/${result.incident.id}`);
      } catch (caught) {
        setErrorMessage(
          caught instanceof ApiError
            ? caught.message
            : "Não foi possível abrir o ticket.",
        );
      }
    });
  }

  function handleAttachmentChange(event: React.ChangeEvent<HTMLInputElement>) {
    setAttachmentFiles(Array.from(event.target.files ?? []));
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="app-surface card border">
        <div className="card-body gap-6">
          <div>
            <div className="badge badge-outline">{userRoleLabel[role]}</div>
            <h2 className="mt-3 text-xl font-semibold tracking-tight">
              Registrar novo ticket
            </h2>
            <p className="mt-1 text-sm text-base-content/60">
              Descreva o impacto, o ambiente afetado e inclua o melhor contexto
              possível para acelerar o atendimento.
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="form-control md:col-span-2">
                <span className="label-text mb-2">
                  Resumo do problema
                  <RequiredMark />
                </span>
                <input
                  required
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Ex.: Falha ao emitir pedido no caixa"
                  className="input input-bordered w-full"
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-2">Ambiente</span>
                <select
                  value={environment}
                  onChange={(event) =>
                    setEnvironment(event.target.value as IncidentEnvironment)
                  }
                  className="select select-bordered w-full"
                >
                  {environmentOptions.map((option) => (
                    <option key={option} value={option}>
                      {incidentEnvironmentLabel[option]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-control">
                <span className="label-text mb-2">
                  Criticidade
                  <RequiredMark />
                </span>
                <select
                  required
                  value={priority}
                  onChange={(event) =>
                    setPriority(event.target.value as IncidentLevel)
                  }
                  className="select select-bordered w-full"
                >
                  {isClient ? (
                    <option value="" disabled>
                      Escolha conforme o impacto
                    </option>
                  ) : null}
                  {priorityOptions.map((option) => (
                    <option key={option} value={option}>
                      {dashboardIncidentPriorityLabel[option]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-control md:col-span-2">
                <span className="label-text mb-2">
                  Descrição detalhada
                  <RequiredMark />
                </span>
                <textarea
                  required
                  rows={6}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Informe sintomas, passos para reproduzir, horário do impacto e qualquer contorno já tentado."
                  className="textarea textarea-bordered w-full"
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-2">Responsável pelo envio</span>
                <input
                  type="text"
                  value={contactName}
                  onChange={(event) => setContactName(event.target.value)}
                  className="input input-bordered w-full"
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-2">E-mail do responsável</span>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                  className="input input-bordered w-full"
                />
              </label>

              {role === "ADMIN" ? (
                <CompanyPicker value={companyId} onChange={setCompanyId} />
              ) : null}

              <div className="form-control md:col-span-2">
                <span className="label-text mb-2">
                  Anexar evidência
                  {isClient ? <RequiredMark /> : null}
                </span>
                <input
                  required={isClient}
                  type="file"
                  accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                  multiple
                  onChange={handleAttachmentChange}
                  className="file-input file-input-bordered w-full"
                />
                <span className="mt-2 text-xs text-base-content/60">
                  {isClient
                    ? "Envie ao menos um print do erro (até 5), em .png, .jpg ou .jpeg."
                    : "Envie prints em .png, .jpg ou .jpeg."}
                </span>
                {attachmentFiles.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {attachmentFiles.map((file) => (
                      <span
                        key={`${file.name}-${file.size}`}
                        className="badge badge-outline"
                      >
                        {file.name}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {errorMessage ? (
              <div className="alert alert-error text-sm">{errorMessage}</div>
            ) : null}

            {successMessage ? (
              <div className="alert alert-success text-sm">{successMessage}</div>
            ) : null}

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => router.push("/dashboard/incidents")}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                {isPending ? "Abrindo ticket..." : "Abrir ticket"}
              </button>
            </div>
          </form>
        </div>
      </section>

      <aside className="space-y-4">
        <section className="app-surface-muted rounded-3xl border p-5">
          <p className="text-sm font-medium">Conta vinculada</p>
          <p className="mt-2 text-xl font-semibold">{contactName || "Usuário autenticado"}</p>
          <p className="mt-3 text-sm text-base-content/60">
            {contactEmail || "Sessão em andamento"}
          </p>
        </section>

        <section className="app-surface-muted rounded-3xl border p-5">
          <h3 className="text-base font-semibold">Checklist mínimo</h3>
          <ul className="mt-3 space-y-2 text-sm text-base-content/70">
            <li>Informar o fluxo afetado e o horário aproximado do erro.</li>
            <li>Indicar se o problema ocorre em produção ou homologação.</li>
            <li>
              {isClient
                ? "Anexar ao menos um print que mostre o erro."
                : "Adicionar evidências ou observações."}
            </li>
          </ul>
        </section>

        <section className="app-surface-muted rounded-3xl border p-5">
          <h3 className="text-base font-semibold">Níveis de criticidade</h3>
          <p className="mt-1 text-sm text-base-content/60">
            Escolha pelo impacto na operação. O prazo é o da primeira resposta
            da equipe.
          </p>
          <div className="mt-3">
            <SlaRuleList rules={slaRules} current={priority} />
          </div>
        </section>
      </aside>
    </div>
  );
}
