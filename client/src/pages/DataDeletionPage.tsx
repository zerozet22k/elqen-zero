import { useEffect } from "react";
import { LegalDocumentPage } from "../components/LegalDocumentPage";
import {
  DATA_DELETION_SECTIONS,
  SITE_BRAND,
  SITE_EMAIL,
} from "../content/site";

export function DataDeletionPage() {
  useEffect(() => {
    document.title = `Data Deletion | ${SITE_BRAND}`;
  }, []);

  return (
    <LegalDocumentPage
      title="Data Deletion Instructions"
      pageTitle="Data Deletion Instructions"
      description={`Users can request access to, correction of, or deletion of relevant personal or account data by contacting ${SITE_BRAND}.`}
      sections={DATA_DELETION_SECTIONS}
      highlight={
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">
            Request Deletion by Email
          </h2>
          <p className="mt-3 text-base leading-8 text-slate-600">
            Email{" "}
            <a
              href={`mailto:${SITE_EMAIL}`}
              className="font-medium text-slate-950 transition hover:text-slate-700"
            >
              {SITE_EMAIL}
            </a>{" "}
            and include enough account information for the workspace team to review
            the request safely.
          </p>
        </div>
      }
    />
  );
}
