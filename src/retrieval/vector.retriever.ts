import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import type {
  EmbeddedDocumentChunk,
} from '../types/document.js';

import {
  EmbeddingService,
} from '../embeddings/embedding.service.js';
import { RetrievalResult } from '../types/retrieval.js';

const PROCESSED_DATA_DIR = path.resolve(
  'data/processed',
);

interface ProcessedDocument {
  chunks: EmbeddedDocumentChunk[];
}


export class VectorRetriever {
  constructor(
    private readonly embeddingService = new EmbeddingService(),
  ) {}

  async retrieve(
    query: string,
    topK = 5,
  ): Promise<RetrievalResult[]> {
   
    const queryEmbedding =
      await this.embeddingService.embedText(
        query,
      );


    const chunks =
      await this.loadChunks();


    const results = chunks.map((chunk) => ({
      chunk,
      score: cosineSimilarity(
        queryEmbedding,
        chunk.embedding.vector,
      ),
    }));


    results.sort(
      (a, b) => b.score - a.score,
    );


    return results.slice(0, topK);
  }

  private async loadChunks(): Promise<
    EmbeddedDocumentChunk[]
  > {
    const files =
      await readdir(
        PROCESSED_DATA_DIR,
      );

    const chunks: EmbeddedDocumentChunk[] = [];

    for (const fileName of files) {
      if (!fileName.endsWith('.json')) {
        continue;
      }

      const filePath =
        path.join(
          PROCESSED_DATA_DIR,
          fileName,
        );

      const file =
        await readFile(
          filePath,
          'utf-8',
        );

      const document =
        JSON.parse(
          file,
        ) as ProcessedDocument;

      chunks.push(
        ...document.chunks,
      );
    }

    return chunks;
  }
}

function cosineSimilarity(
  a: number[],
  b: number[],
): number {
  if (a.length !== b.length) {
    throw new Error(
      `Embedding dimensions do not match: ` +
      `${a.length} vs ${b.length}`,
    );
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    const valueA = a[i];
    const valueB = b[i];

    if (
      valueA === undefined ||
      valueB === undefined
    ) {
      continue;
    }

    dotProduct += valueA * valueB;
    magnitudeA += valueA * valueA;
    magnitudeB += valueB * valueB;
  }

  if (
    magnitudeA === 0 ||
    magnitudeB === 0
  ) {
    return 0;
  }

  return (
    dotProduct /
    (
      Math.sqrt(magnitudeA) *
      Math.sqrt(magnitudeB)
    )
  );
}