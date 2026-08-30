import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import type {
  EmbeddedDocumentChunk,
} from '../types/document.js';

const PROCESSED_DATA_DIR = path.resolve(
  'data/processed',
);

export interface BM25RetrievalResult {
  chunk: EmbeddedDocumentChunk;
  score: number;
}

interface ProcessedDocument {
  chunks: EmbeddedDocumentChunk[];
}

interface DocumentTerms {
  chunk: EmbeddedDocumentChunk;
  terms: string[];
  termFrequency: Map<string, number>;
  length: number;
}

const K1 = 1.2;
const B = 0.75;

export class BM25Retriever {
  async retrieve(
    query: string,
    topK = 5,
  ): Promise<BM25RetrievalResult[]> {

    const chunks =
      await this.loadChunks();

    if (chunks.length === 0) {
      return [];
    }

    const queryTerms =
      tokenize(query);

    if (queryTerms.length === 0) {
      return [];
    }

    const documents =
      chunks.map((chunk) => {
        const terms =
          tokenize(chunk.content);

        return {
          chunk,
          terms,
          termFrequency:
            buildTermFrequency(terms),
          length: terms.length,
        };
      });

    const averageDocumentLength =
      documents.reduce(
        (total, document) =>
          total + document.length,
        0,
      ) / documents.length;


    const documentFrequency =
      buildDocumentFrequency(
        documents,
      );

    const results =
      documents.map((document) => ({
        chunk: document.chunk,
        score: calculateBM25Score(
          queryTerms,
          document,
          documentFrequency,
          documents.length,
          averageDocumentLength,
        ),
      }));

    results.sort(
      (a, b) => b.score - a.score,
    );

    return results
      .filter((result) => result.score > 0)
      .slice(0, topK);
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

/*
 * -------------------------------------------------------
 * TOKENIZATION
 * -------------------------------------------------------
 *
 * BM25 needs words/terms rather than embeddings.
 *
 * We normalize:
 *
 * "Retrieval-Augmented Generation"
 *
 * into terms such as:
 *
 * ["retrieval", "augmented", "generation"]
 *
 * -------------------------------------------------------
 */

function tokenize(
  text: string,
): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/*
 * -------------------------------------------------------
 * TERM FREQUENCY
 * -------------------------------------------------------
 */

function buildTermFrequency(
  terms: string[],
): Map<string, number> {
  const frequencies =
    new Map<string, number>();

  for (const term of terms) {
    frequencies.set(
      term,
      (frequencies.get(term) ?? 0) + 1,
    );
  }

  return frequencies;
}

/*
 * -------------------------------------------------------
 * DOCUMENT FREQUENCY
 * -------------------------------------------------------
 *
 * DF(term) =
 * number of documents containing the term.
 * -------------------------------------------------------
 */

function buildDocumentFrequency(
  documents: DocumentTerms[],
): Map<string, number> {
  const frequencies =
    new Map<string, number>();

  for (const document of documents) {
    const uniqueTerms =
      new Set(document.terms);

    for (const term of uniqueTerms) {
      frequencies.set(
        term,
        (frequencies.get(term) ?? 0) + 1,
      );
    }
  }

  return frequencies;
}

/*
 * -------------------------------------------------------
 * BM25 SCORE
 * -------------------------------------------------------
 *
 * BM25 =
 *
 * IDF ×
 *
 *      TF × (K1 + 1)
 * --------------------------------
 *      TF + K1 × (1 - B + B × DL / AVGDL)
 *
 * -------------------------------------------------------
 */

function calculateBM25Score(
  queryTerms: string[],
  document: DocumentTerms,
  documentFrequency: Map<string, number>,
  totalDocuments: number,
  averageDocumentLength: number,
): number {
  let score = 0;

  for (const term of queryTerms) {
    const termFrequency =
      document.termFrequency.get(term) ?? 0;

    if (termFrequency === 0) {
      continue;
    }

    const frequency =
      documentFrequency.get(term) ?? 0;

    if (frequency === 0) {
      continue;
    }

    /*
     * Robertson/Sparck Jones IDF.
     *
     * +1 keeps the logarithm stable.
     */

    const idf = Math.log(
      (
        (
          totalDocuments -
          frequency +
          0.5
        ) /
        (
          frequency +
          0.5
        )
      ) + 1,
    );

    const lengthNormalization =
      1 -
      B +
      B *
        (
          document.length /
          averageDocumentLength
        );

    const termScore =
      idf *
      (
        (
          termFrequency *
          (K1 + 1)
        ) /
        (
          termFrequency +
          K1 *
          lengthNormalization
        )
      );

    score += termScore;
  }

  return score;
}