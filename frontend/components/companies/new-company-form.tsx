"use client";

import { useState, useTransition } from "react";
import { createCompany } from "@/lib/api";
import type { Company } from "@/lib/types";

export function NewCompanyForm({
  onCreated,
}: {
  onCreated: (company: Company) => void;
}) {
  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        onCreated(await createCompany({ name, cnpj }));
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Não foi possível cadastrar a empresa.",
        );
      }
    });
  }

  return (
    <section className="app-surface card border">
      <form className="card-body gap-5" onSubmit={handleSubmit}>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Nova empresa</h2>
          <p className="mt-1 text-sm text-base-content/60">
            Depois de cadastrar, você cadastra as pessoas que vão acessar o
            painel e, se houver, as integrações.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_16rem_auto] md:items-end">
          <label className="form-control">
            <span className="label-text mb-2">Nome</span>
            <input
              required
              type="text"
              maxLength={191}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="input input-bordered w-full"
              placeholder="Razão social ou nome fantasia"
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
          <button type="submit" className="btn btn-primary" disabled={isPending}>
            {isPending ? "Cadastrando..." : "Cadastrar empresa"}
          </button>
        </div>

        {error ? <div className="alert alert-error text-sm">{error}</div> : null}
      </form>
    </section>
  );
}
