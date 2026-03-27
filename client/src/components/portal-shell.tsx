import { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useSession } from "../hooks/use-session";

type PortalShellProps = {
  children: ReactNode;
  title: string;
  description: string;
  badge?: string;
};

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-medium transition",
    isActive
      ? "bg-slate-950 text-white"
      : "border border-slate-300 bg-white text-slate-700 hover:border-slate-950 hover:text-slate-950",
  ].join(" ");

export function PortalShell({
  children,
  title,
  description,
  badge = "Platform Portal",
}: PortalShellProps) {
  const { session, logout } = useSession();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <div className="flex min-h-screen w-full flex-col px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex min-h-48 h-full flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {badge}
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">
              {title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
              {description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <NavLink to="/portal" end className={navLinkClass}>
              Client Workspaces
            </NavLink>
            <NavLink to="/portal/payments" className={navLinkClass}>
              Payments
            </NavLink>
            <NavLink to="/portal/plans" className={navLinkClass}>
              Billing Catalog
            </NavLink>
            <NavLink to="/portal/staff" className={navLinkClass}>
              Staff
            </NavLink>
            <NavLink to="/portal/account" className={navLinkClass}>
              My portal account
            </NavLink>
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
            >
              Sign out
            </button>
          </div>
        </header>

        <div className="mt-6 flex items-center justify-between gap-4 text-sm text-slate-500">
          <div className="text-sm text-slate-700">
            Logged in as{" "}
            <span className="font-medium text-slate-950">
              {session?.user?.name ?? "Portal user"}
            </span>
            <span className="text-slate-400"> · </span>
            <span className="capitalize text-slate-600">
              {session?.user?.platformRole ?? "user"}
            </span>
            <span className="text-slate-400"> · </span>
            <span className="text-slate-500">
              ({session?.user?.email ?? "No email"})
            </span>
          </div>
          <button
            type="button"
            onClick={() => navigate("/portal")}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
          >
            Reload portal
          </button>
        </div>

        <div className="mt-8 flex-1">{children}</div>
      </div>
    </div>
  );
}
