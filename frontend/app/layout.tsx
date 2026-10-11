import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
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

const themeInitScript = `
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
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Nonce gerado pelo proxy.ts. Ler headers() também torna todas as páginas
  // dinâmicas, que é o que permite ao Next aplicar o nonce aos scripts dele.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="pt-BR"
      data-theme="light"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/*
          Script comum em vez de next/script: o navegador esconde o atributo nonce
          do DOM depois de ler, e o React acusaria diferença na hidratação de
          qualquer script com nonce dentro da árvore. Inline no head ele também
          roda antes da primeira pintura, sem piscar o tema.
        */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
      </head>
      <body className="min-h-full font-sans text-base-content">
        {children}
      </body>
    </html>
  );
}
