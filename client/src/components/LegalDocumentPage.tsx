import { ReactNode, useEffect } from "react";
import { PublicSiteShell } from "./PublicSiteShell";
import { SITE_BRAND, SITE_LAST_UPDATED } from "../content/site";

type LegalDocumentSection = {
  title: string;
  body: string;
};

type LegalDocumentPageProps = {
  title: string;
  description: string;
  sections: readonly LegalDocumentSection[];
  highlight?: ReactNode;
  pageTitle: string;
};

export function LegalDocumentPage({
  title,
  description,
  sections,
  highlight,
  pageTitle,
}: LegalDocumentPageProps) {
  useEffect(() => {
    document.title = `${pageTitle} | ${SITE_BRAND}`;
  }, [pageTitle]);

  return (
    <PublicSiteShell mainClassName="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <section className="rounded-[32px] border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          {SITE_BRAND}
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
          {title}
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
          {description}
        </p>
      </section>

      {sections.map((section) => (
        <section
          key={section.title}
          className="mt-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        >
          <h2 className="text-2xl font-semibold text-slate-950">{section.title}</h2>
          <p className="mt-3 text-base leading-8 text-slate-600">{section.body}</p>
        </section>
      ))}

      {highlight ? (
        <section className="mt-5 rounded-[28px] border border-slate-200 bg-slate-50 p-6 shadow-sm sm:p-8">
          {highlight}
        </section>
      ) : null}

      <p className="mt-6 text-sm text-slate-500">Last updated: {SITE_LAST_UPDATED}</p>
    </PublicSiteShell>
  );
}
