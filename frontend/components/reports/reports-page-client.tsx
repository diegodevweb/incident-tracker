"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/dashboard/topbar";
import { fetchMonthlyReport } from "@/lib/api";
import { getAuthSession, getInitials } from "@/lib/session";
import type { AuthSession, MonthlyReport } from "@/lib/types";
import { MonthlyReportView } from "./monthly-report-view";

export function ReportsPageClient({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}) {
  const router = useRouter();
  const [session] = useState<AuthSession | null>(() => getAuthSession());
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [error, setError] = useState<string | null>(null);
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

    void fetchMonthlyReport(
      `${startDate}T00:00:00.000Z`,
      `${endDate}T23:59:59.999Z`,
    )
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
  }, [endDate, router, session, startDate]);

  function refreshReport() {
    setIsLoading(true);
    setError(null);

    void fetchMonthlyReport(
      `${startDate}T00:00:00.000Z`,
      `${endDate}T23:59:59.999Z`,
    )
      .then((data) => {
        setReport(data);
      })
      .catch(() => {
        setReport(null);
        setError("Não foi possível atualizar o relatório.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }

  return (
    <div>
      <Topbar
        title="Relatórios"
        subtitle="Consolidado mensal com incidentes atendidos, criticidade, SLA, ações e indicadores técnicos."
        userInitials={getInitials(session?.user.name ?? "Usuário")}
      />

      <div className="p-6">
        {isLoading ? (
          <div className="app-surface-muted rounded-3xl border p-6 text-sm text-base-content/60">
            Carregando relatório...
          </div>
        ) : error || !report ? (
          <div className="alert alert-error text-sm">
            {error ?? "Relatório indisponível."}
          </div>
        ) : (
          <MonthlyReportView report={report} onReportRefresh={refreshReport} />
        )}
      </div>
    </div>
  );
}
