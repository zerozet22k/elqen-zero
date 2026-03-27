import { PlanCatalogSummary } from "../../types/models";

export const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

export const toDateInputValue = (value?: string | null) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
};

export const flattenPlanVersions = (catalogs: PlanCatalogSummary[]) =>
  catalogs.flatMap((catalog) =>
    catalog.versions.map((version) => ({
      catalogId: catalog._id,
      catalogDisplayName: catalog.displayName,
      version,
    }))
  );
