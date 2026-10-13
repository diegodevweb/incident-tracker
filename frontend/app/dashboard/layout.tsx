import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { AuthSessionProvider } from "@/components/dashboard/auth-session-provider";
import { Sidebar } from "@/components/dashboard/sidebar";
import { getSessionCookieName } from "@/lib/server-api";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const rawSession = (await cookies()).get(getSessionCookieName())?.value ?? null;

  return (
    <AuthSessionProvider rawSession={rawSession}>
      <div className="min-h-screen md:grid md:grid-cols-[18rem_1fr]">
        <Sidebar />
        <main className="app-main min-h-screen">{children}</main>
      </div>
    </AuthSessionProvider>
  );
}
