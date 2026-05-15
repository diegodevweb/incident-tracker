import { IncidentsPageClient } from "@/components/incidents/incidents-page-client";

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    filter?: string;
    q?: string;
    status?: string;
    source?: string;
    client?: string;
  }>;
}) {
  const params = await searchParams;

  return <IncidentsPageClient initialSearchParams={params} />;
}
