"use client";

import { useEffect, type ReactNode } from "react";
import {
  firstResponseSlaStateLabel,
  getIncidentPriorityLabel,
  incidentPriorityLabel,
  incidentSourceLabel,
  incidentStatusLabel,
  reportExecutionStatusLabel,
} from "@/lib/labels";
import {
  REPORT_CLIENT_NAME,
  REPORT_DISCLAIMER,
  REPORT_PROVIDER_NAME,
  REPORT_TITLE,
  correctiveActionsInPeriod,
  criticalEntriesCount,
  incidentUrl,
  reportFileBaseName,
} from "@/lib/report-export";
import {
  formatReportDate,
  formatReportDateTime,
  reportMonthLabel,
} from "@/lib/report-period";
import type { MonthlyReport } from "@/lib/types";

// O documento do PDF é separado da tela: só aparece na impressão, sempre
// claro, com o texto inteiro e sem formulários, botões ou seções recolhidas.
// Assim o "Salvar como PDF" sai igual com o tema escuro ou um card fechado.

const cell = "border border-zinc-300 px-1.5 py-1 text-left align-top break-words";
const headerCell = `${cell} bg-zinc-100 font-semibold`;
// Descrição e log podem trazer URL ou stack trace sem espaço: quebram em
// qualquer ponto. Nas demais colunas, só entre palavras.
const textCell = `${cell} whitespace-pre-wrap [overflow-wrap:anywhere]`;

