import { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { useSession } from "../hooks/use-session";
import { SITE_BRAND, SITE_EMAIL, SITE_YEAR } from "../content/site";
import { getPostLoginHomePath, isPortalPlatformRole } from "../utils/platform-role";

type PublicSiteShellProps = {
  children: ReactNode;
  mainClassName?: string;
};

const primaryNavItems = [
  { to: "/", label: "Home", end: true },
  { to: "/privacy", label: "Privacy", end: false },
  { to: "/terms", label: "Terms", end: false },
  { to: "/data-deletion", label: "Data Deletion", end: false },
] as const;

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "rounded-full px-3 py-2 text-sm transition",
    isActive
      ? "bg-slate-950 text-white"
      : "text-slate-500 hover:bg-slate-100 hover:text-slate-950",
  ].join(" ");

const isLocalDevHost = () => {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  const embeddedMatch = host.match(/^((?:\d{1,3}\.){3}\d{1,3})\.(?:nip|sslip)\.io$/);
  const normalizedHost = embeddedMatch?.[1] ?? host;
  if (
    normalizedHost === "localhost" ||
    normalizedHost === "127.0.0.1" ||
    normalizedHost === "::1"
  ) {
    return true;
  }

  if (/^10\./.test(normalizedHost) || /^192\.168\./.test(normalizedHost)) {
    return true;
  }

  const match = normalizedHost.match(/^172\.(\d{1,3})\./);
  if (!match) {
    return false;
  }

  const secondOctet = Number(match[1]);
  return secondOctet >= 16 && secondOctet <= 31;
};

export function PublicSiteShell({
  children,
  mainClassName = "mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8",
}: PublicSiteShellProps) {
  const { session } = useSession();
  const showPortalLink = isLocalDevHost();

  return (
    <div
      className="min-h-screen bg-white text-slate-950"
      style={{
        fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
      }}
    >
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="text-lg font-semibold tracking-tight text-slate-950">
            {SITE_BRAND}
          </Link>

          <nav
            className="flex flex-wrap items-center gap-1"
            aria-label="Primary navigation"
          >
            {primaryNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={navLinkClass}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {showPortalLink ? (
              <Link
                to="/portal/login"
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
              >
                Portal
              </Link>
            ) : null}

            {session ? (
              <Link
                to={getPostLoginHomePath(session.user.platformRole)}
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                {isPortalPlatformRole(session.user.platformRole) ? "Portal" : "Workspaces"}
              </Link>
            ) : (
              <Link
                to="/login"
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className={mainClassName}>{children}</main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-6 text-sm text-slate-500 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>(c) {SITE_YEAR} {SITE_BRAND}. All rights reserved.</div>

          <div className="flex flex-wrap gap-4">
            <a href={`mailto:${SITE_EMAIL}`} className="transition hover:text-slate-950">
              {SITE_EMAIL}
            </a>
            <Link to="/privacy" className="transition hover:text-slate-950">
              Privacy Policy
            </Link>
            <Link to="/terms" className="transition hover:text-slate-950">
              Terms of Service
            </Link>
            <Link to="/data-deletion" className="transition hover:text-slate-950">
              Data Deletion
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
