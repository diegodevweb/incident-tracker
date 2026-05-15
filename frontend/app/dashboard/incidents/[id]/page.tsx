import { IncidentDetailsPageClient } from "@/components/incidents/incident-details-page-client";

export default async function IncidentDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <IncidentDetailsPageClient id={Number(id)} />;
}
