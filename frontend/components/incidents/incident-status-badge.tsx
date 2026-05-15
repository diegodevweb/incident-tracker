import { incidentStatusLabel } from "@/lib/labels";
import type { IncidentStatus } from "@/lib/types";

const statusClassName: Record<IncidentStatus, string> = {
  OPEN: "badge-error",
  PENDING: "badge-warning",
  IN_PROGRESS: "border-0 bg-orange-500 text-white",
  RESOLVED: "badge-success",
};

export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  return (
    <span className={`badge badge-sm border-0 ${statusClassName[status]}`}>
      {incidentStatusLabel[status]}
    </span>
  );
}
