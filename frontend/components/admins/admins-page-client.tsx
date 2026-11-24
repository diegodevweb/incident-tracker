"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OneTimeSecretNotice } from "@/components/companies/one-time-secret-notice";
import { useAuthSession } from "@/components/dashboard/auth-session-provider";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import { Topbar } from "@/components/dashboard/topbar";
import {
  ManagedUserList,
  type ManagedUserActions,
} from "@/components/users/managed-user-list";
import { NewManagedUserForm } from "@/components/users/new-managed-user-form";
import {
  createAdmin,
  fetchAdmins,
  resetAdminPassword,
  setAdminDisabled,
  updateAdmin,
} from "@/lib/api";
import { getInitials } from "@/lib/session";
import type { ManagedUser } from "@/lib/types";

type IssuedPassword = { user: ManagedUser; password: string };

const adminActions: ManagedUserActions = {
  update: updateAdmin,
  resetPassword: resetAdminPassword,
  setDisabled: setAdminDisabled,
};

export function AdminsPageClient() {
  const router = useRouter();
  const session = useAuthSession();
  const isAdmin = session?.user.role === "ADMIN";
  const [admins, setAdmins] = useState<ManagedUser[] | null>(null);
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

    void fetchAdmins()
      .then((loaded) => {
        setLoadError(null);
        setAdmins(loaded);
      })
      .catch(() => {
        setLoadError("Não foi possível carregar os admins.");
      });
  }, [isAdmin]);

  async function refreshAdmins() {
    try {
      setAdmins(await fetchAdmins());
      setLoadError(null);
    } catch {
      setLoadError("Não foi possível atualizar os admins.");
    }
  }

  function replaceAdmin(updated: ManagedUser) {
    setAdmins((current) =>
      (current ?? []).map((admin) =>
        admin.id === updated.id ? updated : admin,
      ),
    );
  }

  return (
    <div>
      <Topbar
        title="Admins"
        subtitle="Pessoas da equipe que atendem os chamados e cuidam dos clientes."
        userInitials={getInitials(session?.user.name ?? "Usuário")}
      />

      <div className="space-y-6 p-6">
        <section className="app-surface card border">
          <div className="card-body gap-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">
                  Equipe
                </h2>
                <p className="mt-1 text-sm text-base-content/60">
                  Todo admin vê os chamados de todas as empresas e pode
                  cadastrar clientes e outros admins.
                </p>
              </div>
              <RefreshButton
                label="Atualizar admins"
                onRefresh={refreshAdmins}
              />
            </div>

            {loadError ? (
              <div className="alert alert-error text-sm">{loadError}</div>
            ) : null}

            {issuedPassword ? (
              <OneTimeSecretNotice
                title={`Senha temporária de ${issuedPassword.user.name} (${issuedPassword.user.email})`}
                description="Repasse por um canal seguro. Ela não aparece de novo; no primeiro acesso a pessoa é obrigada a trocá-la."
                secret={issuedPassword.password}
                onDismiss={() => setIssuedPassword(null)}
              />
            ) : null}

            <NewManagedUserForm
              title="Novo admin"
              submitLabel="Cadastrar admin"
              emailPlaceholder="pessoa@equipe.com"
              create={createAdmin}
              onCreated={(user, password) => {
                setAdmins((current) =>
                  [...(current ?? []), user].sort((a, b) =>
                    a.name.localeCompare(b.name, "pt-BR"),
                  ),
                );
                setIssuedPassword({ user, password });
              }}
            />

            {admins ? (
              <ManagedUserList
                users={admins}
                actions={adminActions}
                currentUserId={session?.user.id}
                disableNote="Os chamados, mensagens e eventos dela continuam no histórico."
                emptyMessage="Nenhum admin cadastrado."
                onUserChanged={replaceAdmin}
                onTemporaryPassword={(user, password) =>
                  setIssuedPassword({ user, password })
                }
              />
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
