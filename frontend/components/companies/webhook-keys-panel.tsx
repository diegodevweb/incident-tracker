"use client";

import { useEffect, useState, useTransition } from "react";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import { createWebhookKey, fetchWebhookKeys, revokeWebhookKey } from "@/lib/api";
import type { WebhookKey } from "@/lib/types";
import { OneTimeSecretNotice } from "./one-time-secret-notice";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

/**
 * Chaves que as integrações da empresa usam no webhook de erros. A chave
 * completa só aparece uma vez, logo depois de criada.
 */
export function WebhookKeysPanel({
  companyId,
  companyDisabled,
}: {
  companyId: number;
  companyDisabled: boolean;
}) {
  const [keys, setKeys] = useState<WebhookKey[] | null>(null);
  const [name, setName] = useState("");
  const [issued, setIssued] = useState<{ name: string; key: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    void fetchWebhookKeys(companyId)
      .then(setKeys)
      .catch(() => setError("Não foi possível carregar as integrações."));
  }, [companyId]);

  async function refreshKeys() {
    try {
      setKeys(await fetchWebhookKeys(companyId));
      setError(null);
    } catch {
      setError("Não foi possível atualizar as integrações.");
    }
  }

  function run(action: () => Promise<void>, fallbackError: string) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : fallbackError);
      }
    });
  }

  function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(async () => {
      const { key, ...created } = await createWebhookKey(companyId, name);
      setKeys((current) => [created, ...(current ?? [])]);
      setIssued({ name: created.name, key });
      setName("");
    }, "Não foi possível criar a chave.");
  }

  function revoke(key: WebhookKey) {
    if (
      !window.confirm(
        `Revogar a chave "${key.name}"? A integração que usa essa chave para de abrir chamados na hora.`,
      )
    ) {
      return;
    }

    run(async () => {
      const revoked = await revokeWebhookKey(companyId, key.id);
      setKeys((current) =>
        (current ?? []).map((item) => (item.id === revoked.id ? revoked : item)),
      );
    }, "Não foi possível revogar a chave.");
  }

  return (
    <section className="app-surface card border">
      <div className="card-body gap-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Integrações</h2>
            <p className="mt-1 text-sm text-base-content/60">
              Cada sistema da empresa que envia erros pelo webhook usa uma chave
              no header <code className="font-mono">x-api-key</code>. Para
              trocar uma chave, crie a nova, configure na integração e revogue
              a antiga.
              {companyDisabled
                ? " Com a empresa desativada, nenhuma chave funciona."
                : ""}
            </p>
          </div>
          <RefreshButton label="Atualizar integrações" onRefresh={refreshKeys} />
        </div>

        {issued ? (
          <OneTimeSecretNotice
            title={`Chave da integração "${issued.name}"`}
            description="Copie agora e configure na integração por um canal seguro. Ela não aparece de novo: depois de fechar, só criando outra."
            secret={issued.key}
            onDismiss={() => setIssued(null)}
          />
        ) : null}

        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={create}
        >
          <label className="form-control w-full sm:max-w-md">
            <span className="label-text mb-2">Nome da integração</span>
            <input
              required
              type="text"
              maxLength={191}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="input input-bordered w-full"
              placeholder="ERP produção"
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={isPending}>
            Criar chave
          </button>
        </form>

        {error ? <div className="alert alert-error text-sm">{error}</div> : null}

        {keys && keys.length === 0 ? (
          <p className="text-sm text-base-content/60">
            Nenhuma integração cadastrada.
          </p>
        ) : null}

        {keys && keys.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr className="text-base-content/60">
                  <th>Integração</th>
                  <th>Chave</th>
                  <th>Criada em</th>
                  <th>Último uso</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => (
                  <tr key={key.id}>
                    <td className="font-medium">{key.name}</td>
                    <td className="font-mono text-sm">itk_{key.prefix}_…</td>
                    <td className="text-sm">{formatDateTime(key.createdAt)}</td>
                    <td className="text-sm">
                      {key.lastUsedAt ? formatDateTime(key.lastUsedAt) : "Nunca"}
                    </td>
                    <td className="text-right">
                      {key.revokedAt ? (
                        <span className="badge badge-ghost">
                          Revogada em {formatDateTime(key.revokedAt)}
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-outline btn-error btn-xs"
                          onClick={() => revoke(key)}
                          disabled={isPending}
                        >
                          Revogar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}
