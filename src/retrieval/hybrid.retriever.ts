
import { EmbeddedDocumentChunk } from '../types/document.js';
import type { RetrievalResult } from '../types/retrieval.js';
import { BM25Retriever } from './bm25.retriever.js';
import { VectorRetriever } from './vector.retriever.js';


const DEFAULT_RRF_K = 60;

export interface HybridRetrieverOptions {
  vectorTopK?: number;
  bm25TopK?: number;
  topK?: number;
  rrfK?: number;
}

interface HybridCandidate {
  chunk: EmbeddedDocumentChunk;

  score: number;

  vectorScore?: number;
  bm25Score?: number;

  vectorRank?: number;
  bm25Rank?: number;
}

export class HybridRetriever {
  private readonly vectorTopK: number;
  private readonly bm25TopK: number;
  private readonly topK: number;
  private readonly rrfK: number;

  constructor(
    private readonly vectorRetriever: VectorRetriever,
    private readonly bm25Retriever: BM25Retriever,
    options: HybridRetrieverOptions = {},
  ) {
    this.vectorTopK = options.vectorTopK ?? 10;
    this.bm25TopK = options.bm25TopK ?? 10;
    this.topK = options.topK ?? 10;
    this.rrfK = options.rrfK ?? DEFAULT_RRF_K;
  }

  async retrieve(query: string): Promise<RetrievalResult[]> {
    const [vectorResults, bm25Results] = await Promise.all([
      this.vectorRetriever.retrieve(
        query,
        this.vectorTopK,
      ),
      this.bm25Retriever.retrieve(
        query,
        this.bm25TopK,
      ),
    ]);

    const candidates = new Map<string, HybridCandidate>();

    this.addVectorResults(
      candidates,
      vectorResults,
    );

    this.addBM25Results(
      candidates,
      bm25Results,
    );

    return [...candidates.values()]
  .sort((a, b) => b.score - a.score)
  .slice(0, this.topK)
  .map((candidate) => {
    const result: RetrievalResult = {
      chunk: candidate.chunk,
      score: candidate.score,
    };

    if (candidate.vectorScore !== undefined) {
      result.vectorScore = candidate.vectorScore;
    }

    if (candidate.bm25Score !== undefined) {
      result.bm25Score = candidate.bm25Score;
    }

    if (candidate.vectorRank !== undefined) {
      result.vectorRank = candidate.vectorRank;
    }

    if (candidate.bm25Rank !== undefined) {
      result.bm25Rank = candidate.bm25Rank;
    }

    return result;
  });
  }

  private addVectorResults(
    candidates: Map<string, HybridCandidate>,
    results: RetrievalResult[],
  ): void {
    results.forEach((result, index) => {
      const rank = index + 1;

      const existing = candidates.get(
        result.chunk.id,
      );

      const rrfScore = this.calculateRRF(rank);

      if (existing) {
        existing.score += rrfScore;
        existing.vectorScore = result.score;
        existing.vectorRank = rank;
        return;
      }

      candidates.set(result.chunk.id, {
        chunk: result.chunk,
        score: rrfScore,
        vectorScore: result.score,
        vectorRank: rank,
      });
    });
  }

  private addBM25Results(
    candidates: Map<string, HybridCandidate>,
    results: RetrievalResult[],
  ): void {
    results.forEach((result, index) => {
      const rank = index + 1;

      const existing = candidates.get(
        result.chunk.id,
      );

      const rrfScore = this.calculateRRF(rank);

      if (existing) {
        existing.score += rrfScore;
        existing.bm25Score = result.score;
        existing.bm25Rank = rank;
        return;
      }

      candidates.set(result.chunk.id, {
        chunk: result.chunk,
        score: rrfScore,
        bm25Score: result.score,
        bm25Rank: rank,
      });
    });
  }

  private calculateRRF(rank: number): number {
    return 1 / (this.rrfK + rank);
  }
}