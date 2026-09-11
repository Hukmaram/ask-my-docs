import { pool } from '../db/pool.js';

import type {
  EmbeddedDocumentChunk,
} from '../types/document.js';

import type {
  RetrievalResult,
} from '../types/retrieval.js';

interface LexicalRow {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  page_numbers: number[];
  metadata: Record<string, unknown>;
  embedding_model: string | null;
  score: number;
}

export class BM25Retriever {
  async retrieve(
    query: string,
    topK = 10,
  ): Promise<RetrievalResult[]> {
    /*
     * ---------------------------------------------------
     * 1. BUILD POSTGRESQL FULL-TEXT SEARCH QUERY
     * ---------------------------------------------------
     *
     * websearch_to_tsquery() converts the user's natural
     * language query into a PostgreSQL tsquery.
     *
     * Example:
     *
     * "retrieval augmented generation"
     *
     * becomes a PostgreSQL-compatible search query.
     */

    const result =
      await pool.query<LexicalRow>(
        `
        WITH search AS (
          SELECT websearch_to_tsquery(
            'english',
            $1
          ) AS query
        )

        SELECT
          dc.id,
          dc.document_id,
          dc.chunk_index,
          dc.content,
          dc.page_numbers,
          dc.metadata,
          dc.embedding_model,

          ts_rank_cd(
            to_tsvector(
              'english',
              dc.content
            ),
            search.query
          ) AS score

        FROM document_chunks AS dc
        CROSS JOIN search

        WHERE
          to_tsvector(
            'english',
            dc.content
          )
          @@ search.query

        ORDER BY score DESC

        LIMIT $2
        `,
        [
          query,
          topK,
        ],
      );

    /*
     * ---------------------------------------------------
     * 2. CONVERT DATABASE ROWS TO RetrievalResult
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
           * The actual embedding isn't required by
           * lexical retrieval, so we don't fetch it.
           */
          vector: [],
        },
      };

      return {
        chunk,

        score:
          row.score,
      };
    });
  }
}