import type { UserProfile } from "@/lib/types";

export function ProfileForm({ profile }: { profile: UserProfile }) {
  return (
    <section className="app-surface card border">
      <div className="card-body gap-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Editar perfil</h2>
          <p className="mt-1 text-sm text-base-content/60">
            Atualize nome, dados de contato e senha do usuário autenticado.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="form-control">
            <span className="label-text mb-2">Nome completo</span>
            <input type="text" defaultValue={profile.fullName} className="input input-bordered w-full" />
          </label>
          <label className="form-control">
            <span className="label-text mb-2">E-mail</span>
            <input type="email" defaultValue={profile.email} className="input input-bordered w-full" />
          </label>
          <label className="form-control">
            <span className="label-text mb-2">Telefone</span>
            <input type="text" defaultValue={profile.phone} className="input input-bordered w-full" />
          </label>
          <label className="form-control">
            <span className="label-text mb-2">Contato preferencial</span>
            <input
              type="text"
              defaultValue={profile.preferredContact}
              className="input input-bordered w-full"
            />
          </label>
          <label className="form-control">
            <span className="label-text mb-2">Empresa</span>
            <input type="text" defaultValue={profile.companyName} className="input input-bordered w-full" />
          </label>
          <label className="form-control">
            <span className="label-text mb-2">Documento</span>
            <input type="text" defaultValue={profile.document} className="input input-bordered w-full" />
          </label>
          <label className="form-control">
            <span className="label-text mb-2">Plano</span>
            <input type="text" defaultValue={profile.plan} className="input input-bordered w-full" />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="form-control">
            <span className="label-text mb-2">Nova senha</span>
            <input type="password" placeholder="Digite uma nova senha" className="input input-bordered w-full" />
          </label>
          <label className="form-control">
            <span className="label-text mb-2">Confirmar nova senha</span>
            <input type="password" placeholder="Repita a nova senha" className="input input-bordered w-full" />
          </label>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" className="btn btn-ghost">
            Cancelar
          </button>
          <button type="button" className="btn btn-primary">
            Salvar alterações
          </button>
        </div>
      </div>
    </section>
  );
}
