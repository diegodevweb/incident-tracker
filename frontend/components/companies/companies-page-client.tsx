"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/components/dashboard/auth-session-provider";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import { Topbar } from "@/components/dashboard/topbar";
import { fetchCompanies } from "@/lib/api";
import { formatCnpj } from "@/lib/cnpj";
import { getInitials } from "@/lib/session";
import type { CompanyListPage } from "@/lib/types";
import { NewCompanyForm } from "./new-company-form";

export function CompaniesPageClient() {
  const router = useRouter();
  const session = useAuthSession();
  const isAdmin = session?.user.role === "ADMIN";
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [listPage, setListPage] = useState<CompanyListPage | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      router.replace("/login");
      return;
    }

    if (!isAdmin) {
      router.replace("/dashboard/profile");
    }
  }, [isAdmin, router, session]);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    void fetchCompanies({ page, q: query })
      .then((data) => {
        setLoadError(null);
        setListPage(data);
      })
      .catch(() => {
        setListPage(null);
        setLoadError("Não foi possível carregar os clientes.");
      });
  }, [isAdmin, page, query]);

  async function refreshCompanies() {
    try {
      setListPage(await fetchCompanies({ page, q: query }));
      setLoadError(null);
    } catch {
      setLoadError("Não foi possível atualizar os clientes.");
    }
  }

  const totalPages = listPage
    ? Math.max(1, Math.ceil(listPage.total / listPage.pageSize))
    : 1;

  return (
    <div>
      <Topbar
        title="Clientes"
        subtitle="Empresas atendidas, as pessoas que acessam o painel por elas e as integrações."
        userInitials={getInitials(session?.user.name ?? "Usuário")}
      />

      <div className="space-y-6 p-6">
        <NewCompanyForm
          onCreated={(company) =>
            router.push(`/dashboard/clients/${company.id}`)
          }
        />

        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setQuery(search.trim());
          }}
        >
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="input input-bordered w-full sm:max-w-md"
            placeholder="Buscar por nome ou CNPJ"
            maxLength={191}
          />
          <button type="submit" className="btn">
            Buscar
          </button>
        </form>

        {loadError ? (
          <div className="alert alert-error text-sm">{loadError}</div>
        ) : null}

        {listPage && listPage.items.length === 0 ? (
          <p className="text-sm text-base-content/60">
            {query
              ? "Nenhuma empresa encontrada para essa busca."
              : "Nenhuma empresa cadastrada ainda."}
          </p>
        ) : null}

        {listPage && listPage.items.length > 0 ? (
          <div className="app-surface overflow-hidden rounded-3xl border">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr className="text-base-content/60">
                    <th>Empresa</th>
                    <th>CNPJ</th>
                    <th>Usuários</th>
                    <th>Chamados em aberto</th>
                    <th>
                      <div className="flex items-center justify-between gap-2">
                        Situação
                        <RefreshButton
                          label="Atualizar clientes"
                          onRefresh={refreshCompanies}
                        />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {listPage.items.map((company) => (
                    <tr key={company.id} className="hover">
                      <td>
                        <Link
                          href={`/dashboard/clients/${company.id}`}
                          className="link-hover font-medium"
                        >
                          {company.name}
                        </Link>
                      </td>
                      <td className="font-mono text-sm">
                        {company.cnpj ? formatCnpj(company.cnpj) : "—"}
                      </td>
                      <td>{company.userCount}</td>
                      <td>{company.openIncidents}</td>
                      <td>
                        {company.disabledAt ? (
                          <span className="badge badge-error badge-outline">
                            Desativada
                          </span>
                        ) : (
                          <span className="badge badge-success badge-outline">
                            Ativa
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {listPage && totalPages > 1 ? (
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              className="btn btn-sm"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              Anterior
            </button>
            <span className="text-sm text-base-content/60">
              Página {page} de {totalPages} · {listPage.total} empresas
            </span>
            <button
              type="button"
              className="btn btn-sm"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Próxima
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
