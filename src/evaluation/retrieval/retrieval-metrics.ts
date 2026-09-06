import type { RetrievalResult } from '../../types/retrieval.js';

export interface RetrievalRecallResult {
  k: number;
  expectedSourceIds: string[];
  retrievedSourceIds: string[];
  matchedSourceIds: string[];
  recall: number;
}

export function calculateRecallAtK(
  results: RetrievalResult[],
  expectedSourceIds: string[],
  k: number,
): RetrievalRecallResult {
  const topK = results.slice(0, k);

  const retrievedSourceIds = [
    ...new Set(
      topK.map(
        (result) => result.chunk.id,
      ),
    ),
  ];

  const matchedSourceIds =
    expectedSourceIds.filter((expectedId) =>
      retrievedSourceIds.includes(expectedId),
    );

  const recall =
    expectedSourceIds.length === 0
      ? 1
      : matchedSourceIds.length /
        expectedSourceIds.length;

  return {
    k,
    expectedSourceIds,
    retrievedSourceIds,
    matchedSourceIds,
    recall,
  };
}