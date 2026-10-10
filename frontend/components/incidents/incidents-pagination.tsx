import Link from "next/link";

type IncidentsPaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  /** Filtros ativos, repetidos nos links para trocar de página sem perdê-los. */
  params: Record<string, string | undefined>;
};

function buildHref(params: IncidentsPaginationProps["params"], page: number) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });

  if (page > 1) search.set("page", String(page));

  const query = search.toString();

  return `/dashboard/incidents${query ? `?${query}` : ""}`;
}

export function IncidentsPagination({
  page,
  pageSize,
  total,
  params,
}: IncidentsPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, total);

  if (total <= pageSize && page === 1) {
    return null;
  }

  return (
    <nav
      aria-label="Paginação"
      className="flex flex-wrap items-center justify-between gap-3 text-sm"
    >
      <p className="text-base-content/60">
        {total === 0
          ? "Nenhum ticket nesta página."
          : `${firstItem}–${lastItem} de ${total} tickets`}
      </p>

      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link
            href={buildHref(params, page - 1)}
            className="btn btn-sm btn-ghost"
          >
            Anterior
          </Link>
        ) : (
          <span className="btn btn-sm btn-ghost btn-disabled">Anterior</span>
        )}

        <span className="px-2 text-base-content/60">
          Página {page} de {totalPages}
        </span>

        {page < totalPages ? (
          <Link
            href={buildHref(params, page + 1)}
            className="btn btn-sm btn-ghost"
          >
            Próxima
          </Link>
        ) : (
          <span className="btn btn-sm btn-ghost btn-disabled">Próxima</span>
        )}
      </div>
    </nav>
  );
}
