export const SITE_BRAND = "Elqen Zero";
export const SITE_EMAIL =
  import.meta.env.VITE_SITE_SUPPORT_EMAIL?.trim() || "elqenzero@gmail.com";
export const SITE_BILLING_EMAIL =
  import.meta.env.VITE_SITE_BILLING_EMAIL?.trim() || "elqenzero@gmail.com";
export const SITE_LAST_UPDATED = "March 19, 2026";
export const SITE_YEAR = "2026";

export const HOME_FEATURES = [
  "Unified inbox",
  "AI-assisted replies",
  "Canned replies",
  "After-hours automation",
  "Human handoff controls",
  "Conversation history and tags",
] as const;

export const HOME_DESCRIPTION =
  "Elqen Zero is an omni-channel customer communication platform that helps businesses manage customer conversations across multiple messaging channels in one unified inbox.";

export const PRIVACY_SECTIONS = [
  {
    title: "Information We Collect",
    body: `${SITE_BRAND} may collect business account information, contact details, conversation content, usage and activity data, and technical information needed to operate the service.`,
  },
  {
    title: "How We Use Information",
    body: "We use data to provide messaging services, improve support operations, maintain security, enable automation and AI-assisted workflows, and comply with legal obligations.",
  },
  {
    title: "Data Sharing",
    body: "Data may be shared with service providers only as necessary to operate and support the platform.",
  },
  {
    title: "Data Retention",
    body: `${SITE_BRAND} retains information for as long as needed to provide services, support customer operations, resolve disputes, enforce agreements, and meet legal or regulatory obligations.`,
  },
  {
    title: "User Rights",
    body: "Users may request access to, correction of, or deletion of relevant personal or account data, subject to applicable laws and verification requirements.",
  },
] as const;

export const TERMS_SECTIONS = [
  {
    title: "Acceptance of Terms",
    body: `By using ${SITE_BRAND}, you agree to these Terms of Service and any applicable policies.`,
  },
  {
    title: "Permitted Use",
    body: `You may use ${SITE_BRAND} only for lawful business communication and customer support activities.`,
  },
  {
    title: "Account Responsibility",
    body: "You are responsible for account credentials, access controls, and activity under your account.",
  },
  {
    title: "Acceptable Conduct",
    body: "You must not misuse the service, interfere with platform operations, or violate the rights of others.",
  },
  {
    title: "Service Availability",
    body: `${SITE_BRAND} aims to maintain reliable service but does not guarantee uninterrupted or error-free availability.`,
  },
  {
    title: "Intellectual Property",
    body: `All platform content, software, and branding related to ${SITE_BRAND} remain the property of ${SITE_BRAND} or its licensors.`,
  },
  {
    title: "Limitation of Liability",
    body: `To the maximum extent permitted by law, ${SITE_BRAND} is not liable for indirect, incidental, or consequential damages arising from service use.`,
  },
  {
    title: "Termination",
    body: `${SITE_BRAND} may suspend or terminate access for violations of these terms or legal requirements.`,
  },
] as const;

export const DATA_DELETION_SECTIONS = [
  {
    title: "Deletion Requests",
    body: `To request deletion, email ${SITE_EMAIL} with relevant account details so ${SITE_BRAND} can identify and process your request.`,
  },
  {
    title: "What to Include",
    body: "Include the business name, workspace name if known, and the email or phone information tied to the account or conversation records you want reviewed.",
  },
  {
    title: "Verification",
    body: "Deletion requests may require identity or ownership verification before changes are made.",
  },
] as const;
