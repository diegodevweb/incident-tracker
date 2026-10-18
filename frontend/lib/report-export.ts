import {
  firstResponseSlaStateLabel,
  getIncidentPriorityLabel,
  incidentPriorityLabel,
  incidentSourceLabel,
  incidentStatusLabel,
  reportExecutionStatusLabel,
} from "./labels";
import {
  formatReportDate,
  formatReportShortDateTime,
  reportMonthLabel,
  toSpreadsheetDate,
} from "./report-period";
import type { MonthlyReport } from "./types";
import { XLSX_MIME_TYPE, buildXlsx, type XlsxCell } from "./xlsx";

export const REPORT_TITLE = "Relatório mensal de chamados";
// Enquanto a Attimo for o único cliente, o relatório não filtra por empresa e
// o cabeçalho traz o nome dela. Com mais clientes, o nome passa a vir da
// empresa escolhida no filtro.
export const REPORT_CLIENT_NAME = "Attimo Soluções";
export const REPORT_PROVIDER_NAME = "Tevah Solutions";
export const REPORT_DISCLAIMER =
  "Relatório técnico limitado às atividades previstas em contrato, sem natureza de auditoria, perícia técnica ou laudo judicial.";

/** Endereço completo do chamado: no PDF e na planilha o link sai do sistema. */
export function incidentUrl(incidentId: number) {
  return `${window.location.origin}/dashboard/incidents/${incidentId}`;
}

/** As ações corretivas registradas dentro do período, como a tela mostra. */
export function correctiveActionsInPeriod(report: MonthlyReport) {
  const start = Date.parse(report.periodStart);
  const end = Date.parse(report.periodEnd);

  return report.correctiveActions.filter((action) => {
    const createdAt = Date.parse(action.createdAt);
    return createdAt >= start && createdAt <= end;
  });
}

export function criticalEntriesCount(report: MonthlyReport) {
  return report.entries.filter((entry) => entry.priority === "CRITICAL").length;
}

export function reportFileBaseName(month: string) {
  return `relatorio-chamados-${month}`;
}

type DateValue = { date: string; withTime: boolean };
type ReportCell = string | number | DateValue | null;
type ReportTable = {
  name: string;
  columns: { header: string; width: number }[];
  rows: ReportCell[][];
};

const withTime = (date: string): DateValue => ({ date, withTime: true });
const dateOnly = (date: string): DateValue => ({ date, withTime: false });

function summaryTable(report: MonthlyReport, month: string): ReportTable {
  return {
    name: "Resumo",
    columns: [
      { header: "Item", width: 24 },
      { header: "Valor", width: 60 },
    ],
    rows: [
      ["Relatório", REPORT_TITLE],
      ["Cliente", REPORT_CLIENT_NAME],
      ["Fornecedor", REPORT_PROVIDER_NAME],
      ["Competência", reportMonthLabel(month)],
      [
        "Período",
        `${formatReportDate(report.periodStart)} a ${formatReportDate(report.periodEnd)}`,
      ],
      ["Gerado em", withTime(report.generatedAt)],
      ["Incidentes no período", report.entries.length],
      ["Críticos no período", criticalEntriesCount(report)],
      ["Observação", REPORT_DISCLAIMER],
    ],
  };
}

function slaTable(report: MonthlyReport): ReportTable {
  return {
    name: "SLA",
    columns: [
      { header: "Criticidade", width: 14 },
      { header: "Título", width: 28 },
      { header: "Descrição", width: 70 },
      { header: "SLA de primeira resposta", width: 24 },
    ],
    rows: report.slaRules.map((rule) => [
      incidentPriorityLabel[rule.priority],
      rule.title,
      rule.description,
      rule.firstResponseTarget,
    ]),
  };
}

function incidentsTable(report: MonthlyReport): ReportTable {
  return {
    name: "Incidentes",
    columns: [
      { header: "Chamado", width: 10 },
      { header: "Título", width: 36 },
      { header: "Cliente", width: 22 },
      { header: "Status", width: 14 },
      { header: "Data/Hora", width: 17 },
      { header: "Tipo", width: 13 },
      { header: "Origem", width: 11 },
      { header: "SLA de resposta", width: 22 },
      { header: "Prazo do SLA", width: 16 },
      { header: "Criticidade", width: 12 },
      { header: "Descrição", width: 60 },
      { header: "Último log", width: 50 },
      { header: "Link do chamado", width: 50 },
    ],
    rows: report.entries.map((entry) => [
      entry.incidentId,
      entry.title ?? "",
      entry.companyName ?? "",
      entry.status ? incidentStatusLabel[entry.status] : "",
      withTime(entry.createdAt),
      incidentPriorityLabel[entry.errorType],
      incidentSourceLabel[entry.source],
      firstResponseSlaStateLabel[entry.slaState],
      entry.slaTarget,
      getIncidentPriorityLabel(entry.priority, entry.source),
      entry.description,
      entry.latestLogMessage ?? "",
      incidentUrl(entry.incidentId),
    ]),
  };
}

