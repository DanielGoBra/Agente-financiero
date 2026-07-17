export type CRMPipelineKind = "lead" | "opportunity" | "terminal";
export type CRMEnrichmentStatus = "pending" | "processing" | "enriched" | "retrying" | "failed" | "skipped";
export type CRMPriority = "low" | "medium" | "high" | "urgent";
export type CRMTaskStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type CRMActivityType = "call" | "email" | "whatsapp" | "meeting" | "visit" | "note" | "status_change" | "task_completed" | "system";
export type CRMConsentStatus = "unknown" | "granted" | "revoked";

export interface CRMPipelineStage {
  id: string;
  name: string;
  pipeline: CRMPipelineKind;
  position: number;
  probability: number;
  isTerminal: boolean;
  isActive: boolean;
}

export interface CRMAccount {
  id: string;
  legacyEmpresaId: number | null;
  googlePlaceId: string | null;
  ownerId: string | null;
  createdBy: string | null;
  stageId: string;
  displayName: string;
  municipality: string;
  address: string;
  phone: string;
  website: string;
  source: string;
  priority: CRMPriority;
  enrichmentStatus: CRMEnrichmentStatus;
  dataConfidence: number | null;
  nextActionAt: string | null;
  lastContactedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CRMActivity {
  id: string;
  accountId: string;
  createdBy: string;
  activityType: CRMActivityType;
  subject: string;
  body: string;
  occurredAt: string;
  createdAt: string;
}

export interface CRMTask {
  id: string;
  accountId: string;
  assignedTo: string | null;
  createdBy: string;
  title: string;
  description: string;
  priority: CRMPriority;
  status: CRMTaskStatus;
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CRMContact {
  id: string;
  accountId: string;
  createdBy: string;
  fullName: string;
  jobTitle: string;
  phone: string;
  email: string;
  isPrimary: boolean;
  isActive: boolean;
  consentStatus: CRMConsentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CRMStageHistory {
  id: string;
  accountId: string;
  changedBy: string;
  fromStageId: string | null;
  toStageId: string;
  reason: string;
  createdAt: string;
}

export interface CRMWorkspace {
  available: boolean;
  accounts: CRMAccount[];
  stages: CRMPipelineStage[];
  tasks: CRMTask[];
}
