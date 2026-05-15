"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/dashboard/topbar";
import { mockClients } from "@/lib/mock-data";
import { getAuthSession, getInitials } from "@/lib/session";
import type { AuthSession } from "@/lib/types";
import { ClientListEditor } from "./client-list-editor";

export function ClientsPageClient() {
  const router = useRouter();
  const [session] = useState<AuthSession | null>(() => getAuthSession());
  const isAdmin = session?.user.role === "ADMIN";

  useEffect(() => {
    if (!session) {
      router.replace("/login");
      return;
    }

    if (!isAdmin) {
      router.replace("/dashboard/profile");
    }
  }, [isAdmin, router, session]);

  return (
    <div>
      <Topbar
        title="Clientes"
        subtitle="Página administrativa para revisão e atualização dos dados cadastrais e operacionais dos clientes."
        userInitials={getInitials(session?.user.name ?? "Usuário")}
      />

      <div className="space-y-6 p-6">
        <div className="app-surface card border">
          <div className="card-body">
            <h2 className="text-xl font-semibold tracking-tight">
              Gestão administrativa de contas
            </h2>
            <p className="text-sm text-base-content/60">
              Edição temporária com dados locais enquanto o endpoint administrativo ainda não existe no Laravel.
            </p>
          </div>
        </div>

        <ClientListEditor clients={mockClients} />
      </div>
    </div>
  );
}
