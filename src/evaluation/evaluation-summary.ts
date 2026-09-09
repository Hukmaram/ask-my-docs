export interface RetrievalMetrics {
  vectorRecallAt5: number;
  bm25RecallAt5: number;
  hybridRecallAt5: number;
  rerankedRecallAt5: number;
}

export interface GenerationQuestionResult {
  questionId: string;

  faithfulness: number;
  relevance: number;

  /**
   * 1 = citations are valid
   * 0 = citations are invalid
   */
  citationValidity: number;

  passed: boolean;
}

export interface GenerationMetrics {
  faithfulness: number;
  relevance: number;
  citationValidity: number;
  generationPassRate: number;

  results: GenerationQuestionResult[];
}

export interface QualityThresholds {
  rerankedRecallAt5: number;
  faithfulness: number;
  relevance: number;
  citationValidity: number;
  generationPassRate: number;
}

export interface QualityGateResult {
  metric: string;
  actual: number;
  threshold: number;
  passed: boolean;
}

export interface EvaluationSummary {
  retrieval: RetrievalMetrics;
  generation: GenerationMetrics;
  thresholds: QualityThresholds;

  qualityGate: {
    passed: boolean;
    results: QualityGateResult[];
  };
}

/**
 * Calculates aggregate generation metrics and determines
 * whether each individual question passes the generation
 * quality criteria.
 */
export function calculateGenerationMetrics(
  results: GenerationQuestionResult[],
  thresholds: Pick<
    QualityThresholds,
    'faithfulness' | 'relevance' | 'citationValidity'
  >,
): GenerationMetrics {
  if (results.length === 0) {
    return {
      faithfulness: 0,
      relevance: 0,
      citationValidity: 0,
      generationPassRate: 0,
      results: [],
    };
  }

  const faithfulness =
    results.reduce(
      (sum, result) =>
        sum + result.faithfulness,
      0,
    ) / results.length;

  const relevance =
    results.reduce(
      (sum, result) =>
        sum + result.relevance,
      0,
    ) / results.length;

  const citationValidity =
    results.reduce(
      (sum, result) =>
        sum + result.citationValidity,
      0,
    ) / results.length;

  const generationPassRate =
    results.filter(
      (result) => result.passed,
    ).length / results.length;

  return {
    faithfulness,
    relevance,
    citationValidity,
    generationPassRate,
    results,
  };
}

/**
 * Determines whether the complete RAG system passes
 * the configured quality thresholds.
 */
export function evaluateQualityGate(
  retrieval: RetrievalMetrics,
  generation: GenerationMetrics,
  thresholds: QualityThresholds,
): EvaluationSummary {
  const results: QualityGateResult[] = [
    {
      metric: 'Reranked Recall@5',
      actual:
        retrieval.rerankedRecallAt5,
      threshold:
        thresholds.rerankedRecallAt5,
      passed:
        retrieval.rerankedRecallAt5 >=
        thresholds.rerankedRecallAt5,
    },

    {
      metric: 'Faithfulness',
      actual:
        generation.faithfulness,
      threshold:
        thresholds.faithfulness,
      passed:
        generation.faithfulness >=
        thresholds.faithfulness,
    },

    {
      metric: 'Answer Relevance',
      actual:
        generation.relevance,
      threshold:
        thresholds.relevance,
      passed:
        generation.relevance >=
        thresholds.relevance,
    },

    {
      metric: 'Citation Validity',
      actual:
        generation.citationValidity,
      threshold:
        thresholds.citationValidity,
      passed:
        generation.citationValidity >=
        thresholds.citationValidity,
    },

    {
      metric: 'Generation Pass Rate',
      actual:
        generation.generationPassRate,
      threshold:
        thresholds.generationPassRate,
      passed:
        generation.generationPassRate >=
        thresholds.generationPassRate,
    },
  ];

  return {
    retrieval,
    generation,
    thresholds,

    qualityGate: {
      passed: results.every(
        (result) => result.passed,
      ),
      results,
    },
  };
}