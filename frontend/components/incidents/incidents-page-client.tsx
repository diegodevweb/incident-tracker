"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthSession } from "@/components/dashboard/auth-session-provider";
import { Topbar } from "@/components/dashboard/topbar";
import { fetchIncidents } from "@/lib/api";
import { incidentFilterLabel } from "@/lib/labels";
import { getInitials } from "@/lib/session";
import type {
  IncidentFilter,
  IncidentListPage,
} from "@/lib/types";
import { IncidentList } from "./incident-list";
import { IncidentsPagination } from "./incidents-pagination";

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
    page?: string;
  };
};

function resolveFilter(value?: string): IncidentFilter {
  if (value === "WEBHOOK" || value === "DASHBOARD" || value === "PRODUCTION") {
    return value;
  }

  return "ALL";
}

function resolvePage(value?: string) {
  const page = Number(value);

  return Number.isInteger(page) && page >= 1 ? page : 1;
}

export function IncidentsPageClient({
  initialSearchParams: { filter, q, status, source, client, page: pageParam },
}: IncidentsPageClientProps) {
  const router = useRouter();
  const session = useAuthSession();
  const [listPage, setListPage] = useState<IncidentListPage | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const activeFilter = resolveFilter(filter);
  const page = resolvePage(pageParam);
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
            page,
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
            page,
          };

    void fetchIncidents(apiQuery)
      .then((data) => {
        setLoadError(null);
        setListPage(data);
      })
      .catch(() => {
        setListPage(null);
        setLoadError("Não foi possível carregar os tickets.");
      });
  }, [
    activeFilter,
    activeRole,
    authError,
    authenticatedClientId,
    client,
    page,
    q,
    session,
    source,
    status,
  ]);

  const incidents = listPage?.items ?? [];
  // Os totais vêm do servidor (conjunto filtrado inteiro); a página só tem uma fatia.
  const total = listPage?.total ?? 0;
  const byStatus = listPage?.summary.byStatus;
  const byPriority = listPage?.summary.byPriority;
  const bySource = listPage?.summary.bySource;

  const summaryCards =
    activeRole === "CLIENT"
      ? [
          { label: "Meus tickets", value: total },
          { label: "Em aberto", value: byStatus?.OPEN ?? 0 },
          { label: "Em andamento", value: byStatus?.IN_PROGRESS ?? 0 },
          { label: "Resolvidos", value: byStatus?.RESOLVED ?? 0 },
        ]
      : [
          { label: "Total", value: total },
          { label: "Abertos", value: byStatus?.OPEN ?? 0 },
          { label: "Críticos", value: byPriority?.CRITICAL ?? 0 },
          { label: "Webhook", value: bySource?.WEBHOOK ?? 0 },
        ];

  const activeParams = {
    ...(activeFilter !== "ALL" ? { filter: activeFilter } : {}),
    q,
    status,
    source,
    client,
  };

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

        {listPage ? (
          <IncidentsPagination
            page={listPage.page}
            pageSize={listPage.pageSize}
            total={listPage.total}
            params={activeParams}
          />
        ) : null}
      </div>
    </div>
  );
}
