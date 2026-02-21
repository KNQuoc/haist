/**
 * Artifact Service
 *
 * CRUD operations for artifacts and artifact entries.
 * Handles both Supabase (production) and local PostgreSQL (development).
 */

import { pool, isSupabase } from '@/lib/db';
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
const ARTIFACT_TABLE = isSupabase ? 'artifact' : '"Artifact"';
const ARTIFACT_ENTRY_TABLE = isSupabase ? 'artifact_entry' : '"ArtifactEntry"';

// Column name helpers
const col = {
  userId: isSupabase ? 'user_id' : '"userId"',
  artifactId: isSupabase ? 'artifact_id' : '"artifactId"',
  workflowId: isSupabase ? 'workflow_id' : '"workflowId"',
  workflowName: isSupabase ? 'workflow_name' : '"workflowName"',
  createdAt: isSupabase ? 'created_at' : '"createdAt"',
  updatedAt: isSupabase ? 'updated_at' : '"updatedAt"',
};

/**
 * Generate unique ID
 */
function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  return prefix ? `${prefix}_${timestamp}${randomPart}` : `c${timestamp}${randomPart}`;
}

/**
 * Map database row to Artifact
 */
function mapArtifactRow(row: Record<string, unknown>): Artifact {
  const userId = row.userId || row.user_id;
  const createdAt = row.createdAt || row.created_at;
  const updatedAt = row.updatedAt || row.updated_at;

  return {
    id: row.id as string,
    userId: userId as string,
    title: row.title as string,
    summary: row.summary as string | null,
    tags: (row.tags as string[]) || [],
    createdAt: createdAt instanceof Date ? createdAt.toISOString() : String(createdAt),
    updatedAt: updatedAt instanceof Date ? updatedAt.toISOString() : String(updatedAt),
  };
}

/**
 * Map database row to ArtifactEntry
 */
function mapEntryRow(row: Record<string, unknown>): ArtifactEntry {
  const artifactId = row.artifactId || row.artifact_id;
  const workflowId = row.workflowId || row.workflow_id;
  const workflowName = row.workflowName || row.workflow_name;
  const createdAt = row.createdAt || row.created_at;

  return {
    id: row.id as string,
    artifactId: artifactId as string,
    workflowId: workflowId as string | null,
    workflowName: workflowName as string | null,
    content: row.content as string,
    source: row.source as ArtifactEntrySource,
    createdAt: createdAt instanceof Date ? createdAt.toISOString() : String(createdAt),
  };
}

/**
 * Artifact storage operations
 */
