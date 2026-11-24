"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { countLabel } from "@/lib/labels";

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
/** O mesmo padrão da API; quando é ele, o tamanho fica fora da URL. */
export const DEFAULT_PAGE_SIZE = 20;

type IncidentsPaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  /** Filtros ativos, repetidos nos links para trocar de página sem perdê-los. */
  params: Record<string, string | undefined>;
};

export function buildIncidentsHref(
  params: IncidentsPaginationProps["params"],
  page: number,
  pageSize: number,
) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });

  if (page > 1) search.set("page", String(page));
  if (pageSize !== DEFAULT_PAGE_SIZE) search.set("pageSize", String(pageSize));

  const query = search.toString();

  return `/dashboard/incidents${query ? `?${query}` : ""}`;
}

// Primeira, última e as vizinhas da atual; o resto vira "…". Um buraco de uma
// página só mostra a página, que ocupa o mesmo espaço das reticências.
function pageItems(page: number, totalPages: number) {
  const pages = [...new Set([1, page - 1, page, page + 1, totalPages])]
    .filter((item) => item >= 1 && item <= totalPages)
    .sort((left, right) => left - right);
  const items: (number | "gap")[] = [];

  pages.forEach((item, index) => {
    const previous = pages[index - 1];

    if (previous !== undefined && item - previous === 2) {
      items.push(item - 1);
    } else if (previous !== undefined && item - previous > 2) {
      items.push("gap");
    }

    items.push(item);
  });

  return items;
}

export function IncidentsPagination({
  page,
  pageSize,
  total,
  params,
}: IncidentsPaginationProps) {
  const router = useRouter();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstItem = (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, total);
  // Uma página que deixou de existir (ex.: tickets excluídos) volta para a última.
  const previousPage = Math.min(page - 1, totalPages);

  function pageLink(target: number, label: React.ReactNode, ariaLabel?: string) {
    return (
      <Link
        key={`page-${ariaLabel ?? target}`}
        href={buildIncidentsHref(params, target, pageSize)}
        scroll={false}
        aria-label={ariaLabel}
        aria-current={target === page ? "page" : undefined}
        className={`join-item btn btn-sm ${target === page ? "btn-primary" : ""}`}
      >
        {label}
      </Link>
    );
  }

  return (
    <nav
      aria-label="Paginação"
      className="flex flex-wrap items-center justify-between gap-3 text-sm"
    >
      <p className="text-base-content/60">
        {total === 0
          ? "Nenhum ticket encontrado."
          : firstItem > total
            ? "Nenhum ticket nesta página."
            : `${firstItem}–${lastItem} de ${countLabel(total, "ticket", "tickets")}`}
      </p>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-base-content/60">
          Por página
          <select
            className="select select-sm w-20"
            value={pageSize}
            onChange={(event) =>
              router.push(
                buildIncidentsHref(params, 1, Number(event.target.value)),
                { scroll: false },
              )
            }
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        {totalPages > 1 ? (
          <div className="join">
            {page > 1
              ? pageLink(previousPage, "‹", "Página anterior")
              : (
                <span className="join-item btn btn-sm btn-disabled" aria-hidden="true">
                  ‹
                </span>
              )}

            {pageItems(page, totalPages).map((item, index) =>
              item === "gap" ? (
                <span
                  key={`gap-${index}`}
                  className="join-item btn btn-sm btn-disabled"
                  aria-hidden="true"
                >
                  …
                </span>
              ) : (
                pageLink(item, item)
              ),
            )}

            {page < totalPages
              ? pageLink(page + 1, "›", "Próxima página")
              : (
                <span className="join-item btn btn-sm btn-disabled" aria-hidden="true">
                  ›
                </span>
              )}
          </div>
        ) : null}
      </div>
    </nav>
  );
}
