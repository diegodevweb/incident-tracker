import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="app-main min-h-screen">
      <section className="hero min-h-screen px-6">
        <div className="hero-content w-full max-w-6xl flex-col gap-10 lg:flex-row lg:items-stretch">
          <div className="w-full lg:max-w-xl">
            <div className="badge badge-outline badge-primary mb-5">
              Alertta
            </div>
            <h1 className="text-5xl font-semibold tracking-tight">
              Dashboard de tickets e suporte operacional
            </h1>
            <p className="mt-5 text-base leading-7 text-base-content/65">
              Plataforma de acompanhamento de tickets para
              equipes de suporte e clientes.
            </p>
          </div>

          <div className="w-full lg:max-w-md">
            <LoginForm />
          </div>
        </div>
      </section>
    </main>
  );
}
