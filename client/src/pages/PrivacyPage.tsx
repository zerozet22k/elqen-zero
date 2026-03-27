import { LegalDocumentPage } from "../components/LegalDocumentPage";
import { PRIVACY_SECTIONS, SITE_BRAND, SITE_EMAIL } from "../content/site";

export function PrivacyPage() {
  return (
    <LegalDocumentPage
      title="Privacy Policy"
      pageTitle="Privacy Policy"
      description={`${SITE_BRAND} values privacy and handles information responsibly to operate a secure and reliable customer communication platform.`}
      sections={PRIVACY_SECTIONS}
      highlight={
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">Deletion Requests</h2>
          <p className="mt-3 text-base leading-8 text-slate-600">
            To request deletion, email{" "}
            <a
              href={`mailto:${SITE_EMAIL}`}
              className="font-medium text-slate-950 transition hover:text-slate-700"
            >
              {SITE_EMAIL}
            </a>{" "}
            with relevant account details so {SITE_BRAND} can identify and process
            your request.
          </p>
        </div>
      }
    />
  );
}
