"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { parseAuthSession } from "@/lib/session";
import type { AuthSession } from "@/lib/types";

const AuthSessionContext = createContext<AuthSession | null>(null);

// O layout do dashboard lê o cookie da sessão no servidor e repassa o valor
// cru: servidor e navegador renderizam com a mesma sessão, sem erro de
// hidratação. O parse fica aqui para a sessão manter a mesma referência
// enquanto o cookie não muda, já que os efeitos das páginas dependem dela.
export function AuthSessionProvider({
  rawSession,
  children,
}: {
  rawSession: string | null;
  children: ReactNode;
}) {
  const session = useMemo(() => parseAuthSession(rawSession), [rawSession]);

  return <AuthSessionContext value={session}>{children}</AuthSessionContext>;
}

export function useAuthSession() {
  return useContext(AuthSessionContext);
}
