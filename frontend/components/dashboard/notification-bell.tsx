"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuthSession } from "@/components/dashboard/auth-session-provider";
import { fetchNotifications, markNotificationsRead } from "@/lib/api";
import {
  NOTIFICATIONS_CHANGED_EVENT,
  notificationText,
} from "@/lib/notifications";
import type { NotificationList } from "@/lib/types";

// Sem push do servidor: o sino pergunta de tempos em tempos enquanto a aba está
// à vista, e logo que ela volta a ficar.
const POLL_INTERVAL_MS = 30_000;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

/** Avisos do cliente sobre o que a equipe fez nos chamados da empresa. */
export function NotificationBell() {
  const session = useAuthSession();
  const isClient = session?.user.role === "CLIENT";
  const [data, setData] = useState<NotificationList | null>(null);

  const refresh = useCallback(async () => {
    try {
      setData(await fetchNotifications());
    } catch {
      // Falha momentânea: o sino mantém o que já mostrava e tenta de novo.
    }
  }, []);

  useEffect(() => {
    if (!isClient) {
      return;
    }

    void fetchNotifications()
      .then(setData)
      .catch(() => {
        // Tenta de novo no próximo ciclo.
      });

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }, POLL_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };
    const onChanged = () => void refresh();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
    };
  }, [isClient, refresh]);

  if (!isClient) {
    return null;
  }

  const unreadCount = data?.unreadCount ?? 0;

  async function markRead(incidentId?: number) {
    try {
      await markNotificationsRead(incidentId);
    } finally {
      await refresh();
    }
  }

  return (
    <div className="dropdown dropdown-end">
      <div
        tabIndex={0}
        role="button"
        className="btn btn-sm btn-ghost btn-circle indicator"
        aria-label={
          unreadCount
            ? `Notificações: ${unreadCount} não lidas`
            : "Notificações"
        }
        title="Notificações"
      >
        {unreadCount ? (
          <span className="indicator-item badge badge-primary badge-xs">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-5"
          aria-hidden="true"
        >
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
      </div>

      <div
        tabIndex={0}
        className="dropdown-content app-surface z-20 mt-3 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border p-2 shadow-lg"
      >
        <div className="flex items-center justify-between gap-2 px-2 py-1">
          <p className="text-sm font-semibold">Notificações</p>
          {unreadCount ? (
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => void markRead()}
            >
              Marcar todas como lidas
            </button>
          ) : null}
        </div>

        {data?.items.length ? (
          <ul className="max-h-96 overflow-y-auto">
            {data.items.map((notification) => (
              <li key={notification.id}>
                <Link
                  href={`/dashboard/incidents/${notification.incident.id}`}
                  onClick={() => void markRead(notification.incident.id)}
                  className="flex gap-3 rounded-xl px-2 py-2 hover:bg-base-200"
                >
                  <span
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${
                      notification.readAt ? "bg-transparent" : "bg-primary"
                    }`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span
                      className={`block text-sm ${
                        notification.readAt ? "text-base-content/70" : "font-medium"
                      }`}
                    >
                      {notificationText(notification)}
                    </span>
                    <span className="block truncate text-xs text-base-content/60">
                      #{notification.incident.id} · {notification.incident.title}
                    </span>
                    <span className="block text-xs text-base-content/50">
                      {formatDate(notification.createdAt)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-2 py-4 text-sm text-base-content/60">
            {data ? "Nenhuma notificação por enquanto." : "Carregando..."}
          </p>
        )}
      </div>
    </div>
  );
}
