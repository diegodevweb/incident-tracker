import { incidentStatusLabel } from "@/lib/labels";
import type { IncidentStatus } from "@/lib/types";

const statusClassName: Record<IncidentStatus, string> = {
  OPEN: "badge-error",
  PENDING: "badge-warning",
  IN_PROGRESS: "badge-info",
  RESOLVED: "badge-success",
};

export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  return (
    <span className={`badge badge-sm border-0 whitespace-nowrap ${statusClassName[status]}`}>
      {incidentStatusLabel[status]}
    </span>
  );
}
