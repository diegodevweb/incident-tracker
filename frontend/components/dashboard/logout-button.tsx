"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { clearAuthSession } from "@/lib/session";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="btn btn-sm btn-outline"
      onClick={() => {
        startTransition(async () => {
          await fetch("/api/auth/logout", {
            method: "POST",
            credentials: "same-origin",
          });
          clearAuthSession();
          router.push("/login");
        });
      }}
      disabled={isPending}
    >
      {isPending ? "Saindo..." : "Sair"}
    </button>
  );
}
