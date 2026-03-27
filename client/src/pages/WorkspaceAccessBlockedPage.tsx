import { Link, Navigate } from "react-router-dom";
import { useSession } from "../hooks/use-session";

export function WorkspaceAccessBlockedPage() {
  const { session } = useSession();

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (session.workspaces.length > 0 || !session.blockedAccess) {
    return <Navigate to="/account/workspaces" replace />;
  }

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Workspace Access
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
            Access is blocked by the current plan
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
            {session.blockedAccess.message}
          </p>

          <div className="mt-8 rounded-[24px] border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-semibold text-amber-900">
              What needs to happen
            </p>
            <ul className="mt-3 space-y-2 text-sm leading-7 text-amber-900/90">
              <li>Ask a workspace admin to upgrade the billing plan.</li>
              <li>Or ask them to free a seat so your membership can be reactivated.</li>
              <li>Your workspace history stays intact while access is limited.</li>
            </ul>
          </div>

          <div className="mt-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Affected workspaces
            </p>
            <div className="mt-4 space-y-3">
              {session.blockedAccess.workspaces.map((workspace) => (
                <div
                  key={workspace._id}
                  className="rounded-[20px] border border-slate-200 bg-slate-50 px-5 py-4"
                >
                  <p className="text-base font-semibold text-slate-950">
                    {workspace.name}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    /workspace/{workspace.slug}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/account"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
            >
              Open account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