function Section({
  title,
  keepTogether = false,
  children,
}: {
  title: string;
  /** Tabelas curtas não se dividem entre páginas. */
  keepTogether?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`mt-5 ${keepTogether ? "break-inside-avoid" : ""}`}>
      <h2 className="mb-1.5 text-[11pt] font-semibold break-after-avoid">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Table({
  headers,
  children,
}: {
  headers: string[];
  children: ReactNode;
}) {
  return (
    <table className="w-full border-collapse text-[8pt] [&_tr]:break-inside-avoid">
      <thead>
        <tr>
          {headers.map((header) => (
            <th key={header} className={headerCell}>
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-[9pt] text-zinc-600">{children}</p>;
}

function IncidentLink({ id, title }: { id: number; title?: string | null }) {
  return (
    <a href={incidentUrl(id)} className="text-black underline">
      #{id}
      {title ? ` ${title}` : ""}
    </a>
  );
}

export function MonthlyReportPrint({
  report,
  month,
}: {
  report: MonthlyReport;
  month: string;
}) {
  const correctiveActions = correctiveActionsInPeriod(report);

  // O navegador sugere o título da página como nome do PDF.
  useEffect(() => {
    const originalTitle = document.title;
    const applyReportTitle = () => {
      document.title = reportFileBaseName(month);
    };
    const restoreTitle = () => {
      document.title = originalTitle;
    };

    window.addEventListener("beforeprint", applyReportTitle);
    window.addEventListener("afterprint", restoreTitle);

    return () => {
      window.removeEventListener("beforeprint", applyReportTitle);
      window.removeEventListener("afterprint", restoreTitle);
      restoreTitle();
    };
  }, [month]);

  return (
    <div className="hidden bg-white text-[9pt] text-black print:block">
      <header className="border-b-2 border-black pb-2">
        <h1 className="text-[16pt] font-bold">{REPORT_TITLE}</h1>
        <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[10pt]">
          <dt className="font-semibold">Cliente:</dt>
          <dd>{REPORT_CLIENT_NAME}</dd>
          <dt className="font-semibold">Fornecedor:</dt>
          <dd>{REPORT_PROVIDER_NAME}</dd>
          <dt className="font-semibold">Competência:</dt>
          <dd>
            {reportMonthLabel(month)} ({formatReportDate(report.periodStart)} a{" "}
            {formatReportDate(report.periodEnd)})
          </dd>
          <dt className="font-semibold">Gerado em:</dt>
          <dd>{formatReportDateTime(report.generatedAt)}</dd>
          <dt className="font-semibold">Chamados:</dt>
          <dd>
            {report.entries.length} no período, {criticalEntriesCount(report)}{" "}
            crítico(s)
          </dd>
        </dl>
      </header>

      <Section title="SLA por criticidade" keepTogether>
        <Table headers={["Criticidade", "Descrição", "SLA de primeira resposta"]}>
          {report.slaRules.map((rule) => (
            <tr key={rule.priority}>
              <td className={cell}>{incidentPriorityLabel[rule.priority]}</td>
              <td className={cell}>
                <strong>{rule.title}</strong> — {rule.description}
              </td>
              <td className={cell}>{rule.firstResponseTarget}</td>
            </tr>
          ))}
        </Table>
      </Section>

      <Section title="Incidentes atendidos no período">
        {report.entries.length ? (
          <Table
            headers={[
              "Chamado",
              "Cliente",
              "Status",
              "Data/Hora",
              "Tipo",
              "Origem",
              "SLA de resposta",
              "Criticidade",
              "Descrição",
              "Último log",
            ]}
          >
            {report.entries.map((entry) => (
              <tr key={entry.incidentId}>
                <td className={`${cell} w-[13%]`}>
                  <IncidentLink id={entry.incidentId} title={entry.title} />
                </td>
                <td className={cell}>{entry.companyName ?? "-"}</td>
                <td className={cell}>
                  {entry.status ? incidentStatusLabel[entry.status] : "-"}
                </td>
                <td className={`${cell} whitespace-nowrap`}>
                  {entry.date}
                  <br />
                  {entry.time}
                </td>
                <td className={cell}>{incidentPriorityLabel[entry.errorType]}</td>
                <td className={cell}>{incidentSourceLabel[entry.source]}</td>
                <td className={cell}>
                  {firstResponseSlaStateLabel[entry.slaState]}
                  <br />
                  <span className="text-zinc-600">{entry.slaTarget}</span>
                </td>
                <td className={cell}>
                  {getIncidentPriorityLabel(entry.priority, entry.source)}
                </td>
                <td className={`${textCell} w-[24%]`}>{entry.description}</td>
                <td className={`${textCell} w-[18%]`}>
                  {entry.latestLogMessage ?? "Sem log adicional"}
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty>Nenhum incidente no período.</Empty>
        )}
      </Section>

      <Section title="Ações corretivas">
        {correctiveActions.length ? (
          <Table
            headers={["Chamado", "Status", "Data", "Ação corretiva", "Anexos"]}
          >
            {correctiveActions.map((action) => (
              <tr key={`${action.incidentId}-${action.createdAt}`}>
                <td className={`${cell} w-[18%]`}>
                  <IncidentLink id={action.incidentId} title={action.title} />
                </td>
                <td className={cell}>{incidentStatusLabel[action.status]}</td>
                <td className={`${cell} whitespace-nowrap`}>
                  {formatReportDate(action.createdAt)}
                </td>
                <td className={textCell}>{action.description ?? "-"}</td>
                <td className={`${cell} w-[14%]`}>
                  {/* O link assinado do anexo expira; o do chamado não. */}
                  {action.attachments.length ? (
                    <a
                      href={incidentUrl(action.incidentId)}
                      className="text-black underline"
                    >
                      {action.attachments.length} anexo(s) no chamado #
                      {action.incidentId}
                    </a>
                  ) : (
                    "Sem anexos"
                  )}
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty>Nenhuma ação corretiva registrada no período.</Empty>
        )}
      </Section>

      <Section title="Ações preventivas">
        {report.preventiveActions.length ? (
          <Table headers={["Data", "Ação preventiva", "Chamado vinculado"]}>
            {report.preventiveActions.map((action) => (
              <tr key={action.id}>
                <td className={`${cell} w-[10%] whitespace-nowrap`}>
                  {formatReportDate(action.createdAt)}
                </td>
                <td className={textCell}>{action.description}</td>
                <td className={`${cell} w-[25%]`}>
                  {action.incidentId ? (
                    <IncidentLink
                      id={action.incidentId}
                      title={action.incidentTitle}
                    />
                  ) : (
                    "Sem vínculo com chamado"
                  )}
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty>Nenhuma ação preventiva cadastrada no período.</Empty>
        )}
      </Section>

      <Section title="Indicadores técnicos" keepTogether>
        <Table headers={["Indicador", "Valor", "Situação"]}>
          {report.technicalIndicators.map((indicator) => (
            <tr key={indicator.label}>
              <td className={cell}>{indicator.label}</td>
              <td className={cell}>{indicator.value}</td>
              <td className={cell}>
                {reportExecutionStatusLabel[indicator.status]}
              </td>
            </tr>
          ))}
        </Table>
      </Section>

      <p className="mt-6 border-t border-zinc-300 pt-2 text-[8pt] text-zinc-600">
        {REPORT_DISCLAIMER}
      </p>
    </div>
  );
}
