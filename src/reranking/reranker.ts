import type { RetrievalResult } from '../types/retrieval.js';

export interface Reranker {
  rerank(
    query: string,
    results: RetrievalResult[],
    topK?: number,
  ): Promise<RetrievalResult[]>;
}