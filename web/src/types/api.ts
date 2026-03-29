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

/** Generic API error response */
export interface ApiError {
  error: string;
  code: string;
  detail?: string | null;
}
