"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/dashboard/topbar";
import { userRoleLabel } from "@/lib/labels";
import { mockProfiles } from "@/lib/mock-data";
import { getAuthSession, getInitials } from "@/lib/session";
import type { AuthSession } from "@/lib/types";
import { ProfileForm } from "./profile-form";

export function ProfilePageClient() {
  const router = useRouter();
  const [session] = useState<AuthSession | null>(() => getAuthSession());
  const activeRole = session?.user.role ?? "CLIENT";
  const baseProfile = mockProfiles[activeRole];
  const profile = {
    ...baseProfile,
    fullName: session?.user.name ?? baseProfile.fullName,
    email: session?.user.email ?? baseProfile.email,
  };

  useEffect(() => {
    if (!session) {
      router.replace("/login");
    }
  }, [router, session]);

  return (
    <div>
      <Topbar
        title="Meu perfil"
        subtitle={`Edição de conta para ${userRoleLabel[activeRole].toLowerCase()}, com atualização de senha e dados cadastrais.`}
        userInitials={getInitials(profile.fullName)}
      />

      <div className="space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="app-surface-muted rounded-3xl border p-5">
            <p className="text-sm text-base-content/60">Perfil</p>
            <p className="mt-2 text-2xl font-semibold">{userRoleLabel[activeRole]}</p>
          </div>
          <div className="app-surface-muted rounded-3xl border p-5">
            <p className="text-sm text-base-content/60">Empresa</p>
            <p className="mt-2 text-2xl font-semibold">{profile.companyName}</p>
          </div>
          <div className="app-surface-muted rounded-3xl border p-5">
            <p className="text-sm text-base-content/60">Plano</p>
            <p className="mt-2 text-2xl font-semibold">{profile.plan}</p>
          </div>
        </div>

        <ProfileForm profile={profile} />
      </div>
    </div>
  );
}