export const artifactService = {
  /**
   * Get all artifacts for a user
   */
  async getByUserId(userId: string): Promise<Artifact[]> {
    const result = await pool.query(
      `SELECT * FROM ${ARTIFACT_TABLE} WHERE ${col.userId} = $1 ORDER BY ${col.updatedAt} DESC`,
      [userId]
    );
    return result.rows.map(mapArtifactRow);
  },

  /**
   * Get a single artifact by ID
   */
  async get(id: string): Promise<Artifact | undefined> {
    const result = await pool.query(
      `SELECT * FROM ${ARTIFACT_TABLE} WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) return undefined;
    return mapArtifactRow(result.rows[0]);
  },

  /**
   * Get artifact with all its entries
   */
  async getWithEntries(id: string): Promise<ArtifactWithEntries | undefined> {
    const artifact = await this.get(id);
    if (!artifact) return undefined;

    const entriesResult = await pool.query(
      `SELECT * FROM ${ARTIFACT_ENTRY_TABLE} WHERE ${col.artifactId} = $1 ORDER BY ${col.createdAt} DESC`,
      [id]
    );

    return {
      ...artifact,
      entries: entriesResult.rows.map(mapEntryRow),
    };
  },

  /**
   * Create a new artifact
   */
  async create(params: CreateArtifactParams): Promise<Artifact> {
    const id = generateId('art');
    const embeddingValue = params.embedding
      ? `'[${params.embedding.join(',')}]'::vector`
      : 'NULL';

    // Insert artifact
    await pool.query(
      `INSERT INTO ${ARTIFACT_TABLE} (id, ${col.userId}, title, summary, tags, embedding, ${col.createdAt}, ${col.updatedAt})
       VALUES ($1, $2, $3, $4, $5, ${embeddingValue}, NOW(), NOW())`,
      [
        id,
        params.userId,
        params.title,
        params.summary || null,
        params.tags || [],
      ]
    );

    // Add first entry if provided
    if (params.firstEntry) {
      await this.addEntry(id, {
        workflowId: params.firstEntry.workflowId,
        workflowName: params.firstEntry.workflowName,
        content: params.firstEntry.content,
        source: params.firstEntry.source || 'workflow_output',
      });
    }

    const artifact = await this.get(id);
    if (!artifact) throw new Error('Failed to create artifact');
    return artifact;
  },

  /**
   * Update an artifact
   */
  async update(id: string, params: UpdateArtifactParams): Promise<Artifact | undefined> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (params.title !== undefined) {
      setClauses.push(`title = $${paramIndex++}`);
      values.push(params.title);
    }
    if (params.summary !== undefined) {
      setClauses.push(`summary = $${paramIndex++}`);
      values.push(params.summary);
    }
    if (params.tags !== undefined) {
      setClauses.push(`tags = $${paramIndex++}`);
      values.push(params.tags);
    }
    if (params.embedding !== undefined) {
      setClauses.push(`embedding = '[${params.embedding.join(',')}]'::vector`);
    }

    if (setClauses.length === 0) {
      return this.get(id);
    }

    setClauses.push(`${col.updatedAt} = NOW()`);
    values.push(id);

    await pool.query(
      `UPDATE ${ARTIFACT_TABLE} SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    return this.get(id);
  },

  /**
   * Delete an artifact and all its entries
   */
  async delete(id: string): Promise<boolean> {
    // Delete entries first (cascade should handle this, but being explicit)
    await pool.query(
      `DELETE FROM ${ARTIFACT_ENTRY_TABLE} WHERE ${col.artifactId} = $1`,
      [id]
    );

    const result = await pool.query(
      `DELETE FROM ${ARTIFACT_TABLE} WHERE id = $1 RETURNING id`,
      [id]
    );
    return result.rows.length > 0;
  },

  /**
   * Add an entry to an artifact
   */
  async addEntry(artifactId: string, params: AddEntryParams): Promise<ArtifactEntry> {
    const id = generateId('ent');

    await pool.query(
      `INSERT INTO ${ARTIFACT_ENTRY_TABLE} (id, ${col.artifactId}, ${col.workflowId}, ${col.workflowName}, content, source, ${col.createdAt})
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        id,
        artifactId,
        params.workflowId || null,
        params.workflowName || null,
        params.content,
        params.source || 'workflow_output',
      ]
    );

    // Update artifact's updated_at timestamp
    await pool.query(
      `UPDATE ${ARTIFACT_TABLE} SET ${col.updatedAt} = NOW() WHERE id = $1`,
      [artifactId]
    );

    const result = await pool.query(
      `SELECT * FROM ${ARTIFACT_ENTRY_TABLE} WHERE id = $1`,
      [id]
    );

    return mapEntryRow(result.rows[0]);
  },

  /**
   * Get entries for an artifact
   */
  async getEntries(artifactId: string, limit?: number): Promise<ArtifactEntry[]> {
    const limitClause = limit ? `LIMIT ${limit}` : '';
    const result = await pool.query(
      `SELECT * FROM ${ARTIFACT_ENTRY_TABLE} WHERE ${col.artifactId} = $1 ORDER BY ${col.createdAt} DESC ${limitClause}`,
      [artifactId]
    );
    return result.rows.map(mapEntryRow);
  },

  /**
   * Delete an entry
   */
  async deleteEntry(entryId: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM ${ARTIFACT_ENTRY_TABLE} WHERE id = $1 RETURNING id`,
      [entryId]
    );
    return result.rows.length > 0;
  },

  /**
   * Find similar artifacts using vector similarity search
   * Requires pgvector extension
   */
  async findSimilar(options: FindSimilarOptions): Promise<ArtifactSearchResult[]> {
    const { userId, embedding, threshold = 0.85, limit = 5 } = options;

    try {
      // Using cosine similarity (1 - cosine_distance)
      const embeddingStr = `'[${embedding.join(',')}]'::vector`;
      const result = await pool.query(
        `SELECT *, 1 - (embedding <=> ${embeddingStr}) as similarity
         FROM ${ARTIFACT_TABLE}
         WHERE ${col.userId} = $1
           AND embedding IS NOT NULL
           AND 1 - (embedding <=> ${embeddingStr}) >= $2
         ORDER BY similarity DESC
         LIMIT $3`,
        [userId, threshold, limit]
      );

      return result.rows.map((row) => ({
        artifact: mapArtifactRow(row),
        similarity: row.similarity as number,
      }));
    } catch (error) {
      // If pgvector is not installed, return empty array
      console.warn('Vector search failed (pgvector may not be installed):', error);
      return [];
    }
  },

  /**
   * Search artifacts by text (fallback when vectors not available)
   */
  async searchByText(userId: string, query: string, limit = 5): Promise<Artifact[]> {
    const searchPattern = `%${query.toLowerCase()}%`;
    const result = await pool.query(
      `SELECT * FROM ${ARTIFACT_TABLE}
       WHERE ${col.userId} = $1
         AND (LOWER(title) LIKE $2 OR LOWER(summary) LIKE $2)
       ORDER BY ${col.updatedAt} DESC
       LIMIT $3`,
      [userId, searchPattern, limit]
    );
    return result.rows.map(mapArtifactRow);
  },

  /**
   * Update an entry's content
   */
  async updateEntry(entryId: string, content: string): Promise<ArtifactEntry> {
    const result = await pool.query(
      `UPDATE ${ARTIFACT_ENTRY_TABLE} SET content = $1 WHERE id = $2 RETURNING *`,
      [content, entryId]
    );
    if (result.rows.length === 0) {
      throw new Error('Entry not found');
    }
    return mapEntryRow(result.rows[0]);
  },

  /**
   * Update artifact embedding
   */
  async updateEmbedding(id: string, embedding: number[]): Promise<void> {
    const embeddingStr = `'[${embedding.join(',')}]'::vector`;
    await pool.query(
      `UPDATE ${ARTIFACT_TABLE} SET embedding = ${embeddingStr}, ${col.updatedAt} = NOW() WHERE id = $1`,
      [id]
    );
  },
};
