import { Suspense } from "react";
import { SidebarNav } from "./sidebar-nav";

export function Sidebar() {
  return (
    <aside className="app-shell w-full border-b md:w-72 md:border-b-0 md:border-r">
      <div className="flex h-full flex-col gap-6 p-6">
        <Suspense fallback={<div className="min-h-48 rounded-3xl border border-dashed" />}>
          <SidebarNav />
        </Suspense>
      </div>
    </aside>
  );
}
