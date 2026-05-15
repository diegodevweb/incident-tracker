"use client";

import { useEffect, useState } from "react";

type ThemeName = "light" | "dark";

const storageKey = "incident-tracker-theme";

function getPreferredTheme(): ThemeName {
  if (typeof window === "undefined") {
    return "light";
  }

  const storedTheme = window.localStorage.getItem(storageKey);
  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: ThemeName) {
  document.documentElement.setAttribute("data-theme", theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeName>(getPreferredTheme);
  const isDark = theme === "dark";

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function toggleTheme() {
    const nextTheme: ThemeName = isDark ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem(storageKey, nextTheme);
  }

  return (
    <button
      type="button"
      className="btn btn-sm btn-ghost btn-circle"
      onClick={toggleTheme}
      aria-label={`Ativar tema ${isDark ? "claro" : "escuro"}`}
      title={`Tema ${isDark ? "escuro" : "claro"}`}
    >
      {isDark ? (
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
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 1 0 9.8 9.8Z" />
        </svg>
      ) : (
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
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2.2" />
          <path d="M12 19.8V22" />
          <path d="M4.93 4.93l1.56 1.56" />
          <path d="M17.51 17.51l1.56 1.56" />
          <path d="M2 12h2.2" />
          <path d="M19.8 12H22" />
          <path d="M4.93 19.07l1.56-1.56" />
          <path d="M17.51 6.49l1.56-1.56" />
        </svg>
      )}
    </button>
  );
}
