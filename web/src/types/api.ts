/**
 * TypeScript interfaces for all ProvenanceAI API response shapes.
 * Import from this file in every page and component that makes API calls.
 */

export interface TransformationStep {
  id: string;
  sourceRecordId: string;
  operatorName: string;
  appliedAt: string;
  inputHash: string;
  outputHash: string;
  params: any;
}

export interface SourceRecord {
  id: string;
  sourceId: string;
  contentHash: string;
  versionTs: string | null;
  pipelineId: string;
  createdAt: string;
  updatedAt: string;
  isStale: boolean;
  contentPreview: string | null;
  embeddingCount?: number;
  transformationSteps?: TransformationStep[];
  embeddings?: Embedding[];
}

export interface Embedding {
  id: string;
  chunkIndex: number;
  parentSourceRecordId: string;
  parentSourceRecord?: SourceRecord;
  vectorDbId: string;
  embeddingModel: string;
  isStale: boolean;
  createdAt: string;
}

export interface RetrievalEventEmbedding {
  id: string;
  retrievalEventId: string;
  embeddingId: string;
  embedding: Embedding;
}

export interface LLMResponse {
  id: string;
  promptContextId?: string;
  sessionId?: string; // Opt-in for some views
  responseText: string;
  responseHash: string;
  modelVersion: string;
  respondedAt: string;
}

export interface PromptContext {
  id: string;
  retrievalEventId: string;
  promptHash: string;
  assembledAt: string;
  contextFormat?: string;
  templateId?: string;
  llmResponses: LLMResponse[];
}

export interface RetrievalEvent {
  id: string;
  sessionId: string;
  queryText: string;
  retrievedAt: string;
  pipelineId?: string;
  embeddings: RetrievalEventEmbedding[];
  promptContexts: PromptContext[];
}

export interface StalenessAlert {
  id: string;
  sourceRecordId: string;
  sourceRecord?: SourceRecord;
  detectedAt: string;
  previousHash: string;
  currentHash: string;
  embeddingsMarked: number;
  resolvedAt: string | null;
  daysStale?: number;
  severity?: 'critical' | 'danger' | 'warning';
  lastIngestedAt?: string | null;
  affectedSessionCount?: number;
}

export interface AlertSummary {
  totalStale: number;
  criticalCount: number;
  dangerCount: number;
  warningCount: number;
  totalAffectedSessions: number;
  totalStaleEmbeddings: number;
}

export interface ApiKey {
  id: string;
  key?: string;
  keyPreview: string;
  name: string;
  pipelineId: string;
  createdAt: string;
  lastUsedAt: string | null;
  isActive: boolean;
}

export interface DashboardStats {
  totalSourcesIngested: number;
  totalResponsesTraced: number;
  staleSources: number;
  activeAlerts: number;
  totalEmbeddings: number;
}

export interface TraceResult extends RetrievalEvent {
  // Extends RetrievalEvent — all lineage data is nested within
}

/* ── Shield ─────────────────────────────────────────────────────────── */

export interface ShieldStats {
  chunksInspectedToday: number;
  chunksQuarantinedToday: number;
  chunksSubstitutedToday: number;
  responsesProtectedToday: number;
  responsesBlockedToday: number;
  chunksInspectedAllTime: number;
  lastEventAt: string | null;
}

export interface ShieldActivityDay {
  date: string;
  label: string;
  clean: number;
  intercepted: number;
}

export interface ShieldEvent {
  id: string;
  eventType: string;
  pipelineId: string;
  sessionId: string;
  sourceId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

/* ── Incidents ──────────────────────────────────────────────────────── */

export interface Incident {
  id: string;
  sourceId: string | null;
  status: "active" | "resolved" | "acknowledged";
  severity: "low" | "medium" | "high" | "critical";
  changeType: string | null;
  semanticDiffScore: number | null;
  action: string | null;
  embeddingsAffected: number;
  blastRadius: number;
  alertSent: boolean;
  resolvedAt: string | null;
  createdAt: string;
  pendingReingest: boolean;
}

export interface IncidentDetail {
  id: string;
  sourceRecordId: string;
  sourceRecord: {
    id: string;
    sourceId: string;
    contentHash: string;
    pipelineId: string;
    isStale: boolean;
    isQuarantined: boolean;
    pendingReingest: boolean;
    createdAt: string;
    updatedAt: string;
  } | null;
  status: string;
  severity: string;
  changeType: string | null;
  semanticDiffScore: number | null;
  action: string | null;
  embeddingsAffected: number;
  blastRadius: number;
  alertSent: boolean;
  alertSentAt: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  timeline: {
    id: string;
    eventType: string;
    sourceId: string | null;
    createdAt: string;
    payload: Record<string, unknown>;
  }[];
}

export interface IncidentStats {
  activeIncidents: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  resolvedThisWeek: number;
  avgResolutionHours: number;
  totalBlastRadius: number;
}

/* ── Quarantine ─────────────────────────────────────────────────────── */

export interface QuarantineEntry {
  sourceId: string;
  reason: string;
  quarantinedAt: string;
  quarantinedBy: string;
}

/** Generic API error response */
export interface ApiError {
  error: string;
  code: string;
  detail?: string | null;
}
