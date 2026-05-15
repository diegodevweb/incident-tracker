import { ReportsPageClient } from "@/components/reports/reports-page-client";

function getDefaultRange() {
  const startDate = new Date();
  startDate.setUTCDate(1);
  startDate.setUTCHours(0, 0, 0, 0);

  const endDate = new Date();
  endDate.setUTCHours(23, 59, 59, 999);

  return {
    startDate: startDate.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10),
  };
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ startDate?: string; endDate?: string }>;
}) {
  const params = await searchParams;
  const defaultRange = getDefaultRange();
  const startDate = params.startDate ?? defaultRange.startDate;
  const endDate = params.endDate ?? defaultRange.endDate;

  return (
    <ReportsPageClient
      key={`${startDate}:${endDate}`}
      startDate={startDate}
      endDate={endDate}
    />
  );
}
