import { ReportsPageClient } from "@/components/reports/reports-page-client";
import { currentReportMonth, isReportMonth } from "@/lib/report-period";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  // Por enquanto o relatório é só mensal: a competência vem como AAAA-MM e,
  // sem ela (ou inválida), vale o mês atual no horário de Brasília.
  const month = isReportMonth(params.month)
    ? params.month
    : currentReportMonth();

  return <ReportsPageClient key={month} month={month} />;
}
