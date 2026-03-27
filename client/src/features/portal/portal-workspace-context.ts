import { Dispatch, SetStateAction } from "react";
import { useOutletContext } from "react-router-dom";
import {
  BillingOverrideSummary,
  PlanCatalogSummary,
  PortalWorkspaceDetail,
} from "../../types/models";

export type PortalWorkspaceOutletContext = {
  workspaceId: string;
  workspace: PortalWorkspaceDetail;
  setWorkspace: Dispatch<SetStateAction<PortalWorkspaceDetail | null>>;
  planCatalogs: PlanCatalogSummary[];
  overrides: BillingOverrideSummary[];
  setOverrides: Dispatch<SetStateAction<BillingOverrideSummary[]>>;
  refreshWorkspace: () => Promise<void>;
};

export const usePortalWorkspace = () =>
  useOutletContext<PortalWorkspaceOutletContext>();
