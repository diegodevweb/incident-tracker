"use client";

import { useRouter } from "next/navigation";
import { LogoutButton } from "./logout-button";
import { PasswordChangeForm } from "./password-change-form";

/**
 * No lugar do painel enquanto a senha for temporária. A API também recusa as
 * outras rotas até a troca; depois dela o layout volta ao painel normal.
 */
export function ForcedPasswordChange({ userName }: { userName: string }) {
  const router = useRouter();

  return (
    <main className="app-main flex min-h-screen items-center justify-center p-6">
      <section className="app-surface card w-full max-w-3xl border">
        <div className="card-body gap-6">
          <div>
            <div className="badge badge-outline badge-primary mb-4">
              Primeiro acesso
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Defina sua senha
            </h1>
            <p className="mt-2 text-sm leading-6 text-base-content/65">
              Olá, {userName}. Você entrou com uma senha temporária. Escolha uma
              senha sua para continuar; a temporária deixa de valer.
            </p>
          </div>

          <PasswordChangeForm
            currentPasswordLabel="Senha temporária"
            submitLabel="Salvar e continuar"
            onChanged={() => router.refresh()}
          />

          <div className="flex justify-start">
            <LogoutButton />
          </div>
        </div>
      </section>
    </main>
  );
}