function correctiveActionsTable(report: MonthlyReport): ReportTable {
  return {
    name: "Ações corretivas",
    columns: [
      { header: "Chamado", width: 10 },
      { header: "Título", width: 36 },
      { header: "Status", width: 14 },
      { header: "Data", width: 12 },
      { header: "Ação corretiva", width: 70 },
      { header: "Anexos", width: 10 },
      { header: "Link do chamado", width: 50 },
    ],
    rows: correctiveActionsInPeriod(report).map((action) => [
      action.incidentId,
      action.title,
      incidentStatusLabel[action.status],
      dateOnly(action.createdAt),
      action.description ?? "",
      action.attachments.length,
      incidentUrl(action.incidentId),
    ]),
  };
}

function preventiveActionsTable(report: MonthlyReport): ReportTable {
  return {
    name: "Ações preventivas",
    columns: [
      { header: "Data", width: 12 },
      { header: "Ação preventiva", width: 70 },
      { header: "Chamado", width: 10 },
      { header: "Título do chamado", width: 36 },
      { header: "Link do chamado", width: 50 },
    ],
    rows: report.preventiveActions.map((action) => [
      dateOnly(action.createdAt),
      action.description,
      action.incidentId ?? null,
      action.incidentTitle ?? "",
      action.incidentId ? incidentUrl(action.incidentId) : "",
    ]),
  };
}

function indicatorsTable(report: MonthlyReport): ReportTable {
  return {
    name: "Indicadores",
    columns: [
      { header: "Indicador", width: 32 },
      { header: "Valor", width: 12 },
      { header: "Situação", width: 16 },
    ],
    rows: report.technicalIndicators.map((indicator) => [
      indicator.label,
      indicator.value,
      reportExecutionStatusLabel[indicator.status],
    ]),
  };
}

function downloadFile(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Revogar na hora pode cancelar o download em alguns navegadores.
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

// Excel em português usa ";" no CSV, porque a vírgula é o separador decimal.
const CSV_SEPARATOR = ";";

function csvField(cell: ReportCell) {
  if (cell === null) {
    return "";
  }

  if (typeof cell === "number") {
    return String(cell);
  }

  let text =
    typeof cell === "string"
      ? cell
      : cell.withTime
        ? formatReportShortDateTime(cell.date)
        : formatReportDate(cell.date);

  // Texto que começa com = + - @ vira fórmula ao abrir no Excel (injeção de
  // CSV). Descrição e log vêm do cliente e do webhook: o apóstrofo neutraliza.
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

/** CSV da tabela de incidentes, a parte do relatório que cabe numa tabela só. */
export function buildMonthlyReportCsv(report: MonthlyReport) {
  const table = incidentsTable(report);
  const lines = [
    table.columns.map((column) => csvField(column.header)),
    ...table.rows.map((row) => row.map(csvField)),
  ].map((fields) => fields.join(CSV_SEPARATOR));

  // O BOM faz o Excel ler o arquivo como UTF-8 (sem ele, os acentos quebram).
  return `﻿${lines.join("\r\n")}\r\n`;
}

function toXlsxCell(cell: ReportCell): XlsxCell {
  if (cell === null || typeof cell === "string" || typeof cell === "number") {
    return cell;
  }

  return {
    serial: toSpreadsheetDate(cell.date),
    format: cell.withTime ? "datetime" : "date",
  };
}

/** Planilha com o relatório inteiro, uma aba por seção. */
export function buildMonthlyReportXlsx(report: MonthlyReport, month: string) {
  return buildXlsx(
    [
      summaryTable(report, month),
      slaTable(report),
      incidentsTable(report),
      correctiveActionsTable(report),
      preventiveActionsTable(report),
      indicatorsTable(report),
    ].map((table) => ({
      name: table.name,
      columnWidths: table.columns.map((column) => column.width),
      rows: [
        table.columns.map((column) => column.header),
        ...table.rows.map((row) => row.map(toXlsxCell)),
      ],
    })),
  );
}

export function downloadMonthlyReportCsv(report: MonthlyReport, month: string) {
  downloadFile(
    `${reportFileBaseName(month)}.csv`,
    new Blob([buildMonthlyReportCsv(report)], {
      type: "text/csv;charset=utf-8",
    }),
  );
}

export function downloadMonthlyReportXlsx(report: MonthlyReport, month: string) {
  downloadFile(
    `${reportFileBaseName(month)}.xlsx`,
    new Blob([buildMonthlyReportXlsx(report, month)], { type: XLSX_MIME_TYPE }),
  );
}
