import { NavLink, Outlet } from "react-router-dom";
import { useSession } from "../hooks/use-session";

const navItems = [
  { to: "/inbox", label: "Inbox" },
  { to: "/channels", label: "Channels" },
  { to: "/knowledge", label: "Knowledge" },
  { to: "/canned-replies", label: "Canned Replies" },
  { to: "/automations", label: "Automations" },
  { to: "/ai-settings", label: "AI Settings" },
  { to: "/analytics", label: "Analytics" },
] as const;

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function AppShell() {
  const { session, logout } = useSession();

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="grid min-h-screen grid-cols-[260px_1fr]">
        <aside className="flex flex-col justify-between border-r border-slate-200 bg-slate-950 text-slate-100">
          <div className="p-5">
            <div className="mb-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Seller Console
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">
                Unified Inbox
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                {session?.workspace?.name ?? "Workspace"}
              </p>
            </div>

            <nav className="space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/inbox"}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition",
                      isActive
                        ? "bg-white text-slate-950 shadow-sm"
                        : "text-slate-300 hover:bg-slate-900 hover:text-white"
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="border-t border-white/10 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-sm font-semibold">
                {(session?.user?.name?.[0] ?? "U").toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {session?.user?.name ?? "Owner"}
                </p>
                <p className="truncate text-xs text-slate-400">
                  Workspace member
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={logout}
              className="mt-4 w-full rounded-xl border border-white/10 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/5"
            >
              Sign out
            </button>
          </div>
        </aside>

        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
