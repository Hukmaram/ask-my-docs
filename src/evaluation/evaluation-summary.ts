import * as fs from 'node:fs/promises';
import * as path from 'node:path';

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
  timestamp: string;
  retrieval: RetrievalMetrics;
  generation: GenerationMetrics;
  thresholds: QualityThresholds;
  qualityGate: {
    provisional: boolean;
    passed: boolean;
    results: QualityGateResult[];
  };
}

export const DEFAULT_QUALITY_THRESHOLDS: QualityThresholds = {
  rerankedRecallAt5: 0.8,
  faithfulness: 0.9,
  relevance: 0.8,
  citationValidity: 1.0,
  generationPassRate: 0.8,
};

export function calculateGenerationMetrics(
  results: GenerationQuestionResult[],
  _thresholds?: Pick<
    QualityThresholds,
    'faithfulness' | 'relevance' | 'citationValidity'
  >,
): GenerationMetrics {
  void _thresholds;
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
      (sum, result) => sum + result.faithfulness,
      0,
    ) / results.length;

  const relevance =
    results.reduce(
      (sum, result) => sum + result.relevance,
      0,
    ) / results.length;

  const citationValidity =
    results.reduce(
      (sum, result) => sum + result.citationValidity,
      0,
    ) / results.length;

  const generationPassRate =
    results.filter((result) => result.passed).length / results.length;

  return {
    faithfulness,
    relevance,
    citationValidity,
    generationPassRate,
    results,
  };
}

export function evaluateQualityGate(
  retrieval: RetrievalMetrics,
  generation: GenerationMetrics,
  thresholds: QualityThresholds = DEFAULT_QUALITY_THRESHOLDS,
  provisional = true,
): EvaluationSummary {
  const results: QualityGateResult[] = [
    {
      metric: 'Reranked Recall@5',
      actual: retrieval.rerankedRecallAt5,
      threshold: thresholds.rerankedRecallAt5,
      passed: retrieval.rerankedRecallAt5 >= thresholds.rerankedRecallAt5,
    },
    {
      metric: 'Faithfulness',
      actual: generation.faithfulness,
      threshold: thresholds.faithfulness,
      passed: generation.faithfulness >= thresholds.faithfulness,
    },
    {
      metric: 'Answer Relevance',
      actual: generation.relevance,
      threshold: thresholds.relevance,
      passed: generation.relevance >= thresholds.relevance,
    },
    {
      metric: 'Citation Validity',
      actual: generation.citationValidity,
      threshold: thresholds.citationValidity,
      passed: generation.citationValidity >= thresholds.citationValidity,
    },
    {
      metric: 'Generation Pass Rate',
      actual: generation.generationPassRate,
      threshold: thresholds.generationPassRate,
      passed: generation.generationPassRate >= thresholds.generationPassRate,
    },
  ];

  return {
    timestamp: new Date().toISOString(),
    retrieval,
    generation,
    thresholds,
    qualityGate: {
      provisional,
      passed: results.every((result) => result.passed),
      results,
    },
  };
}

export function formatEvaluationConsoleReport(summary: EvaluationSummary): string {
  const lines: string[] = [
    '',
    'Evaluation Summary',
    '------------------',
    `Vector Recall@5:       ${(summary.retrieval.vectorRecallAt5 * 100).toFixed(1)}%`,
    `Lexical Recall@5:      ${(summary.retrieval.bm25RecallAt5 * 100).toFixed(1)}%`,
    `Hybrid Recall@5:       ${(summary.retrieval.hybridRecallAt5 * 100).toFixed(1)}%`,
    `Reranked Recall@5:     ${(summary.retrieval.rerankedRecallAt5 * 100).toFixed(1)}%`,
    `Faithfulness:          ${summary.generation.faithfulness.toFixed(2)}`,
    `Relevance:             ${summary.generation.relevance.toFixed(2)}`,
    `Citation Validity:     ${summary.generation.citationValidity.toFixed(2)}`,
    `Generation Pass Rate:  ${(summary.generation.generationPassRate * 100).toFixed(1)}%`,
    '',
    `Quality Gate (${summary.qualityGate.provisional ? 'PROVISIONAL' : 'ENFORCED'}):  ${
      summary.qualityGate.passed ? 'PASS' : 'FAIL'
    }`,
  ];

  for (const gate of summary.qualityGate.results) {
    const status = gate.passed ? '  ✓ PASS' : '  ✗ FAIL';
    lines.push(
      `${status}  ${gate.metric.padEnd(22)}: ${(gate.actual * 100).toFixed(1)}% (Threshold: ${(
        gate.threshold * 100
      ).toFixed(1)}%)`,
    );
  }

  return lines.join('\n');
}

export async function saveEvaluationJson(
  summary: EvaluationSummary,
  outputPath: string,
): Promise<void> {
  const dir = path.dirname(outputPath);
  if (dir && dir !== '.') {
    await fs.mkdir(dir, { recursive: true });
  }
  await fs.writeFile(outputPath, JSON.stringify(summary, null, 2), 'utf-8');
}