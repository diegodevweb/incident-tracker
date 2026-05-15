"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Topbar } from "@/components/dashboard/topbar";
import { fetchIncidents } from "@/lib/api";
import { incidentFilterLabel } from "@/lib/labels";
import { getAuthSession, getInitials } from "@/lib/session";
import type { AuthSession, Incident, IncidentFilter } from "@/lib/types";
import { IncidentList } from "./incident-list";

const filterOrder: IncidentFilter[] = [
  "ALL",
  "WEBHOOK",
  "DASHBOARD",
  "PRODUCTION",
];

type IncidentsPageClientProps = {
  initialSearchParams: {
    filter?: string;
    q?: string;
    status?: string;
    source?: string;
    client?: string;
  };
};

function resolveFilter(value?: string): IncidentFilter {
  if (value === "WEBHOOK" || value === "DASHBOARD" || value === "PRODUCTION") {
    return value;
  }

  return "ALL";
}

export function IncidentsPageClient({
  initialSearchParams: { filter, q, status, source, client },
}: IncidentsPageClientProps) {
  const router = useRouter();
  const [session] = useState<AuthSession | null>(() => getAuthSession());
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const activeFilter = resolveFilter(filter);
  const activeRole = session?.user.role ?? "CLIENT";
  const authenticatedClientId =
    session?.user.role === "CLIENT"
      ? session.user.clientId ?? session.user.id
      : undefined;
  const displayName = session?.user.name ?? "Usuário";
  const userInitials = getInitials(displayName);
  const authError =
    activeRole === "CLIENT" && !authenticatedClientId
      ? "Faça login novamente para carregar seus tickets."
      : null;

  useEffect(() => {
    if (!session) {
      router.replace("/login");
    }
  }, [router, session]);

  useEffect(() => {
    if (!session) {
      return;
    }

    if (authError) {
      return;
    }

    const apiQuery =
      activeRole === "CLIENT"
        ? {
            clientId: authenticatedClientId,
            source: "DASHBOARD",
          }
        : {
            q,
            status,
            source:
              activeFilter === "WEBHOOK"
                ? "WEBHOOK"
                : activeFilter === "DASHBOARD"
                  ? "DASHBOARD"
                  : source,
            environment: activeFilter === "PRODUCTION" ? "production" : undefined,
            client,
          };

    void fetchIncidents(apiQuery)
      .then((data) => {
        setLoadError(null);
        setIncidents(data);
      })
      .catch(() => {
        setIncidents([]);
        setLoadError("Não foi possível carregar os tickets.");
      });
  }, [activeFilter, activeRole, authError, authenticatedClientId, client, q, session, source, status]);

  const summaryCards =
    activeRole === "CLIENT"
      ? [
          { label: "Meus tickets", value: incidents.length },
          {
            label: "Em aberto",
            value: incidents.filter((incident) => incident.status === "OPEN").length,
          },
          {
            label: "Em andamento",
            value: incidents.filter((incident) => incident.status === "IN_PROGRESS").length,
          },
          {
            label: "Resolvidos",
            value: incidents.filter((incident) => incident.status === "RESOLVED").length,
          },
        ]
      : [
          { label: "Total", value: incidents.length },
          {
            label: "Abertos",
            value: incidents.filter((incident) => incident.status === "OPEN").length,
          },
          {
            label: "Críticos",
            value: incidents.filter((incident) => incident.priority === "CRITICAL").length,
          },
          {
            label: "Webhook",
            value: incidents.filter((incident) => incident.source === "WEBHOOK").length,
          },
        ];

  return (
    <div>
      <Topbar
        title={activeRole === "CLIENT" ? "Meus tickets" : "Alertas"}
        subtitle={
          activeRole === "CLIENT"
            ? "Acompanhe seus tickets e atualizações."
            : "Leitura consolidada de eventos operacionais e erros capturados na integração."
        }
        userInitials={userInitials}
      />

      <div className="space-y-6 p-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="app-surface app-stat-card rounded-3xl border p-5"
            >
              <p className="text-sm text-base-content/60">{card.label}</p>
              <p className="mt-3 text-4xl font-semibold tracking-tight">
                {card.value}
              </p>
            </div>
          ))}
        </section>

        {activeRole === "ADMIN" ? (
          <section className="space-y-4">
            <div className="flex flex-wrap gap-3">
              {filterOrder.map((item) => {
                const isActive = item === activeFilter;
                const params = new URLSearchParams();
                if (item !== "ALL") params.set("filter", item);
                if (q) params.set("q", q);
                if (status) params.set("status", status);
                if (source) params.set("source", source);
                if (client) params.set("client", client);

                return (
                  <Link
                    key={item}
                    href={`/dashboard/incidents?${params.toString()}`}
                    className={`btn btn-sm ${isActive ? "btn-primary" : "btn-ghost"}`}
                  >
                    {incidentFilterLabel[item]}
                  </Link>
                );
              })}
            </div>
          </section>
        ) : (
          <div className="flex justify-end">
            <Link href="/dashboard/incidents/new" className="btn btn-primary btn-sm">
              Abrir novo ticket
            </Link>
          </div>
        )}

        {authError || loadError ? (
          <div className="alert alert-error text-sm">{authError ?? loadError}</div>
        ) : null}

        <IncidentList incidents={incidents} />
      </div>
    </div>
  );
}
