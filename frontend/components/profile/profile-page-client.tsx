"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/components/dashboard/auth-session-provider";
import { Topbar } from "@/components/dashboard/topbar";
import { fetchAccount } from "@/lib/api";
import { userRoleLabel } from "@/lib/labels";
import { getInitials } from "@/lib/session";
import type { AccountProfile } from "@/lib/types";
import { ProfileForm } from "./profile-form";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

export function ProfilePageClient() {
  const router = useRouter();
  const session = useAuthSession();
  const [account, setAccount] = useState<AccountProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      router.replace("/login");
      return;
    }

    void fetchAccount()
      .then((data) => {
        setLoadError(null);
        setAccount(data);
      })
      .catch(() => {
        setLoadError("Não foi possível carregar sua conta.");
      });
  }, [router, session]);

  return (
    <div>
      <Topbar
        title="Meu perfil"
        subtitle="Seus dados de acesso e a troca de senha."
        userInitials={getInitials(session?.user.name ?? "Usuário")}
      />

      <div className="space-y-6 p-6">
        {loadError ? (
          <div className="alert alert-error text-sm">{loadError}</div>
        ) : null}

        {account ? (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="app-surface-muted rounded-3xl border p-5">
                <p className="text-sm text-base-content/60">Perfil</p>
                <p className="mt-2 text-2xl font-semibold">
                  {userRoleLabel[account.role]}
                </p>
              </div>
              <div className="app-surface-muted rounded-3xl border p-5">
                <p className="text-sm text-base-content/60">E-mail</p>
                <p className="mt-2 truncate text-lg font-semibold">
                  {account.email}
                </p>
              </div>
              <div className="app-surface-muted rounded-3xl border p-5">
                <p className="text-sm text-base-content/60">Conta criada em</p>
                <p className="mt-2 text-lg font-semibold">
                  {formatDate(account.createdAt)}
                </p>
              </div>
            </div>

            <ProfileForm
              key={account.id}
              account={account}
              onUpdated={setAccount}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
