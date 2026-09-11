import { BM25Retriever } from './bm25.retriever.js';
import { VectorRetriever } from './vector.retriever.js';

import type {
  RetrievalExecution,
  RetrievalResult,
} from '../types/retrieval.js';

const DEFAULT_RRF_K = 60;
const DEFAULT_TOP_K = 10;

export class HybridRetriever {
  constructor(
    private readonly vectorRetriever: VectorRetriever,
    private readonly bm25Retriever: BM25Retriever,
    private readonly rrfK = DEFAULT_RRF_K,
  ) {}

  async retrieve(
    query: string,
    topK = DEFAULT_TOP_K,
  ): Promise<RetrievalResult[]> {
    const execution =
      await this.retrieveWithStages(
        query,
        topK,
      );

    return execution.hybrid;
  }

  async retrieveWithStages(
    query: string,
    topK = DEFAULT_TOP_K,
  ): Promise<RetrievalExecution> {
    const [
      vectorResults,
      bm25Results,
    ] = await Promise.all([
      this.vectorRetriever.retrieve(
        query,
        topK,
      ),

      this.bm25Retriever.retrieve(
        query,
        topK,
      ),
    ]);

    const hybrid =
      this.combineWithRRF(
        vectorResults,
        bm25Results,
        topK,
      );

    return {
      vector: vectorResults,
      bm25: bm25Results,
      hybrid,
      reranked: [],
    };
  }

  private combineWithRRF(
    vectorResults: RetrievalResult[],
    bm25Results: RetrievalResult[],
    topK: number,
  ): RetrievalResult[] {
    const candidates =
      new Map<
        string,
        RetrievalResult
      >();

    vectorResults.forEach(
      (result, index) => {
        candidates.set(
          result.chunk.id,
          {
            ...result,

            vectorRank:
              index + 1,

            vectorScore:
              result.score,
          },
        );
      },
    );

    bm25Results.forEach(
      (result, index) => {
        const existing =
          candidates.get(
            result.chunk.id,
          );

        if (existing) {
          candidates.set(
            result.chunk.id,
            {
              ...existing,

              bm25Rank:
                index + 1,

              bm25Score:
                result.score,
            },
          );
        } else {
          candidates.set(
            result.chunk.id,
            {
              ...result,

              bm25Rank:
                index + 1,

              bm25Score:
                result.score,
            },
          );
        }
      },
    );

    return [...candidates.values()]
      .map((result) => {
        const vectorContribution =
          result.vectorRank !==
          undefined
            ? 1 /
              (this.rrfK +
                result.vectorRank)
            : 0;

        const bm25Contribution =
          result.bm25Rank !==
          undefined
            ? 1 /
              (this.rrfK +
                result.bm25Rank)
            : 0;

        const rrfScore =
          vectorContribution +
          bm25Contribution;

        return {
          ...result,

          score:
            rrfScore,

          rrfScore,
        };
      })
      .sort(
        (a, b) =>
          (b.rrfScore ?? 0) -
          (a.rrfScore ?? 0),
      )
      .slice(0, topK);
  }
}