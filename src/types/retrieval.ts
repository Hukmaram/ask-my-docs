import type { EmbeddedDocumentChunk } from './document.js';

export interface RetrievalResult {
  chunk: EmbeddedDocumentChunk;
  score: number;

  vectorScore?: number;
  bm25Score?: number;

  vectorRank?: number;
  bm25Rank?: number;
}