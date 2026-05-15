import { getIncidentPriorityLabel } from "@/lib/labels";
import type { IncidentLevel, IncidentSource } from "@/lib/types";

const priorityClassName: Record<IncidentLevel, string> = {
  INFO: "badge-ghost",
  WARNING: "badge-warning",
  ERROR: "badge-secondary",
  CRITICAL: "badge-error",
};

export function IncidentPriorityBadge({
  priority,
  source,
}: {
  priority: IncidentLevel;
  source?: IncidentSource;
}) {
  return (
    <span className={`badge badge-outline ${priorityClassName[priority]}`}>
      {getIncidentPriorityLabel(priority, source)}
    </span>
  );
}
