"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { createPreventiveAction } from "@/lib/api";
import {
  getIncidentPriorityLabel,
  incidentPriorityLabel,
  incidentSourceLabel,
  incidentStatusLabel,
  reportExecutionStatusLabel,
} from "@/lib/labels";
import type { MonthlyReport } from "@/lib/types";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(new Date(value));
}

function formatMonthYear(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

export function MonthlyReportView({
  report,
  onReportRefresh,
}: {
  report: MonthlyReport;
  onReportRefresh?: () => void;
}) {
  const pathname = usePathname();
  const [preventiveAction, setPreventiveAction] = useState("");
  const [relatedIncidentId, setRelatedIncidentId] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const incidentOptions = Array.from(
    new Map(
      report.entries.map((entry) => [
        entry.incidentId,
        { id: entry.incidentId, title: entry.title },
      ]),
    ).values(),
  );
  const reportPeriodStart = new Date(report.periodStart);
  const reportPeriodEnd = new Date(report.periodEnd);
  const correctiveActionsInPeriod = report.correctiveActions.filter((action) => {
    const createdAt = new Date(action.createdAt);
    return createdAt >= reportPeriodStart && createdAt <= reportPeriodEnd;
  });

  function handlePreventiveActionSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setSubmitError(null);

    startTransition(async () => {
      try {
        await createPreventiveAction({
          description: preventiveAction,
          incidentId: relatedIncidentId ? Number(relatedIncidentId) : undefined,
        });
        setPreventiveAction("");
        setRelatedIncidentId("");
        onReportRefresh?.();
      } catch {
        setSubmitError("Não foi possível cadastrar a ação preventiva.");
      }
    });
  }

  return (
    <div className="max-w-full overflow-x-hidden space-y-6">
      <section className="app-surface card border">
        <div className="card-body gap-6">
          <form action={pathname} method="get" className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  Relatório técnico mensal
                </h2>
                <p className="mt-1 text-sm text-base-content/60">
                  Consolidado mensal com incidentes, criticidade, ações e
                  indicadores técnicos previstos em contrato.
                </p>
              </div>
              <button type="button" className="btn btn-outline">
                Exportar PDF
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto_auto]">
              <label className="form-control">
                <span className="label-text mb-2">Período inicial</span>
                <input
                  type="date"
                  name="startDate"
                  defaultValue={report.periodStart.slice(0, 10)}
                  className="input input-bordered w-full"
                  required
                />
              </label>
              <label className="form-control">
                <span className="label-text mb-2">Período final</span>
                <input
                  type="date"
                  name="endDate"
                  defaultValue={report.periodEnd.slice(0, 10)}
                  className="input input-bordered w-full"
                  required
                />
              </label>
              <div className="flex items-end">
                <button type="submit" className="btn btn-primary w-full md:w-auto">
                  Filtrar relatório
                </button>
              </div>
              <div className="flex items-end">
                <div className="app-surface-muted rounded-2xl border px-4 py-3 text-sm text-base-content/70">
                  {report.entries.length} incidente(s) no período
                </div>
              </div>
            </div>
          </form>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="app-surface-muted rounded-2xl border p-4">
              <p className="text-sm text-base-content/60">Competência</p>
              <p className="mt-2 text-2xl font-semibold capitalize">
                {report.monthLabel}
              </p>
            </div>
            <div className="app-surface-muted rounded-2xl border p-4">
              <p className="text-sm text-base-content/60">Gerado em</p>
              <p className="mt-2 text-sm font-medium">
                {formatDateTime(report.generatedAt)}
              </p>
            </div>
            <div className="app-surface-muted rounded-2xl border p-4">
              <p className="text-sm text-base-content/60">
                Incidentes no período
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {report.entries.length}
              </p>
            </div>
            <div className="app-surface-muted rounded-2xl border p-4">
              <p className="text-sm text-base-content/60">
                Críticos no período
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {
                  report.entries.filter(
                    (entry) => entry.priority === "CRITICAL",
                  ).length
                }
              </p>
            </div>
          </div>

          <div className="app-surface-muted rounded-2xl border p-4 text-sm text-base-content/70">
            Relatório técnico limitado às atividades previstas em contrato, sem
            natureza de auditoria, perícia técnica ou laudo judicial.
          </div>
        </div>
      </section>

      <details open className="app-surface rounded-3xl border">
        <summary className="cursor-pointer list-none px-6 py-5">
          <h3 className="text-lg font-semibold">SLA por criticidade</h3>
          <p className="text-sm text-base-content/60">
            Clique para recolher ou expandir
          </p>
        </summary>
        <div className="px-6 pb-6">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Criticidade</th>
                  <th>Descrição</th>
                  <th>SLA</th>
                </tr>
              </thead>
              <tbody>
                {report.slaRules.map((rule) => (
                  <tr key={rule.priority}>
                    <td className="font-medium">
                      {incidentPriorityLabel[rule.priority]}
                    </td>
                    <td>
                      <div>
                        <p className="font-medium">{rule.title}</p>
                        <p className="text-sm text-base-content/60">
                          {rule.description}
                        </p>
                      </div>
                    </td>
                    <td>{rule.firstResponseTarget}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>

      <details open className="app-surface rounded-3xl border">
        <summary className="cursor-pointer list-none px-6 py-5">
          <h3 className="text-lg font-semibold">
            Incidentes atendidos no período
          </h3>
          <p className="text-sm text-base-content/60">
            Clique para recolher ou expandir
          </p>
        </summary>
        <div className="px-6 pb-6">
          <div className="px-6 pb-6">
            <table className="table table-zebra w-full table-fixed">
              <thead>
                <tr>
                  <th className="w-32">Ticket</th>
                  <th className="w-24">Cliente</th>
                  <th className="w-28">Status</th>
                  <th className="w-36">Data/Hora</th>
                  <th className="w-24">Tipo</th>
                  <th className="w-24">Origem</th>
                  <th className="w-20">SLA</th>
                  <th className="w-24">Criticidade</th>
                  <th>Descrição</th>
                  <th>Último log</th>
                </tr>
              </thead>
              <tbody>
                {report.entries.map((entry) => (
                  <tr key={entry.incidentId}>
                    <td className="truncate">
                      <Link
                        href={`/dashboard/incidents/${entry.incidentId}`}
                        className="link link-hover font-medium"
                      >
                        #{entry.incidentId} {entry.title}
                      </Link>
                    </td>
                    <td className="truncate">{entry.clientName}</td>
                    <td className="truncate">
                      {entry.status ? incidentStatusLabel[entry.status] : "-"}
                    </td>
                    <td className="whitespace-nowrap text-sm">
                      {entry.date} {entry.time}
                    </td>
                    <td className="truncate">
                      {incidentPriorityLabel[entry.errorType]}
                    </td>
                    <td className="truncate">
                      {incidentSourceLabel[entry.source]}
                    </td>
                    <td className="truncate" title={entry.slaTarget}>{entry.slaTarget}</td>
                    <td className="truncate">
                      {getIncidentPriorityLabel(entry.priority, entry.source)}
                    </td>
                    <td className="truncate text-sm" title={entry.description}>
                      {entry.description}
                    </td>
                    <td
                      className="truncate text-sm text-base-content/70"
                      title={entry.latestLogMessage ?? "Sem log adicional"}
                    >
                      {entry.latestLogMessage ?? "Sem log adicional"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>

      <section className="grid max-w-full gap-6 overflow-hidden xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
        <article className="app-surface card border">
          <div className="card-body">
            <h3 className="text-lg font-semibold">Ações corretivas</h3>
            <p className="text-sm text-base-content/60">
              Lista das ações registradas nos chamados dentro do período
              filtrado.
            </p>
            <div className="mt-4 overflow-x-auto">
              {correctiveActionsInPeriod.length ? (
                <table className="table table-zebra w-full">
                  <thead>
                    <tr>
                      <th>Chamado</th>
                      <th>Competência</th>
                      <th>Status</th>
                      <th>Data</th>
                      <th>Ação corretiva</th>
                      <th>Anexos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {correctiveActionsInPeriod.map((action) => (
                      <tr key={`${action.incidentId}-${action.createdAt}`}>
                        <td className="min-w-64">
                          <Link
                            href={`/dashboard/incidents/${action.incidentId}`}
                            className="link link-hover font-medium"
                          >
                            #{action.incidentId} {action.title}
                          </Link>
                        </td>
                        <td className="capitalize">
                          {formatMonthYear(action.createdAt)}
                        </td>
                        <td>{incidentStatusLabel[action.status]}</td>
                        <td className="whitespace-nowrap">
                          {formatDate(action.createdAt)}
                        </td>
                        <td className="min-w-80 text-sm text-base-content/75">
                          {action.description ?? "-"}
                        </td>
                        <td>
                          {action.attachments.length ? (
                            <div className="flex flex-wrap gap-2">
                              {action.attachments.map((attachment) => (
                                <a
                                  key={attachment.id}
                                  href={attachment.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="badge badge-outline"
                                >
                                  {attachment.filename}
                                </a>
                              ))}
                            </div>
                          ) : (
                            <span className="text-sm text-base-content/50">
                              Sem anexos
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="app-surface-muted w-full rounded-2xl border border-dashed p-5 text-sm text-base-content/60">
                  Nenhuma ação corretiva cadastrada no período.
                </div>
              )}
            </div>
          </div>
        </article>

        <article className="app-surface card border">
          <div className="card-body">
            <h3 className="text-lg font-semibold">Ações preventivas</h3>
            <p className="text-sm text-base-content/60">
              Cadastre medidas preventivas e relacione com um chamado quando
              fizer sentido.
            </p>

            <form
              className="mt-4 space-y-4"
              onSubmit={handlePreventiveActionSubmit}
            >
              <label className="form-control">
                <span className="label-text mb-2">Nova ação preventiva</span>
                <textarea
                  required
                  rows={3}
                  value={preventiveAction}
                  onChange={(event) => setPreventiveAction(event.target.value)}
                  className="textarea textarea-bordered w-full"
                  placeholder="Descreva a medida preventiva adotada."
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-2">Relacionar a um chamado</span>
                <select
                  className="select select-bordered w-full"
                  value={relatedIncidentId}
                  onChange={(event) => setRelatedIncidentId(event.target.value)}
                >
                  <option value="">Opcional</option>
                  {incidentOptions.map((incident) => (
                    <option key={incident.id} value={incident.id}>
                      #{incident.id} {incident.title}
                    </option>
                  ))}
                </select>
              </label>

              {submitError ? (
                <div className="alert alert-error text-sm">{submitError}</div>
              ) : null}

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={isPending}
                >
                  {isPending ? "Salvando..." : "Cadastrar ação"}
                </button>
              </div>
            </form>

            <div className="mt-5 overflow-x-auto">
              <div className="flex gap-4 flex-wrap pb-2">
                {report.preventiveActions.length ? (
                  report.preventiveActions.map((action) => (
                    <article
                      key={action.id}
                      className="app-surface-muted w-80 shrink-0 rounded-2xl border p-4"
                    >
                      <p className="text-sm text-base-content/75">
                        {action.description}
                      </p>
                      <p className="mt-3 text-xs text-base-content/50">
                        {formatDate(action.createdAt)}
                      </p>
                      {action.incidentId ? (
                        <Link
                          href={`/dashboard/incidents/${action.incidentId}`}
                          className="mt-3 inline-flex text-sm font-medium link link-hover"
                        >
                          Vinculado a #{action.incidentId}{" "}
                          {action.incidentTitle}
                        </Link>
                      ) : (
                        <p className="mt-3 text-sm text-base-content/50">
                          Sem vínculo com chamado.
                        </p>
                      )}
                    </article>
                  ))
                ) : (
                  <div className="app-surface-muted w-full rounded-2xl border border-dashed p-5 text-sm text-base-content/60">
                    Nenhuma ação preventiva cadastrada no período.
                  </div>
                )}
              </div>
            </div>
          </div>
        </article>

        <article className="app-surface card border">
          <div className="card-body">
            <h3 className="text-lg font-semibold">Indicadores técnicos</h3>
            <div className="mt-3 space-y-3">
              {report.technicalIndicators.map((indicator) => (
                <div
                  key={indicator.label}
                  className="app-surface-muted rounded-2xl border p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-base-content/60">
                        {indicator.label}
                      </p>
                      <p className="mt-1 text-2xl font-semibold">
                        {indicator.value}
                      </p>
                    </div>
                    <div className="badge badge-outline">
                      {reportExecutionStatusLabel[indicator.status]}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
