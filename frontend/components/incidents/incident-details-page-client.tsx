"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthSession } from "@/components/dashboard/auth-session-provider";
import { Topbar } from "@/components/dashboard/topbar";
import { fetchIncident } from "@/lib/api";
import { getInitials } from "@/lib/session";
import type { Incident } from "@/lib/types";
import { IncidentAttachments } from "./incident-attachments";
import { IncidentConversation } from "./incident-conversation";
import { IncidentDetails } from "./incident-details";
import { IncidentManagementPanel } from "./incident-management-panel";
import { IncidentTimeline } from "./incident-timeline";

export function IncidentDetailsPageClient({ id }: { id: number }) {
  const router = useRouter();
  const session = useAuthSession();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const activeRole = session?.user.role ?? "CLIENT";

  useEffect(() => {
    if (!session) {
      router.replace("/login");
    }
  }, [router, session]);

  useEffect(() => {
    if (!session) {
      return;
    }

    void fetchIncident(id)
      .then((data) => {
        setIncident(data);
        setError(null);
      })
      .catch(() => {
        setIncident(null);
        setError("Não foi possível carregar o chamado.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [id, session]);

  const displayName = session?.user.name ?? "Usuário";

  return (
    <div>
      <Topbar
        title={`Incidente #${id}`}
        subtitle="Visão detalhada com dados operacionais, logs e anexos relacionados."
        userInitials={getInitials(displayName)}
      />

      <div className="space-y-6 p-6">
        <Link
          href="/dashboard/incidents"
          className="btn btn-sm btn-ghost w-fit"
        >
          Voltar
        </Link>

        {isLoading ? (
          <div className="app-surface-muted rounded-3xl border p-6 text-sm text-base-content/60">
            Carregando chamado...
          </div>
        ) : error || !incident ? (
          <div className="alert alert-error text-sm">
            {error ?? "Chamado não encontrado."}
          </div>
        ) : (
          <>
            <IncidentDetails
              incident={incident}
              role={activeRole}
              onUpdated={setIncident}
            />

            <IncidentConversation
              incident={incident}
              role={activeRole}
              onUpdated={setIncident}
            />

            <IncidentTimeline incident={incident} />

            <div className="grid gap-6">
              <IncidentManagementPanel
                incident={incident}
                role={activeRole}
                onUpdated={setIncident}
              />
            </div>

            <IncidentAttachments incident={incident} onUpdated={setIncident} />
          </>
        )}
      </div>
    </div>
  );
}
