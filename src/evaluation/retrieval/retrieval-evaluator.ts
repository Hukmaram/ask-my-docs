import type { RetrievalResult } from '../../types/retrieval.js';
import type { GoldenQuestion } from '../datasets/golden-dataset.js';
import { calculateRecallAtK, type RetrievalRecallResult } from './retrieval-metrics.js';
export interface RetrievalStageEvaluation {
  name: string;
  recallAt5: number;
  recallAt10: number;
  results: Array<{
    questionId: string;
    recallAt5: RetrievalRecallResult;
    recallAt10: RetrievalRecallResult;
  }>;
}
export function evaluateRetrievalStage(
  dataset: GoldenQuestion[],
  retrievedResults: Map<string, RetrievalResult[]>,
  name: string,
): RetrievalStageEvaluation {
  const results = dataset.map((testCase) => {
    const retrieved = retrievedResults.get(testCase.id) ?? [];
    return {
      questionId: testCase.id,
      recallAt5: calculateRecallAtK(retrieved, testCase.expectedSourceIds, 5),
      recallAt10: calculateRecallAtK(retrieved, testCase.expectedSourceIds, 10),
    };
  });
  const totalQuestions = dataset.length;
  const recallAt5 =
    totalQuestions === 0
      ? 1
      : results.reduce((sum, result) => sum + result.recallAt5.recall, 0) / totalQuestions;
  const recallAt10 =
    totalQuestions === 0
      ? 1
      : results.reduce((sum, result) => sum + result.recallAt10.recall, 0) / totalQuestions;
  return { name, recallAt5, recallAt10, results };
}
