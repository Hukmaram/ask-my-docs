import { pool } from '../db/pool.js';

import {
  EmbeddingService,
} from '../embeddings/embedding.service.js';

import type {
  EmbeddedDocumentChunk,
} from '../types/document.js';

import type {
  RetrievalResult,
} from '../types/retrieval.js';

interface VectorRow {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  page_numbers: number[];
  metadata: Record<string, unknown>;
  embedding_model: string | null;
  distance: number;
}

export class VectorRetriever {
  constructor(
    private readonly embeddingService =
      new EmbeddingService(),
  ) {}

  async retrieve(
    query: string,
    topK = 10,
  ): Promise<RetrievalResult[]> {
    /*
     * ---------------------------------------------------
     * 1. EMBED QUERY
     * ---------------------------------------------------
     *
     * Query text
     *     ↓
     * EmbeddingService
     *     ↓
     * 768-dimensional vector
     */

    const queryEmbedding =
      await this.embeddingService.embedText(
        query,
      );

    /*
     * pgvector accepts vector values in the
     * following format:
     *
     * [0.123,0.456,...]
     */

    const vector =
      `[${queryEmbedding.join(',')}]`;

    /*
     * ---------------------------------------------------
     * 2. VECTOR SEARCH
     * ---------------------------------------------------
     *
     * <=> = cosine distance
     *
     * Smaller distance = more similar.
     */

    const result =
      await pool.query<VectorRow>(
        `
        SELECT
          id,
          document_id,
          chunk_index,
          content,
          page_numbers,
          metadata,
          embedding_model,
          embedding <=> $1::vector AS distance
        FROM document_chunks
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> $1::vector
        LIMIT $2
        `,
        [
          vector,
          topK,
        ],
      );

    /*
     * ---------------------------------------------------
     * 3. MAP DATABASE ROWS
     * ---------------------------------------------------
     */

    return result.rows.map((row) => {
      const chunk:
        EmbeddedDocumentChunk = {
        id: row.id,

        documentId:
          row.document_id,

        content:
          row.content,

        chunkIndex:
          row.chunk_index,

        pageNumbers:
          row.page_numbers,

        metadata:
          row.metadata,

        embedding: {
          model:
            row.embedding_model ??
            'unknown',

          dimensions: 768,

          /*
           * We don't select the actual embedding
           * vector because the retriever doesn't need it.
           */
          vector: [],
        },
      };

      /*
       * -------------------------------------------------
       * 4. CONVERT DISTANCE → SIMILARITY
       * -------------------------------------------------
       *
       * cosine distance:
       *
       *   0 = most similar
       *
       * We convert it to the score convention used
       * by our RetrievalResult:
       *
       *   score = 1 - distance
       *
       * Therefore:
       *
       *   higher score = more similar
       */

      const score =
        1 - row.distance;

      return {
        chunk,
        score,
      };
    });
  }
}