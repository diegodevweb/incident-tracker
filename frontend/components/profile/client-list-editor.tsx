import { incidentEnvironmentLabel } from "@/lib/labels";
import type { ClientAccount } from "@/lib/types";

export function ClientListEditor({ clients }: { clients: ClientAccount[] }) {
  return (
    <section className="space-y-4">
      {clients.map((client) => (
        <article key={client.id} className="app-surface card border">
          <div className="card-body gap-5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">
                  {client.companyName}
                </h2>
                <p className="text-sm text-base-content/60">
                  Contato principal: {client.contactName}
                </p>
              </div>
              <div className="badge badge-outline">{client.slaPlan}</div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="form-control">
                <span className="label-text mb-2">Contato</span>
                <input type="text" defaultValue={client.contactName} className="input input-bordered w-full" />
              </label>
              <label className="form-control">
                <span className="label-text mb-2">E-mail</span>
                <input type="email" defaultValue={client.email} className="input input-bordered w-full" />
              </label>
              <label className="form-control">
                <span className="label-text mb-2">Telefone</span>
                <input type="text" defaultValue={client.phone} className="input input-bordered w-full" />
              </label>
              <label className="form-control">
                <span className="label-text mb-2">Ambiente</span>
                <input
                  type="text"
                  defaultValue={incidentEnvironmentLabel[client.environment]}
                  className="input input-bordered w-full"
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="app-surface-muted rounded-2xl border p-4">
                <p className="text-sm text-base-content/60">Incidentes ativos</p>
                <p className="mt-1 text-2xl font-semibold">{client.activeIncidents}</p>
              </div>
              <div className="app-surface-muted rounded-2xl border p-4">
                <p className="text-sm text-base-content/60">Plano de SLA</p>
                <p className="mt-1 text-sm font-medium">{client.slaPlan}</p>
              </div>
              <div className="flex items-end justify-end">
                <button type="button" className="btn btn-primary">
                  Atualizar cliente
                </button>
              </div>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
