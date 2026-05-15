"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Topbar } from "@/components/dashboard/topbar";
import { fetchIncident } from "@/lib/api";
import { getAuthSession, getInitials } from "@/lib/session";
import type { AuthSession, Incident } from "@/lib/types";
import { IncidentDetails } from "./incident-details";
import { IncidentManagementPanel } from "./incident-management-panel";
import { IncidentTimeline } from "./incident-timeline";

export function IncidentDetailsPageClient({ id }: { id: number }) {
  const router = useRouter();
  const [session] = useState<AuthSession | null>(() => getAuthSession());
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
            <IncidentDetails incident={incident} role={activeRole} />

            <IncidentTimeline incident={incident} />

            <div className="grid gap-6">
              <IncidentManagementPanel incident={incident} role={activeRole} />
            </div>

            <aside className="app-surface card border">
              <div className="card-body">
                <h3 className="text-lg font-semibold">Prints e anexos</h3>
                <p className="text-sm text-base-content/60">
                  Evidências gerais e anexos cadastrados para o chamado.
                </p>

                {incident.attachments.length ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {incident.attachments.map((attachment) => (
                      <a
                        key={attachment.id}
                        href={attachment.url}
                        target="_blank"
                        rel="noreferrer"
                        className="app-surface-muted rounded-2xl border p-4"
                      >
                        <p className="font-medium">{attachment.filename}</p>
                        <p className="mt-1 text-sm text-base-content/60">
                          {attachment.mimeType}
                        </p>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="app-surface-muted mt-4 rounded-2xl border border-dashed p-5 text-sm text-base-content/60">
                    Nenhum arquivo anexado.
                  </div>
                )}
              </div>
            </aside>
          </>
        )}
      </div>
    </div>
  );
}
