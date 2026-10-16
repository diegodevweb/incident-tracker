import { LogoutButton } from "./logout-button";
import { NotificationBell } from "./notification-bell";
import { ThemeToggle } from "./theme-toggle";

type TopbarProps = {
  title: string;
  subtitle: string;
  userInitials?: string;
};

export function Topbar({
  title,
  subtitle,
  userInitials = "AD",
}: TopbarProps) {
  return (
    // relative z-30: o backdrop-filter faz do cabeçalho uma camada própria, e sem
    // isto os cards da página cobririam a lista do sino.
    <header className="app-shell relative z-30 flex flex-col gap-4 border-b px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-base-content/60">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        <NotificationBell />
        <ThemeToggle />
        <LogoutButton />
        <div className="avatar avatar-placeholder">
          <div className="w-10 rounded-full bg-primary text-primary-content">
            <span className="text-sm">{userInitials}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
