import {
  BillingAccountStatus,
  BillingInterval,
  BillingOverrideType,
} from "../../types/models";

const titleCaseLabel = (value: string) =>
  value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

export const formatPortalLabel = (value?: string | null) => {
  if (!value) {
    return "Not set";
  }

  return titleCaseLabel(value);
};

export const formatBillingStatusLabel = (value: BillingAccountStatus) => {
  if (value === "past_due") {
    return "Past Due";
  }

  return formatPortalLabel(value);
};

export const formatBillingIntervalLabel = (value: BillingInterval) =>
  formatPortalLabel(value);

export const formatOverrideTypeLabel = (value: BillingOverrideType) =>
  formatPortalLabel(value);

export const formatBooleanLabel = (value: boolean, positive = "Yes", negative = "No") =>
  value ? positive : negative;

export const formatShortDate = (value?: string | null) => {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(date);
};
