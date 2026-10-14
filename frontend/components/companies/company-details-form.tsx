"use client";

import { useState, useTransition } from "react";
import { setCompanyDisabled, updateCompany } from "@/lib/api";
import { formatCnpj } from "@/lib/cnpj";
import type { Company } from "@/lib/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

export function CompanyDetailsForm({
  company,
  onChanged,
}: {
  company: Company;
  onChanged: (company: Company) => void;
}) {
  const savedCnpj = company.cnpj ? formatCnpj(company.cnpj) : "";
  const [name, setName] = useState(company.name);
  const [cnpj, setCnpj] = useState(savedCnpj);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isDisabled = company.disabledAt !== null;
  const hasChanges = name.trim() !== company.name || cnpj.trim() !== savedCnpj;

  function run(action: () => Promise<Company>, fallbackError: string) {
    setError(null);
    startTransition(async () => {
      try {
        const updated = await action();
        setName(updated.name);
        setCnpj(updated.cnpj ? formatCnpj(updated.cnpj) : "");
        onChanged(updated);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : fallbackError);
      }
    });
  }

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(
      () => updateCompany(company.id, { name, cnpj }),
      "Não foi possível salvar a empresa.",
    );
  }

  function toggleDisabled() {
    if (
      !isDisabled &&
      !window.confirm(
        `Desativar ${company.name}? Ninguém da empresa consegue mais entrar, as sessões abertas são encerradas e as integrações param de funcionar.`,
      )
    ) {
      return;
    }

    run(
      () => setCompanyDisabled(company.id, !isDisabled),
      "Não foi possível alterar a situação da empresa.",
    );
  }

  return (
    <section className="app-surface card border">
      <form className="card-body gap-5" onSubmit={save}>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Dados da empresa</h2>
            <p className="text-sm text-base-content/60">
              Cliente desde {formatDate(company.createdAt)}
            </p>
          </div>
          {isDisabled ? (
            <span className="badge badge-error badge-outline">Desativada</span>
          ) : (
            <span className="badge badge-success badge-outline">Ativa</span>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_16rem]">
          <label className="form-control">
            <span className="label-text mb-2">Nome</span>
            <input
              required
              type="text"
              maxLength={191}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="input input-bordered w-full"
            />
          </label>
          <label className="form-control">
            <span className="label-text mb-2">CNPJ (opcional)</span>
            <input
              type="text"
              maxLength={18}
              value={cnpj}
              onChange={(event) => setCnpj(event.target.value)}
              className="input input-bordered w-full font-mono"
              placeholder="00.000.000/0000-00"
            />
          </label>
        </div>

        {error ? <div className="alert alert-error text-sm">{error}</div> : null}

        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            className={isDisabled ? "btn btn-outline" : "btn btn-outline btn-error"}
            onClick={toggleDisabled}
            disabled={isPending}
          >
            {isDisabled ? "Reativar empresa" : "Desativar empresa"}
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isPending || !hasChanges}
          >
            Salvar
          </button>
        </div>
      </form>
    </section>
  );
}
