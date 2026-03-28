export interface HydraConfig {
  apiKey: string;
  tenantId: string;
  subTenantId: string;
  baseUrl: string;
  maxContextChars: number;
  maxMemoryResults: number;
  maxKnowledgeResults: number;
  graphDepth: number;
  decayFactor: number;
  captureMode: 'turn' | 'session-upsert' | 'both' | 'off';
  searchMode: 'memory' | 'knowledge' | 'both';
  ingestionMode: 'memory' | 'knowledge' | 'auto';
}

export interface HydraMemoryEntry {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  entityIds: string[];
  version: number;
  relevanceScore: number;
  decayWeight: number;
  createdAt: string;
  updatedAt: string;
}

export interface HydraKnowledgeEntry {
  id: string;
  content: string;
  sourceId: string;
  sourceType: 'artifact' | 'workspace' | 'document' | 'conversation';
  chunkIndex: number;
  relations: HydraChunkRelation[];
  embedding?: number[];
  createdAt: string;
}

export interface HydraChunkRelation {
  fromChunkId: string;
  toChunkId: string;
  relationType: 'references' | 'extends' | 'contradicts' | 'supersedes' | 'co-occurs';
  weight: number;
}

export interface HydraEntity {
  id: string;
  name: string;
  type: 'person' | 'project' | 'tool' | 'preference' | 'decision' | 'event' | 'concept';
  properties: Record<string, unknown>;
  firstSeen: string;
  lastSeen: string;
  accessCount: number;
}

export interface HydraGraphPath {
  entities: HydraEntity[];
  edges: { from: string; to: string; relation: string; weight: number }[];
  totalWeight: number;
}

export interface HydraRecallResult {
  memoryChunks: HydraMemoryEntry[];
  knowledgeChunks: HydraKnowledgeEntry[];
  graphPaths: HydraGraphPath[];
  relations: HydraChunkRelation[];
  queryLatencyMs: number;
  totalRelevanceScore: number;
}

export interface HydraIngestResponse {
  id: string;
  chunksCreated: number;
  entitiesExtracted: number;
  relationsCreated: number;
  version: number;
}

export interface HydraCaptureResponse {
  id: string;
  version: number;
  entitiesExtracted: string[];
  decayApplied: boolean;
}

export interface HydraSessionState {
  sessionId: string;
  turnCount: number;
  activeEntities: string[];
  contextWindow: {
    used: number;
    max: number;
  };
  lastRecallLatency: number;
}
