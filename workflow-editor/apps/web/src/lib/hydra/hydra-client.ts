import type {
  HydraConfig,
  HydraRecallResult,
  HydraIngestResponse,
  HydraCaptureResponse,
  HydraSessionState,
  HydraEntity,
  HydraMemoryEntry,
} from './types';

const DEFAULT_CONFIG: HydraConfig = {
  apiKey: process.env.HYDRADB_API_KEY || '',
  tenantId: process.env.HYDRADB_TENANT_ID || '',
  subTenantId: process.env.HYDRADB_SUB_TENANT_ID || '',
  baseUrl: 'https://api.hydradb.com/v1',
  maxContextChars: 7000,
  maxMemoryResults: 6,
  maxKnowledgeResults: 4,
  graphDepth: 3,
  decayFactor: 0.85,
  captureMode: 'session-upsert',
  searchMode: 'both',
  ingestionMode: 'auto',
};

class HydraClient {
  private config: HydraConfig;
  private sessionStates: Map<string, HydraSessionState> = new Map();
  private entityCache: Map<string, HydraEntity[]> = new Map();
  private initialized = false;

  constructor(config?: Partial<HydraConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T | null> {
    if (!this.config.apiKey || !this.config.tenantId) return null;

    try {
      const response = await fetch(`${this.config.baseUrl}${path}`, {
        method,
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-Tenant-Id': this.config.tenantId,
          'X-Sub-Tenant-Id': this.config.subTenantId,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) return null;
      return await response.json() as T;
    } catch {
      return null;
    }
  }

  async initialize(): Promise<boolean> {
    if (this.initialized) return true;

    const health = await this.request<{ status: string }>('GET', '/health');
    if (health?.status === 'ok') {
      this.initialized = true;
    }
    return this.initialized;
  }

  async recall(
    query: string,
    userId: string,
    options?: {
      searchMode?: HydraConfig['searchMode'];
      maxResults?: number;
      graphDepth?: number;
      includeDecayed?: boolean;
      entityFilter?: string[];
    }
  ): Promise<HydraRecallResult | null> {
    const searchMode = options?.searchMode || this.config.searchMode;
    const maxResults = options?.maxResults || this.config.maxMemoryResults;

    const result = await this.request<HydraRecallResult>('POST', '/recall', {
      query,
      userId,
      searchMode,
      maxResults,
      graphDepth: options?.graphDepth || this.config.graphDepth,
      includeDecayed: options?.includeDecayed || false,
      entityFilter: options?.entityFilter,
      maxContextChars: this.config.maxContextChars,
    });

    if (result) {
      const session = this.sessionStates.get(userId);
      if (session) {
        session.lastRecallLatency = result.queryLatencyMs;
        session.contextWindow.used += result.memoryChunks.length + result.knowledgeChunks.length;
      }
    }

    return result;
  }

  async captureMemory(
    userId: string,
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<HydraCaptureResponse | null> {
    return this.request<HydraCaptureResponse>('POST', '/memory', {
      userId,
      content,
      metadata: {
        ...metadata,
        capturedAt: new Date().toISOString(),
        captureMode: this.config.captureMode,
      },
    });
  }

  async captureConversationTurn(
    userId: string,
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
    toolCalls?: { name: string; result: string }[]
  ): Promise<HydraCaptureResponse | null> {
    if (this.config.captureMode === 'off') return null;

    const session = this.getOrCreateSession(userId, sessionId);
    session.turnCount++;

    if (this.config.captureMode === 'turn' || this.config.captureMode === 'both') {
      return this.request<HydraCaptureResponse>('POST', '/memory/turn', {
        userId,
        sessionId,
        turnIndex: session.turnCount,
        role,
        content,
        toolCalls,
        activeEntities: session.activeEntities,
      });
    }

    if (this.config.captureMode === 'session-upsert' || this.config.captureMode === 'both') {
      return this.request<HydraCaptureResponse>('PUT', `/memory/session/${sessionId}`, {
        userId,
        content,
        turnIndex: session.turnCount,
        role,
        toolCalls,
      });
    }

    return null;
  }

  async ingestKnowledge(
    sourceId: string,
    content: string,
    sourceType: 'artifact' | 'workspace' | 'document' | 'conversation',
    metadata?: Record<string, unknown>
  ): Promise<HydraIngestResponse | null> {
    const ingestionMode = this.config.ingestionMode;

    return this.request<HydraIngestResponse>('POST', '/knowledge', {
      sourceId,
      content,
      sourceType,
      ingestionMode,
      metadata,
      extractEntities: true,
      buildRelations: true,
    });
  }

  async getEntities(
    userId: string,
    options?: { type?: string; limit?: number }
  ): Promise<HydraEntity[]> {
    const cacheKey = `${userId}:${options?.type || 'all'}`;
    const cached = this.entityCache.get(cacheKey);
    if (cached) return cached;

    const result = await this.request<{ entities: HydraEntity[] }>(
      'GET',
      `/entities?userId=${userId}&type=${options?.type || ''}&limit=${options?.limit || 50}`
    );

    const entities = result?.entities || [];
    this.entityCache.set(cacheKey, entities);
    return entities;
  }

  async getMemoryTimeline(
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<HydraMemoryEntry[]> {
    const params = new URLSearchParams({ userId });
    if (startDate) params.set('start', startDate);
    if (endDate) params.set('end', endDate);

    const result = await this.request<{ memories: HydraMemoryEntry[] }>(
      'GET',
      `/memory/timeline?${params.toString()}`
    );

    return result?.memories || [];
  }

  async triggerDecay(userId: string): Promise<{ entriesDecayed: number } | null> {
    return this.request<{ entriesDecayed: number }>('POST', '/memory/decay', {
      userId,
      factor: this.config.decayFactor,
    });
  }

  formatRecallAsContext(recall: HydraRecallResult): string {
    const parts: string[] = [];

    if (recall.memoryChunks.length > 0) {
      const memories = recall.memoryChunks
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .map((m) => m.content)
        .join('\n');
      parts.push(`[Memory]\n${memories}`);
    }

    if (recall.knowledgeChunks.length > 0) {
      const knowledge = recall.knowledgeChunks
        .map((k) => k.content)
        .join('\n');
      parts.push(`[Knowledge]\n${knowledge}`);
    }

    if (recall.graphPaths.length > 0) {
      const paths = recall.graphPaths
        .map((p) => p.entities.map((e) => e.name).join(' → '))
        .join('\n');
      parts.push(`[Relations]\n${paths}`);
    }

    const context = parts.join('\n\n');
    return context.slice(0, this.config.maxContextChars);
  }

  private getOrCreateSession(userId: string, sessionId: string): HydraSessionState {
    const existing = this.sessionStates.get(userId);
    if (existing && existing.sessionId === sessionId) return existing;

    const session: HydraSessionState = {
      sessionId,
      turnCount: 0,
      activeEntities: [],
      contextWindow: { used: 0, max: this.config.maxContextChars },
      lastRecallLatency: 0,
    };

    this.sessionStates.set(userId, session);
    return session;
  }

  isConfigured(): boolean {
    return Boolean(this.config.apiKey && this.config.tenantId);
  }

  getConfig(): Readonly<HydraConfig> {
    return { ...this.config };
  }

  clearEntityCache(): void {
    this.entityCache.clear();
  }

  clearSession(userId: string): void {
    this.sessionStates.delete(userId);
    this.entityCache.delete(userId);
  }
}

const g = globalThis as unknown as { __hydraClient?: HydraClient };
if (!g.__hydraClient) {
  g.__hydraClient = new HydraClient();
}

export const hydraClient = g.__hydraClient;
