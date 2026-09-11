import type { EmbeddedDocumentChunk } from './document.js';

export interface RetrievalResult {
  chunk: EmbeddedDocumentChunk;
  score: number;

  vectorScore?: number;
  bm25Score?: number;

  vectorRank?: number;
  bm25Rank?: number;

  rrfScore?: number;
  rerankScore?: number;
}

export interface RetrievalExecution {
  vector: RetrievalResult[];
  bm25: RetrievalResult[];
  hybrid: RetrievalResult[];
  reranked: RetrievalResult[];
}