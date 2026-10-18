/*
 * Competência do relatório mensal (AAAA-MM) e datas no horário de Brasília, o
 * mesmo que o backend usa no relatório e no SLA. O relatório vai para o
 * cliente: um chamado das 22h do último dia do mês tem de cair naquele mês.
 */

export const REPORT_TIME_ZONE = "America/Sao_Paulo";

// Brasília não tem horário de verão desde 2019: UTC-3 o ano inteiro.
const REPORT_UTC_OFFSET = "-03:00";
const REPORT_UTC_OFFSET_MS = -3 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;
// Dias entre 30/12/1899 (o zero das datas do Excel) e 01/01/1970.
const SPREADSHEET_EPOCH_OFFSET_DAYS = 25569;

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isReportMonth(value: unknown): value is string {
  return typeof value === "string" && MONTH_PATTERN.test(value);
}

function splitMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return { year, monthNumber };
}

function toMonth(year: number, monthNumber: number) {
  return `${year}-${String(monthNumber).padStart(2, "0")}`;
}

export function currentReportMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: REPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const part = (type: "year" | "month") =>
    parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}`;
}

/** Primeiro e último instante da competência, com o fuso de Brasília explícito. */
export function reportMonthRange(month: string) {
  const { year, monthNumber } = splitMonth(month);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  return {
    startDate: `${month}-01T00:00:00.000${REPORT_UTC_OFFSET}`,
    endDate: `${month}-${String(lastDay).padStart(2, "0")}T23:59:59.999${REPORT_UTC_OFFSET}`,
  };
}

/** As últimas `count` competências, da mais recente para trás. */
export function recentReportMonths(latest: string, count: number) {
  const { year, monthNumber } = splitMonth(latest);

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, monthNumber - 1 - index, 1));
    return toMonth(date.getUTCFullYear(), date.getUTCMonth() + 1);
  });
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "Outubro de 2026". */
export function reportMonthLabel(month: string) {
  const { year, monthNumber } = splitMonth(month);

  return capitalize(
    new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(year, monthNumber - 1, 15))),
  );
}

/** "18 de outubro de 2026 às 15:30". */
export function formatReportDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: REPORT_TIME_ZONE,
  }).format(new Date(value));
}

/** "18/10/2026". */
export function formatReportDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: REPORT_TIME_ZONE,
  }).format(new Date(value));
}

/** "18/10/2026 15:30", que o Excel em português lê como data e hora. */
export function formatReportShortDateTime(value: string) {
  const time = new Intl.DateTimeFormat("pt-BR", {
    timeStyle: "short",
    timeZone: REPORT_TIME_ZONE,
  }).format(new Date(value));

  return `${formatReportDate(value)} ${time}`;
}

/** "outubro de 2026". */
export function formatReportMonthYear(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: REPORT_TIME_ZONE,
  }).format(new Date(value));
}

/** Número de série de data do Excel, já no horário de Brasília. */
export function toSpreadsheetDate(value: string) {
  return (
    (Date.parse(value) + REPORT_UTC_OFFSET_MS) / DAY_MS +
    SPREADSHEET_EPOCH_OFFSET_DAYS
  );
}
