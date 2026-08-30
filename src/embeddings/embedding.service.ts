import type {
  DocumentChunk,
  EmbeddedDocumentChunk,
} from '../types/document.js';

import {
  EMBEDDING_MODEL,
  EmbeddingClient,
} from './embedding.client.js';

export class EmbeddingService {
  constructor(
    private readonly client = new EmbeddingClient(),
  ) {}

  async embedChunks(
    chunks: DocumentChunk[],
  ): Promise<EmbeddedDocumentChunk[]> {
    if (chunks.length === 0) {
      return [];
    }

    const texts = chunks.map(
      (chunk) => chunk.content,
    );

    const embeddings =
      await this.client.embedMany(texts);

    return chunks.map((chunk, index) => {
      const vector = embeddings[index];

      if (!vector) {
        throw new Error(
          `Missing embedding for chunk ${chunk.id}`,
        );
      }

      return {
        ...chunk,

        embedding: {
          model: EMBEDDING_MODEL,
          dimensions: vector.length,
          vector,
        },
      };
    });
  }

  async embedText(
    text: string,
  ): Promise<number[]> {
    const embeddings =
      await this.client.embedMany([text]);

    const embedding = embeddings[0];

    if (!embedding) {
      throw new Error(
        'Missing embedding for query',
      );
    }

    return embedding;
  }
}