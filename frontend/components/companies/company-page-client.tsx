"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/components/dashboard/auth-session-provider";
import { Topbar } from "@/components/dashboard/topbar";
import { ApiError, fetchCompany, fetchCompanyUsers } from "@/lib/api";
import { getInitials } from "@/lib/session";
import type { Company, CompanyUser } from "@/lib/types";
import { CompanyDetailsForm } from "./company-details-form";
import { CompanyUserList } from "./company-user-list";
import { NewCompanyUserForm } from "./new-company-user-form";
import { OneTimeSecretNotice } from "./one-time-secret-notice";
import { WebhookKeysPanel } from "./webhook-keys-panel";

type IssuedPassword = { user: CompanyUser; password: string };

export function CompanyPageClient({ id }: { id: number }) {
  const router = useRouter();
  const session = useAuthSession();
  const isAdmin = session?.user.role === "ADMIN";
  const [company, setCompany] = useState<Company | null>(null);
  const [users, setUsers] = useState<CompanyUser[] | null>(null);
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

    void Promise.all([fetchCompany(id), fetchCompanyUsers(id)])
      .then(([loadedCompany, loadedUsers]) => {
        setLoadError(null);
        setCompany(loadedCompany);
        setUsers(loadedUsers);
      })
      .catch((caught: unknown) => {
        setLoadError(
          caught instanceof ApiError && caught.status === 404
            ? "Empresa não encontrada."
            : "Não foi possível carregar a empresa.",
        );
      });
  }, [id, isAdmin]);

  function replaceUser(updated: CompanyUser) {
    setUsers((current) =>
      (current ?? []).map((user) => (user.id === updated.id ? updated : user)),
    );
  }

  return (
    <div>
      <Topbar
        title={company?.name ?? "Cliente"}
        subtitle="Dados da empresa, quem acessa o painel por ela e as integrações."
        userInitials={getInitials(session?.user.name ?? "Usuário")}
      />

      <div className="space-y-6 p-6">
        <Link href="/dashboard/clients" className="btn btn-ghost btn-sm">
          ← Voltar para clientes
        </Link>

        {loadError ? (
          <div className="alert alert-error text-sm">{loadError}</div>
        ) : null}

        {company && users ? (
          <>
            <CompanyDetailsForm
              key={company.id}
              company={company}
              onChanged={setCompany}
            />

            <section className="app-surface card border">
              <div className="card-body gap-5">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">
                    Usuários
                  </h2>
                  <p className="mt-1 text-sm text-base-content/60">
                    Todas as pessoas da empresa veem todos os chamados dela,
                    inclusive os abertos pela integração.
                  </p>
                </div>

                {issuedPassword ? (
                  <OneTimeSecretNotice
                    title={`Senha temporária de ${issuedPassword.user.name} (${issuedPassword.user.email})`}
                    description="Repasse por um canal seguro. Ela não aparece de novo; no primeiro acesso a pessoa é obrigada a trocá-la."
                    secret={issuedPassword.password}
                    onDismiss={() => setIssuedPassword(null)}
                  />
                ) : null}

                <NewCompanyUserForm
                  companyId={company.id}
                  onCreated={(user, password) => {
                    setUsers((current) =>
                      [...(current ?? []), user].sort((a, b) =>
                        a.name.localeCompare(b.name, "pt-BR"),
                      ),
                    );
                    setIssuedPassword({ user, password });
                  }}
                />

                <CompanyUserList
                  companyId={company.id}
                  users={users}
                  onUserChanged={replaceUser}
                  onTemporaryPassword={(user, password) =>
                    setIssuedPassword({ user, password })
                  }
                />
              </div>
            </section>

            <WebhookKeysPanel
              companyId={company.id}
              companyDisabled={company.disabledAt !== null}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
