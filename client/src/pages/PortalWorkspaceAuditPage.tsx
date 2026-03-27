import { usePortalWorkspace } from "../features/portal/portal-workspace-context";
import { formatDateTime } from "../features/portal/portal-workspace-helpers";

export function PortalWorkspaceAuditPage() {
  const { workspace } = usePortalWorkspace();

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Audit
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Internal activity log
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
              Portal actions, support interventions, and billing changes for this client
              workspace should stay traceable from here.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Timeline
        </p>
        <div className="mt-4 space-y-3">
          {workspace.auditTrail.length === 0 ? (
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              No portal actions logged for this workspace yet.
            </div>
          ) : (
            workspace.auditTrail.map((item) => (
              <div
                key={item._id}
                className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-950">{item.eventType}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">
                      {item.actorType}
                      {item.actorId ? ` | ${item.actorId}` : ""}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500">{formatDateTime(item.createdAt)}</p>
                </div>
                {item.reason ? (
                  <p className="mt-2 text-sm leading-7 text-slate-600">{item.reason}</p>
                ) : null}
                {item.data ? (
                  <pre className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
                    {JSON.stringify(item.data, null, 2)}
                  </pre>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
