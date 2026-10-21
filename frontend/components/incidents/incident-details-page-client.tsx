"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthSession } from "@/components/dashboard/auth-session-provider";
import { Topbar } from "@/components/dashboard/topbar";
import { fetchIncident, markNotificationsRead } from "@/lib/api";
import { announceNotificationsChanged } from "@/lib/notifications";
import { getInitials } from "@/lib/session";
import type { Incident } from "@/lib/types";
import { IncidentAttachments } from "./incident-attachments";
import { IncidentConversation } from "./incident-conversation";
import { IncidentDeletedNotice } from "./incident-deletion";
import { IncidentDetails } from "./incident-details";
import { IncidentManagementPanel } from "./incident-management-panel";
import { IncidentTimeline } from "./incident-timeline";

// Ver o chamado dá por vistos os avisos dele.
function markIncidentNotificationsSeen(id: number) {
  void markNotificationsRead(id)
    .then(announceNotificationsChanged)
    .catch(() => {
      // Sem marcar, o aviso só continua no sino.
    });
}

export function IncidentDetailsPageClient({ id }: { id: number }) {
  const router = useRouter();
  const session = useAuthSession();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
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

  useEffect(() => {
    if (session?.user.role === "CLIENT") {
      markIncidentNotificationsSeen(id);
    }
  }, [id, session]);

  // Os cards continuam na tela enquanto busca: quem está escrevendo uma
  // mensagem ou editando a gestão não perde o que digitou.
  async function refreshIncident() {
    try {
      setIncident(await fetchIncident(id));
      setRefreshError(null);
    } catch {
      setRefreshError("Não foi possível atualizar o chamado.");
      return;
    }

    if (activeRole === "CLIENT") {
      markIncidentNotificationsSeen(id);
    }
  }

  // O cliente não vê mais o chamado que excluiu; o admin fica na página, que
  // passa a mostrar o chamado na lixeira, com o restaurar.
  function handleDeleted() {
    if (activeRole === "CLIENT") {
      router.push("/dashboard/incidents");
      return;
    }

    void refreshIncident();
  }

  const displayName = session?.user.name ?? "Usuário";
  const deleted = Boolean(incident?.deletedAt);

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
            {refreshError ? (
              <div className="alert alert-error text-sm">{refreshError}</div>
            ) : null}

            <IncidentDeletedNotice
              incident={incident}
              onRestored={setIncident}
            />

            <IncidentDetails
              incident={incident}
              role={activeRole}
              onUpdated={setIncident}
              onRefresh={refreshIncident}
              onDeleted={handleDeleted}
            />

            <IncidentConversation
              incident={incident}
              role={activeRole}
              readOnly={deleted}
              onUpdated={setIncident}
              onRefresh={refreshIncident}
            />

            <IncidentTimeline incident={incident} onRefresh={refreshIncident} />

            {deleted ? null : (
              <div className="grid gap-6">
                <IncidentManagementPanel
                  incident={incident}
                  role={activeRole}
                  onUpdated={setIncident}
                  onRefresh={refreshIncident}
                />
              </div>
            )}

            <IncidentAttachments
              incident={incident}
              readOnly={deleted}
              onUpdated={setIncident}
              onRefresh={refreshIncident}
            />
          </>
        )}
      </div>
    </div>
  );
}
