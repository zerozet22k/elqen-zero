import { useEffect } from "react";
import { PublicSiteShell } from "../components/PublicSiteShell";
import { SITE_BRAND } from "../content/site";

const coreStats = [
  { label: "Channels unified", value: "5+" },
  { label: "Avg. response time", value: "2.4m" },
  { label: "Team visibility", value: "Full" },
];

const featureCards = [
  {
    title: "Unified team inbox",
    description:
      "Bring Messenger, Telegram, Viber, website chat, and internal handling into one clean workspace.",
  },
  {
    title: "Inbound + outbound messaging",
    description:
      "Handle customer replies and launch outbound conversations from the same operating surface.",
  },
  {
    title: "Assignment and control",
    description:
      "Route chats to the right staff, track ownership, and keep every conversation accountable.",
  },
  {
    title: "Business-grade permissions",
    description:
      "Role-based access, workspace separation, and clearer control over who can see and send what.",
  },
  {
    title: "Faster replies at scale",
    description:
      "Use notes, internal coordination, and one shared workflow to reduce response delays.",
  },
  {
    title: "Built for serious operations",
    description:
      "Designed for businesses that need structure, visibility, and cleaner customer communication.",
  },
];

const inboxPreview = [
  {
    source: "Facebook Messenger",
    customer: "Aye Electronics",
    message: "Can your team confirm if the order can be shipped tomorrow?",
    state: "Assigned to Sales",
  },
  {
    source: "Telegram",
    customer: "Moe Thant",
    message: "I need pricing for 50 units. Can someone send the full details?",
    state: "Waiting for reply",
  },
  {
    source: "Website Live Chat",
    customer: "Shwe Retail",
    message: "We want a long-term supplier. Can your manager contact us today?",
    state: "Priority",
  },
];

const workflowSteps = [
  "Capture customer conversations from every connected channel",
  "Route, assign, and organize them inside the correct team workflow",
  "Reply faster with full context, internal notes, and staff visibility",
];

export function LandingPage() {
  useEffect(() => {
    document.title = `${SITE_BRAND} | Omnichannel Business Messaging`;
  }, []);

  return (
    <PublicSiteShell mainClassName="mx-auto flex w-full max-w-7xl flex-col px-4 py-8 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-[40px] border border-slate-200 bg-white shadow-[0_30px_120px_rgba(15,23,42,0.08)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.12),transparent_28%)]" />

        <div className="relative grid gap-12 px-6 py-10 sm:px-10 sm:py-14 lg:grid-cols-[1.05fr_0.95fr] lg:px-14 lg:py-16">
          <div className="flex flex-col justify-center">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
              <span>{SITE_BRAND}</span>
              <span className="text-slate-300">•</span>
              <span>Business Messaging Platform</span>
            </div>

            <h1 className="mt-6 max-w-4xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              Elqen keeps every customer conversation in one serious business workspace.
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
              Manage inbound and outbound conversations across your customer
              channels, keep teams aligned, and give staff one place to reply,
              assign, follow up, and move faster without losing context.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-6 py-3 text-sm font-medium text-white transition hover:bg-slate-800">
                Start with Elqen
              </button>
              <button className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                Book a demo
              </button>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {coreStats.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                    {item.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="rounded-[32px] border border-slate-200 bg-slate-950 p-4 shadow-2xl">
              <div className="rounded-[24px] bg-white p-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      Elqen Workspace
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Omnichannel inbox for business teams
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                    Outbound enabled
                  </span>
                </div>

                <div className="mt-5 space-y-3">
                  {inboxPreview.map((chat) => (
                    <div
                      key={`${chat.source}-${chat.customer}`}
                      className="rounded-2xl border border-slate-200 p-4 transition hover:bg-slate-50"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-950">
                              {chat.customer}
                            </p>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                              {chat.source}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {chat.message}
                          </p>
                        </div>
                        <span className="whitespace-nowrap rounded-full bg-slate-950 px-3 py-1 text-[11px] font-medium text-white">
                          {chat.state}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Assigned
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">
                      38
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Unassigned
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">
                      12
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Active staff
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">
                      9
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {workflowSteps.map((step, index) => (
          <div
            key={step}
            className="rounded-[28px] border border-slate-200 bg-white px-6 py-6 shadow-[0_14px_40px_rgba(15,23,42,0.04)]"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Step {index + 1}
            </p>
            <p className="mt-3 text-base font-medium leading-7 text-slate-800">
              {step}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-8 rounded-[36px] border border-slate-200 bg-white px-6 py-8 shadow-[0_18px_60px_rgba(15,23,42,0.05)] sm:px-10 sm:py-10">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Why Elqen
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Built for teams that need structure, speed, and control.
          </h2>
          <p className="mt-4 text-base leading-8 text-slate-600">
            Elqen is designed for businesses handling customer communication
            across multiple channels, multiple staff, and multiple operational
            flows. It helps teams respond faster while keeping visibility,
            ownership, and business discipline intact.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {featureCards.map((card) => (
            <div
              key={card.title}
              className="rounded-[28px] border border-slate-200 bg-slate-50 px-5 py-5"
            >
              <h3 className="text-lg font-semibold text-slate-950">
                {card.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {card.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-[36px] border border-slate-200 bg-slate-950 px-6 py-10 text-white shadow-[0_24px_80px_rgba(15,23,42,0.18)] sm:px-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Ready for business teams
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Turn disconnected customer messaging into one organized operation.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Use Elqen to centralize conversations, support staff workflows,
              and handle both inbound and outbound communication with a cleaner,
              more modern business inbox.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <button className="inline-flex items-center justify-center rounded-2xl bg-white px-6 py-3 text-sm font-medium text-slate-950 transition hover:bg-slate-100">
              Get started
            </button>
            <button className="inline-flex items-center justify-center rounded-2xl border border-slate-700 px-6 py-3 text-sm font-medium text-white transition hover:bg-slate-900">
              Talk to sales
            </button>
          </div>
        </div>
      </section>
    </PublicSiteShell>
  );
}