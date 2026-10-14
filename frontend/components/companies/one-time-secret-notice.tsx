"use client";

import { useState } from "react";

/**
 * Senha temporária ou chave de webhook: só existe nesta tela. A API guarda
 * apenas o hash e não a devolve de novo; fechar o aviso descarta o valor.
 */
export function OneTimeSecretNotice({
  title,
  description,
  secret,
  onDismiss,
}: {
  title: string;
  description: string;
  secret: string;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="alert alert-warning flex flex-col items-start gap-3">
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-sm">{description}</p>
      </div>
      <code className="max-w-full break-all rounded-lg bg-base-100 px-3 py-2 font-mono text-base text-base-content select-all">
        {secret}
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
