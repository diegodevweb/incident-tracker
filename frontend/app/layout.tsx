import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Alertta",
  description: "Gestão de tickets, logs e suporte operacional",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      data-theme="light"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans text-base-content">
        <Script id="theme-init" strategy="beforeInteractive">{`
          (() => {
            const storageKey = "incident-tracker-theme";
            const storedTheme = window.localStorage.getItem(storageKey);
            const theme =
              storedTheme === "light" || storedTheme === "dark"
                ? storedTheme
                : window.matchMedia("(prefers-color-scheme: dark)").matches
                  ? "dark"
                  : "light";

            document.documentElement.setAttribute("data-theme", theme);
          })();
        `}</Script>
        {children}
      </body>
    </html>
  );
}
