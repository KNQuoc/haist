/**
 * Convex-backed Artifact Service
 */

import { convex, api } from '@/lib/convex';
import type {
  Artifact,
  ArtifactWithEntries,
  ArtifactEntry,
  ArtifactEntrySource,
  CreateArtifactParams,
  UpdateArtifactParams,
  AddEntryParams,
  FindSimilarOptions,
  ArtifactSearchResult,
} from './types';
import type { Id } from '../../../convex/_generated/dataModel';

function toISO(ts?: number | null): string {
  return ts ? new Date(ts).toISOString() : new Date().toISOString();
}

function mapArtifact(doc: Record<string, unknown>): Artifact {
  return {
    id: doc._id as string,
    userId: doc.userId as string,
    title: doc.title as string,
    summary: (doc.summary as string) || null,
    tags: (doc.tags as string[]) || [],
    createdAt: toISO(doc.createdAt as number),
    updatedAt: toISO(doc.updatedAt as number),
  };
}

function mapEntry(doc: Record<string, unknown>): ArtifactEntry {
  return {
    id: doc._id as string,
    artifactId: doc.artifactId as string,
    workflowId: (doc.workflowId as string) || null,
    workflowName: (doc.workflowName as string) || null,
    content: doc.content as string,
    source: doc.source as ArtifactEntrySource,
    createdAt: toISO(doc.createdAt as number),
  };
}

export const artifactService = {
  async getByUserId(userId: string): Promise<Artifact[]> {
    const docs = await convex.query(api.artifacts.list, { userId });
    return docs.map(mapArtifact);
  },

  async get(id: string): Promise<Artifact | undefined> {
    const doc = await convex.query(api.artifacts.get, { id: id as Id<"artifacts"> });
    if (!doc) return undefined;
    return mapArtifact(doc);
  },

  async getWithEntries(id: string): Promise<ArtifactWithEntries | undefined> {
    const result = await convex.query(api.artifacts.getWithEntries, { id: id as Id<"artifacts"> });
    if (!result) return undefined;
    const artifact = mapArtifact(result as any);
    const entries = ((result as any).entries || []).map(mapEntry);
    return { ...artifact, entries };
  },

  async create(params: CreateArtifactParams): Promise<Artifact> {
    const id = await convex.mutation(api.artifacts.create, {
      userId: params.userId,
      title: params.title,
      summary: params.summary || undefined,
      tags: params.tags || [],
      embedding: params.embedding,
    });

    if (params.firstEntry) {
      await this.addEntry(id as string, {
        workflowId: params.firstEntry.workflowId,
        workflowName: params.firstEntry.workflowName,
        content: params.firstEntry.content,
        source: params.firstEntry.source || 'workflow_output',
      });
    }

    const created = await this.get(id as string);
    if (!created) throw new Error('Failed to create artifact');
    return created;
  },

  async update(id: string, params: UpdateArtifactParams): Promise<Artifact | undefined> {
    const fields: Record<string, unknown> = {};
    if (params.title !== undefined) fields.title = params.title;
    if (params.summary !== undefined) fields.summary = params.summary;
    if (params.tags !== undefined) fields.tags = params.tags;
    if (params.embedding !== undefined) fields.embedding = params.embedding;

    if (Object.keys(fields).length > 0) {
      await convex.mutation(api.artifacts.update, {
        id: id as Id<"artifacts">,
        ...fields,
      } as any);
    }

    return this.get(id);
  },

  async delete(id: string): Promise<boolean> {
    try {
      await convex.mutation(api.artifacts.remove, { id: id as Id<"artifacts"> });
      return true;
    } catch {
      return false;
    }
  },

  async addEntry(artifactId: string, params: AddEntryParams): Promise<ArtifactEntry> {
    const id = await convex.mutation(api.artifacts.addEntry, {
      artifactId: artifactId as Id<"artifacts">,
      workflowId: params.workflowId || undefined,
      workflowName: params.workflowName || undefined,
      content: params.content,
      source: (params.source || 'workflow_output') as 'workflow_output' | 'manual' | 'ai_summary',
    });

    return {
      id: id as string,
      artifactId,
      workflowId: params.workflowId || null,
      workflowName: params.workflowName || null,
      content: params.content,
      source: params.source || 'workflow_output',
      createdAt: new Date().toISOString(),
    };
  },

  async getEntries(artifactId: string, _limit?: number): Promise<ArtifactEntry[]> {
    const result = await convex.query(api.artifacts.getWithEntries, { id: artifactId as Id<"artifacts"> });
    if (!result) return [];
    return ((result as any).entries || []).map(mapEntry);
  },

  async deleteEntry(_entryId: string): Promise<boolean> {
    console.warn('TODO: implement deleteEntry in Convex');
    return false;
  },

  async findSimilar(options: FindSimilarOptions): Promise<ArtifactSearchResult[]> {
    try {
      const results = await convex.action(api.artifacts.search, {
        userId: options.userId,
        embedding: options.embedding,
        limit: options.limit || 5,
      });
      // Vector search returns { _id, _score }; fetch full docs
      const out: ArtifactSearchResult[] = [];
      for (const r of results as any[]) {
        const art = await this.get(r._id as string);
        if (art) {
          out.push({ artifact: art, similarity: r._score });
        }
      }
      return out;
    } catch (error) {
      console.warn('Vector search failed:', error);
      return [];
    }
  },

  async searchByText(userId: string, query: string, limit = 5): Promise<Artifact[]> {
    const all = await this.getByUserId(userId);
    const q = query.toLowerCase();
    return all
      .filter(a => a.title.toLowerCase().includes(q) || (a.summary?.toLowerCase().includes(q)))
      .slice(0, limit);
  },

  async updateEntry(_entryId: string, _content: string): Promise<ArtifactEntry> {
    throw new Error('TODO: implement updateEntry in Convex');
  },

  async updateEmbedding(id: string, embedding: number[]): Promise<void> {
    await convex.mutation(api.artifacts.update, {
      id: id as Id<"artifacts">,
      embedding,
    });
  },
};
