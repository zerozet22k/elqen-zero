import { LegalDocumentPage } from "../components/LegalDocumentPage";
import { SITE_BRAND, SITE_EMAIL, TERMS_SECTIONS } from "../content/site";

export function TermsPage() {
  return (
    <LegalDocumentPage
      title="Terms of Service"
      pageTitle="Terms of Service"
      description={`${SITE_BRAND} provides business messaging and customer communication tools for professional use.`}
      sections={TERMS_SECTIONS}
      highlight={
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">Contact Information</h2>
          <p className="mt-3 text-base leading-8 text-slate-600">
            For questions about these terms, contact{" "}
            <a
              href={`mailto:${SITE_EMAIL}`}
              className="font-medium text-slate-950 transition hover:text-slate-700"
            >
              {SITE_EMAIL}
            </a>
            .
          </p>
        </div>
      }
    />
  );
}
