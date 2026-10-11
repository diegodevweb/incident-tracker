"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/components/dashboard/auth-session-provider";
import { Topbar } from "@/components/dashboard/topbar";
import { fetchClients } from "@/lib/api";
import { getInitials } from "@/lib/session";
import type { ClientAccount, ClientListPage } from "@/lib/types";
import { ClientListEditor } from "./client-list-editor";
import { NewClientForm } from "./new-client-form";
import { TemporaryPasswordNotice } from "./temporary-password-notice";

type IssuedPassword = { client: ClientAccount; password: string };

export function ClientsPageClient() {
  const router = useRouter();
  const session = useAuthSession();
  const isAdmin = session?.user.role === "ADMIN";
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [listPage, setListPage] = useState<ClientListPage | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [issuedPassword, setIssuedPassword] = useState<IssuedPassword | null>(
    null,
  );

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

    void fetchClients({ page, q: query })
      .then((data) => {
        setLoadError(null);
        setListPage(data);
      })
      .catch(() => {
        setListPage(null);
        setLoadError("Não foi possível carregar os clientes.");
      });
  }, [isAdmin, page, query, reloadKey]);

  const totalPages = listPage
    ? Math.max(1, Math.ceil(listPage.total / listPage.pageSize))
    : 1;

  function replaceClient(updated: ClientAccount) {
    setListPage((current) =>
      current
        ? {
            ...current,
            items: current.items.map((client) =>
              client.id === updated.id ? updated : client,
            ),
          }
        : current,
    );
  }

  return (
    <div>
      <Topbar
        title="Clientes"
        subtitle="Cadastro dos clientes que acessam o painel, com senha temporária no primeiro acesso."
        userInitials={getInitials(session?.user.name ?? "Usuário")}
      />

      <div className="space-y-6 p-6">
        {issuedPassword ? (
          <TemporaryPasswordNotice
            clientName={issuedPassword.client.name}
            clientEmail={issuedPassword.client.email}
            password={issuedPassword.password}
            onDismiss={() => setIssuedPassword(null)}
          />
        ) : null}

        <NewClientForm
          onCreated={(client, password) => {
            setIssuedPassword({ client, password });
            setReloadKey((key) => key + 1);
          }}
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
            placeholder="Buscar por nome ou e-mail"
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
              ? "Nenhum cliente encontrado para essa busca."
              : "Nenhum cliente cadastrado ainda."}
          </p>
        ) : null}

        {listPage ? (
          <ClientListEditor
            clients={listPage.items}
            onClientChanged={replaceClient}
            onTemporaryPassword={(client, password) =>
              setIssuedPassword({ client, password })
            }
          />
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
              Página {page} de {totalPages} · {listPage.total} clientes
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
