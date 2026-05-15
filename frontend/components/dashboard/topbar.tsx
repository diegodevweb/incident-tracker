import { LogoutButton } from "./logout-button";
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
    <header className="app-shell flex flex-col gap-4 border-b px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-base-content/60">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
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
