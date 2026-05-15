"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { userRoleLabel } from "@/lib/labels";
import { getAuthSession } from "@/lib/session";
import type { AuthSession, UserRole } from "@/lib/types";

const navItems: {
  href: string;
  label: string;
  tag: string;
  roles: UserRole[];
}[] = [
  {
    href: "/dashboard/incidents",
    label: "Tickets",
    tag: "Visão geral",
    roles: ["ADMIN", "CLIENT"],
  },
  {
    href: "/dashboard/incidents/new",
    label: "Novo ticket",
    tag: "Abertura",
    roles: ["ADMIN", "CLIENT"],
  },
  {
    href: "/dashboard/reports",
    label: "Relatórios",
    tag: "Mensal",
    roles: ["ADMIN"],
  },
  {
    href: "/dashboard/profile",
    label: "Meu perfil",
    tag: "Conta",
    roles: ["ADMIN", "CLIENT"],
  },
  {
    href: "/dashboard/clients",
    label: "Clientes",
    tag: "Admin",
    roles: ["ADMIN"],
  },
];

export function SidebarNav() {
  const pathname = usePathname();
  const [session] = useState<AuthSession | null>(() => getAuthSession());
  const role: UserRole = session?.user.role === "CLIENT" ? "CLIENT" : "ADMIN";

  return (
    <>
      <div className="space-y-3">
        <div>
          <p className="badge badge-outline badge-primary">
            Alertta
          </p>
        </div>
        <div className="text-lg font-semibold tracking-tight">Painel operacional</div>
        <p className="text-sm text-base-content/60">
          {session?.user.email ?? "Sessão local"}
        </p>
      </div>

      <nav className="app-surface-muted menu gap-2 rounded-box border p-3">
        {navItems
          .filter((item) => item.roles.includes(role))
          .map((item) => {
            const isActive = pathname === item.href;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center justify-between rounded-xl px-3 py-2 transition-colors ${
                    isActive ? "bg-primary text-primary-content" : "hover:bg-base-100/70"
                  }`}
                >
                  <span>{item.label}</span>
                  <span
                    className={`text-xs ${
                      isActive ? "text-primary-content/75" : "text-base-content/50"
                    }`}
                  >
                    {item.tag}
                  </span>
                </Link>
              </li>
            );
          })}
      </nav>

      <div className="app-surface-muted mt-auto rounded-2xl border p-4">
        <p className="text-sm font-medium">Sessão ativa</p>
        <p className="mt-1 text-sm text-base-content/60">
          Perfil atual: {userRoleLabel[role]}
        </p>
      </div>
    </>
  );
}
