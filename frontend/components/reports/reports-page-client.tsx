"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/components/dashboard/auth-session-provider";
import { Topbar } from "@/components/dashboard/topbar";
import { fetchMonthlyReport } from "@/lib/api";
import { reportMonthRange } from "@/lib/report-period";
import { getInitials } from "@/lib/session";
import type { MonthlyReport } from "@/lib/types";
import { MonthlyReportPrint } from "./monthly-report-print";
import { MonthlyReportView } from "./monthly-report-view";

export function ReportsPageClient({ month }: { month: string }) {
  const router = useRouter();
  const session = useAuthSession();
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!session) {
      router.replace("/login");
      return;
    }

    if (session.user.role !== "ADMIN") {
      router.replace("/dashboard/incidents");
      return;
    }

    let isMounted = true;

    const { startDate, endDate } = reportMonthRange(month);

    void fetchMonthlyReport(startDate, endDate)
      .then((data) => {
        if (!isMounted) return;
        setReport(data);
        setError(null);
      })
      .catch(() => {
        if (!isMounted) return;
        setReport(null);
        setError("Não foi possível carregar o relatório.");
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [month, router, session]);

  // O relatório continua na tela enquanto busca: a ação preventiva em
  // digitação não se perde.
  async function refreshReport() {
    const { startDate, endDate } = reportMonthRange(month);

    try {
      setReport(await fetchMonthlyReport(startDate, endDate));
      setRefreshError(null);
    } catch {
      setRefreshError("Não foi possível atualizar o relatório.");
    }
  }

  return (
    <div>
      <div className="print:hidden">
        <Topbar
          title="Relatórios"
          subtitle="Consolidado mensal com incidentes atendidos, criticidade, SLA, ações e indicadores técnicos."
          userInitials={getInitials(session?.user.name ?? "Usuário")}
        />
      </div>

      <div className="space-y-6 p-6 print:p-0">
        {refreshError ? (
          <div className="alert alert-error text-sm print:hidden">
            {refreshError}
          </div>
        ) : null}

        {isLoading ? (
          <div className="app-surface-muted rounded-3xl border p-6 text-sm text-base-content/60">
            Carregando relatório...
          </div>
        ) : error || !report ? (
          <div className="alert alert-error text-sm">
            {error ?? "Relatório indisponível."}
          </div>
        ) : (
          <>
            <MonthlyReportPrint report={report} month={month} />
            <MonthlyReportView
              report={report}
              month={month}
              onReportRefresh={refreshReport}
            />
          </>
        )}
      </div>
    </div>
  );
}
