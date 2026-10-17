"use client";

import { useState } from "react";

/**
 * Ícone no canto do card que busca os dados dele de novo, sem recarregar a
 * página. Quem passa `onRefresh` trata o erro; o botão só gira enquanto espera.
 */
export function RefreshButton({
  label,
  onRefresh,
}: {
  label: string;
  onRefresh: () => Promise<void>;
}) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    // Dentro de um <summary>, o clique não abre nem fecha a seção.
    event.preventDefault();

    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);
    void onRefresh().finally(() => setIsRefreshing(false));
  }

  return (
    <button
      type="button"
      className="btn btn-sm btn-ghost btn-circle shrink-0"
      onClick={handleClick}
      aria-label={label}
      aria-busy={isRefreshing}
      title={label}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`size-4 ${isRefreshing ? "animate-spin" : ""}`}
        aria-hidden="true"
      >
        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
      </svg>
    </button>
  );
}
