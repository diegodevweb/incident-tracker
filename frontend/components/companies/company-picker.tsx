"use client";

import { useEffect, useState } from "react";
import { fetchCompanies } from "@/lib/api";
import { formatCnpj } from "@/lib/cnpj";
import type { Company } from "@/lib/types";

// A API devolve no máximo 100 por página; acima disso, a busca restringe a lista.
const PAGE_SIZE = 100;

/** Empresa ativa para o admin abrir um ticket em nome dela. */
export function CompanyPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (companyId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchCompanies({ status: "active", pageSize: PAGE_SIZE, q: query })
      .then((page) => {
        setError(null);
        setCompanies(page.items);
        setTotal(page.total);
      })
      .catch(() => setError("Não foi possível carregar as empresas."));
  }, [query]);

  const showSearch = total > PAGE_SIZE || query !== "";

  return (
    <div className="form-control md:col-span-2">
      <span className="label-text mb-2">Empresa</span>

      {showSearch ? (
        <div className="mb-2 flex gap-2">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              // Enter aqui busca a empresa, não envia o ticket.
              if (event.key === "Enter") {
                event.preventDefault();
                setQuery(search.trim());
              }
            }}
            className="input input-bordered w-full"
            placeholder="Buscar por nome ou CNPJ"
            maxLength={191}
          />
          <button
            type="button"
            className="btn"
            onClick={() => setQuery(search.trim())}
          >
            Buscar
          </button>
        </div>
      ) : null}

      <select
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="select select-bordered w-full"
        disabled={!companies}
      >
        <option value="">
          {companies && companies.length === 0
            ? "Nenhuma empresa ativa encontrada"
            : "Selecione a empresa"}
        </option>
        {(companies ?? []).map((company) => (
          <option key={company.id} value={company.id}>
            {company.name}
            {company.cnpj ? ` · ${formatCnpj(company.cnpj)}` : ""}
          </option>
        ))}
      </select>

      {error ? <p className="mt-2 text-sm text-error">{error}</p> : null}
    </div>
  );
}
