export default function NotFound() {
  return (
    <main className="app-main flex min-h-screen items-center justify-center px-6">
      <div className="app-surface max-w-lg rounded-3xl border p-8 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-base-content/50">404</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Página não encontrada</h1>
        <p className="mt-3 text-sm text-base-content/60">
          O endereço solicitado não existe ou não está mais disponível.
        </p>
      </div>
    </main>
  );
}
