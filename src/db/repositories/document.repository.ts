import type {
  DocumentPage,
  EmbeddedDocumentChunk,
} from '../../types/document.js';

import { pool } from '../pool.js';

export interface SaveDocumentInput {
  paper: {
    id: string;
    title: string;
    authors: string[];
    abstract: string;
    publishedAt: string;
    updatedAt: string;
    pdfUrl: string;
  };

  pages: DocumentPage[];

  chunks: EmbeddedDocumentChunk[];
}

export class DocumentRepository {
  async saveDocument(
    input: SaveDocumentInput,
  ): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      /*
       * ---------------------------------------------------
       * 1. SAVE DOCUMENT
       * ---------------------------------------------------
       */

      await client.query(
        `
          INSERT INTO documents (
            id,
            title,
            source,
            metadata
          )
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (id)
          DO UPDATE SET
            title = EXCLUDED.title,
            source = EXCLUDED.source,
            metadata = EXCLUDED.metadata,
            updated_at = NOW()
        `,
        [
          input.paper.id,
          input.paper.title,
          input.paper.pdfUrl,
          JSON.stringify({
            authors: input.paper.authors,
            abstract: input.paper.abstract,
            publishedAt:
              input.paper.publishedAt,
            updatedAt:
              input.paper.updatedAt,
            pdfUrl: input.paper.pdfUrl,
          }),
        ],
      );

      /*
       * ---------------------------------------------------
       * 2. SAVE PAGES
       * ---------------------------------------------------
       */

      for (const page of input.pages) {
        await client.query(
          `
            INSERT INTO document_pages (
              document_id,
              page_number,
              content
            )
            VALUES ($1, $2, $3)
            ON CONFLICT (
              document_id,
              page_number
            )
            DO UPDATE SET
              content = EXCLUDED.content
          `,
          [
            input.paper.id,
            page.pageNumber,
            page.content,
          ],
        );
      }

      /*
       * ---------------------------------------------------
       * 3. SAVE CHUNKS + EMBEDDINGS
       * ---------------------------------------------------
       */

      for (const chunk of input.chunks) {
        await client.query(
          `
            INSERT INTO document_chunks (
              id,
              document_id,
              chunk_index,
              content,
              page_numbers,
              metadata,
              embedding,
              embedding_model
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7::vector,
              $8
            )
            ON CONFLICT (id)
            DO UPDATE SET
              document_id = EXCLUDED.document_id,
              chunk_index = EXCLUDED.chunk_index,
              content = EXCLUDED.content,
              page_numbers = EXCLUDED.page_numbers,
              metadata = EXCLUDED.metadata,
              embedding = EXCLUDED.embedding,
              embedding_model =
                EXCLUDED.embedding_model
          `,
          [
            chunk.id,
            input.paper.id,
            chunk.chunkIndex,
            chunk.content,
            chunk.pageNumbers,
            JSON.stringify(chunk.metadata),
            `[${chunk.embedding.vector.join(',')}]`,
            chunk.embedding.model,
          ],
        );
      }

      /*
       * ---------------------------------------------------
       * 4. COMMIT
       * ---------------------------------------------------
       */

      await client.query('COMMIT');
    } catch (error) {
      /*
       * ---------------------------------------------------
       * ROLLBACK
       * ---------------------------------------------------
       */

      await client.query('ROLLBACK');

      throw error;
    } finally {
      /*
       * ---------------------------------------------------
       * RELEASE CONNECTION
       * ---------------------------------------------------
       */

      client.release();
    }
  }
}