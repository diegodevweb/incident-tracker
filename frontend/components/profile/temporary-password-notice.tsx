"use client";

import { useState } from "react";

/**
 * A senha temporária só existe nesta tela: a API guarda apenas o hash e não a
 * devolve de novo. Fechar o aviso descarta a senha.
 */
export function TemporaryPasswordNotice({
  clientName,
  clientEmail,
  password,
  onDismiss,
}: {
  clientName: string;
  clientEmail: string;
  password: string;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="alert alert-warning flex flex-col items-start gap-3">
      <div>
        <p className="font-semibold">
          Senha temporária de {clientName} ({clientEmail})
        </p>
        <p className="text-sm">
          Repasse ao cliente por um canal seguro. Ela não aparece de novo; no
          primeiro acesso o cliente é obrigado a trocá-la.
        </p>
      </div>
      <code className="rounded-lg bg-base-100 px-3 py-2 font-mono text-base text-base-content select-all">
        {password}
      </code>
      <div className="flex gap-2">
        <button type="button" className="btn btn-sm" onClick={copy}>
          {copied ? "Copiada" : "Copiar"}
        </button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={onDismiss}>
          Já repassei, fechar
        </button>
      </div>
    </div>
  );
}
