import type { AskMyDocsResponse } from '../agent/ask-my-docs.agent.js';

import {
  type GenerationQuestionResult,
  type QualityThresholds,
} from './evaluation-summary.js';

export function createGenerationQuestionResult(
  questionId: string,
  response: AskMyDocsResponse,
  thresholds: Pick<
    QualityThresholds,
    'faithfulness' | 'relevance' | 'citationValidity'
  >,
): GenerationQuestionResult {
  const faithfulness =
    response.faithfulness?.score ?? 0;

  const relevance =
    response.relevance?.score ?? 0;

  const citationValidity =
    response.citationValidation.valid
      ? 1
      : 0;

  const passed =
    faithfulness >=
      thresholds.faithfulness &&
    relevance >=
      thresholds.relevance &&
    citationValidity >=
      thresholds.citationValidity;

  return {
    questionId,
    faithfulness,
    relevance,
    citationValidity,
    passed,
  };
}