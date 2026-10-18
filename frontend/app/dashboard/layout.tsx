import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { AuthSessionProvider } from "@/components/dashboard/auth-session-provider";
import { ForcedPasswordChange } from "@/components/dashboard/forced-password-change";
import { Sidebar } from "@/components/dashboard/sidebar";
import { getSessionCookieName } from "@/lib/server-api";
import { parseAuthSession } from "@/lib/session";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const rawSession = (await cookies()).get(getSessionCookieName())?.value ?? null;
  const session = parseAuthSession(rawSession);

  return (
    <AuthSessionProvider rawSession={rawSession}>
      {session?.user.mustChangePassword ? (
        <ForcedPasswordChange userName={session.user.name} />
      ) : (
        <div className="min-h-screen md:grid md:grid-cols-[18rem_1fr] print:block print:min-h-0">
          <Sidebar />
          <main className="app-main min-h-screen print:min-h-0">{children}</main>
        </div>
      )}
    </AuthSessionProvider>
  );
}
