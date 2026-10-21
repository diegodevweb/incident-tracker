"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import { createPreventiveAction } from "@/lib/api";
import {
  getIncidentPriorityLabel,
  incidentPriorityLabel,
  incidentSourceLabel,
  incidentStatusLabel,
  reportExecutionStatusLabel,
  reportSlaCells,
} from "@/lib/labels";
import {
  REPORT_CLIENT_NAME,
  REPORT_DISCLAIMER,
  REPORT_PROVIDER_NAME,
  REPORT_TITLE,
  correctiveActionsInPeriod as listCorrectiveActionsInPeriod,
  criticalEntriesCount,
  downloadMonthlyReportCsv,
  downloadMonthlyReportXlsx,
} from "@/lib/report-export";
import {
  currentReportMonth,
  formatReportDate,
  formatReportDateTime,
  formatReportMonthYear,
  recentReportMonths,
  reportMonthLabel,
} from "@/lib/report-period";
import type { MonthlyReport } from "@/lib/types";

// Competências oferecidas no filtro: os últimos dois anos.
const SELECTABLE_MONTHS = 24;

export function MonthlyReportView({
  report,
  month,
  onReportRefresh,
}: {
  report: MonthlyReport;
  /** Competência do relatório, AAAA-MM. */
  month: string;
  onReportRefresh: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [preventiveAction, setPreventiveAction] = useState("");
  const [relatedIncidentId, setRelatedIncidentId] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const incidentOptions = Array.from(
    new Map(
      report.entries.map((entry) => [
        entry.incidentId,
        { id: entry.incidentId, title: entry.title },
      ]),
    ).values(),
  );
  const correctiveActionsInPeriod = listCorrectiveActionsInPeriod(report);
  const recentMonths = recentReportMonths(
    currentReportMonth(),
    SELECTABLE_MONTHS,
  );
  const monthOptions = recentMonths.includes(month)
    ? recentMonths
    : [month, ...recentMonths];

  function handleExport(exportReport: () => void) {
    setExportError(null);

    try {
      exportReport();
    } catch {
      setExportError("Não foi possível exportar o relatório.");
    }
  }

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
        await onReportRefresh();
      } catch {
        setSubmitError("Não foi possível cadastrar a ação preventiva.");
      }
    });
  }

  return (
    <div className="max-w-full overflow-x-hidden space-y-6 print:hidden">
      <section className="app-surface card border">
        <div className="card-body gap-6">
          <form action={pathname} method="get" className="space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-1 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    {REPORT_TITLE}
                  </h2>
                  <p className="mt-1 text-sm text-base-content/60">
                    Cliente: {REPORT_CLIENT_NAME} · Fornecedor:{" "}
                    {REPORT_PROVIDER_NAME}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => handleExport(() => window.print())}
                  >
                    Exportar PDF
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() =>
                      handleExport(() => downloadMonthlyReportCsv(report, month))
                    }
                  >
                    Exportar CSV
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() =>
                      handleExport(() => downloadMonthlyReportXlsx(report, month))
                    }
                  >
                    Exportar Excel
                  </button>
                </div>
              </div>
              <RefreshButton
                label="Atualizar relatório"
                onRefresh={onReportRefresh}
              />
            </div>
            {exportError ? (
              <div className="alert alert-error text-sm">{exportError}</div>
            ) : null}
            <div className="grid gap-4 md:grid-cols-[minmax(0,20rem)_auto_auto]">
              <label className="form-control">
                <span className="label-text mb-2">Competência</span>
                <select
                  name="month"
                  defaultValue={month}
                  className="select select-bordered w-full"
                >
                  {monthOptions.map((option) => (
                    <option key={option} value={option}>
                      {reportMonthLabel(option)}
                    </option>
                  ))}
                </select>
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
              <p className="mt-2 text-2xl font-semibold">
                {reportMonthLabel(month)}
              </p>
            </div>
            <div className="app-surface-muted rounded-2xl border p-4">
              <p className="text-sm text-base-content/60">Gerado em</p>
              <p className="mt-2 text-sm font-medium">
                {formatReportDateTime(report.generatedAt)}
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
                {criticalEntriesCount(report)}
              </p>
            </div>
          </div>

          <div className="app-surface-muted rounded-2xl border p-4 text-sm text-base-content/70">
            {REPORT_DISCLAIMER}
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
        <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-6 py-5">
          <div>
            <h3 className="text-lg font-semibold">
              Incidentes atendidos no período
            </h3>
            <p className="text-sm text-base-content/60">
              Clique para recolher ou expandir
            </p>
          </div>
          <RefreshButton
            label="Atualizar incidentes do período"
            onRefresh={onReportRefresh}
          />
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
                  <th className="w-36">SLA de resposta</th>
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
                    <td className="truncate">{entry.companyName}</td>
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
                    <td className="truncate">
                      <p className="truncate">
                        {reportSlaCells(entry).state}
                      </p>
                      <p className="truncate text-sm text-base-content/60">
                        {reportSlaCells(entry).target}
                      </p>
                    </td>
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
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Ações corretivas</h3>
                <p className="text-sm text-base-content/60">
                  Lista das ações registradas nos chamados dentro do período
                  filtrado.
                </p>
              </div>
              <RefreshButton
                label="Atualizar ações corretivas"
                onRefresh={onReportRefresh}
              />
            </div>
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
                          {formatReportMonthYear(action.createdAt)}
                        </td>
                        <td>{incidentStatusLabel[action.status]}</td>
                        <td className="whitespace-nowrap">
                          {formatReportDate(action.createdAt)}
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
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Ações preventivas</h3>
                <p className="text-sm text-base-content/60">
                  Cadastre medidas preventivas e relacione com um chamado
                  quando fizer sentido.
                </p>
              </div>
              <RefreshButton
                label="Atualizar ações preventivas"
                onRefresh={onReportRefresh}
              />
            </div>

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
                        {formatReportDate(action.createdAt)}
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
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-semibold">Indicadores técnicos</h3>
              <RefreshButton
                label="Atualizar indicadores"
                onRefresh={onReportRefresh}
              />
            </div>
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
