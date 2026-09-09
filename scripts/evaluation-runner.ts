
import { VectorRetriever } from '../src/retrieval/vector.retriever.js';
import { BM25Retriever } from '../src/retrieval/bm25.retriever.js';
import { HybridRetriever } from '../src/retrieval/hybrid.retriever.js';
import { BGEReranker } from '../src/reranking/bge-reranker.js';
import { OllamaClient } from '../src/llm/ollama.client.js';

import { FaithfulnessEvaluator } from '../src/evaluation/faithfulness/faithfulness-evaluator.js';
import { AnswerRelevanceEvaluator } from '../src/evaluation/relevance/answer-relevance-evaluator.js';

import {
  evaluateRetrievalStage,
  type RetrievalStageEvaluation,
} from '../src/evaluation/retrieval/retrieval-evaluator.js';

import {
  calculateGenerationMetrics,
  evaluateQualityGate,
  type GenerationQuestionResult,
  type QualityThresholds,
} from '../src/evaluation/evaluation-summary.js';

import { goldenDataset } from '../src/evaluation/datasets/golden-dataset.js';

import type { RetrievalResult } from '../src/types/retrieval.js';

import {
  AskMyDocsAgent,
  type AskMyDocsResponse,
} from '../src/agent/ask-my-docs.agent.js';

import { sdk } from '../src/instrumentation.js';

/* ============================================================
 * QUALITY THRESHOLDS
 * ============================================================ */

const QUALITY_THRESHOLDS: QualityThresholds = {
  rerankedRecallAt5: 0.80,
  faithfulness: 0.90,
  relevance: 0.80,
  citationValidity: 1.00,
  generationPassRate: 0.80,
};

/* ============================================================
 * HELPERS
 * ============================================================ */

function printPercentage(
  value: number,
): string {
  return `${(value * 100).toFixed(1)}%`;
}

/* ============================================================
 * RETRIEVAL SUMMARY
 * ============================================================ */

function printRetrievalSummary(
  evaluations: RetrievalStageEvaluation[],
): void {
  console.log(
    '\n==============================================',
  );

  console.log(
    'RETRIEVAL EVALUATION',
  );

  console.log(
    '==============================================',
  );

  console.log(
    `Dataset: ${goldenDataset.length} questions`,
  );

  console.log('\nSummary\n');

  console.log(
    'Stage'.padEnd(24) +
      'Recall@5'.padEnd(12) +
      'Recall@10',
  );

  console.log(
    '----------------------------------------------',
  );

  for (const evaluation of evaluations) {
    console.log(
      `${evaluation.name.padEnd(24)}` +
        `${printPercentage(
          evaluation.recallAt5,
        ).padEnd(12)}` +
        `${printPercentage(
          evaluation.recallAt10,
        )}`,
    );
  }
}

/* ============================================================
 * PER-QUESTION RETRIEVAL RESULTS
 * ============================================================ */

function printPerQuestionRetrievalResults(
  evaluations: RetrievalStageEvaluation[],
): void {
  console.log(
    '\n==============================================',
  );

  console.log(
    'PER-QUESTION RETRIEVAL RESULTS',
  );

  console.log(
    '==============================================',
  );

  for (const testCase of goldenDataset) {
    console.log(
      `\n${testCase.id}: ${testCase.question}`,
    );

    console.log(
      `Expected: ${
        testCase.expectedSourceIds.join(
          ', ',
        )
      }`,
    );

    for (const evaluation of evaluations) {
      const result =
        evaluation.results.find(
          (item) =>
            item.questionId ===
            testCase.id,
        );

      if (!result) {
        continue;
      }

      console.log(
        ` ${evaluation.name.padEnd(22)}` +
          `@5=${printPercentage(
            result.recallAt5.recall,
          )} ` +
          `@10=${printPercentage(
            result.recallAt10.recall,
          )}`,
      );
    }
  }
}

/* ============================================================
 * GENERATION EVALUATION
 * ============================================================ */

interface GenerationEvaluation {
  questionId: string;
  response?: AskMyDocsResponse;
  error?: string;
  citationValid: boolean;
  faithfulness?: number;
  relevance?: number;
}

async function evaluateGeneration(
  agent: AskMyDocsAgent,
): Promise<GenerationEvaluation[]> {
  console.log(
    '\n==============================================',
  );

  console.log(
    'GENERATION EVALUATION',
  );

  console.log(
    '==============================================',
  );

  const results: GenerationEvaluation[] =
    [];

  for (const testCase of goldenDataset) {
    console.log(
      `\n\nTEST: ${testCase.id}`,
    );

    console.log(
      `Question: ${testCase.question}`,
    );

    try {
      const response =
        await agent.ask(
          testCase.question,
        );

      results.push({
        questionId: testCase.id,
        response,
        citationValid:
          response.citationValidation
            .valid,
        faithfulness:
          response.faithfulness?.score,
        relevance:
          response.relevance?.score,
      });

      console.log('\nAnswer:');

      console.log(
        response.answer,
      );

      console.log(
        `\nFaithfulness: ${
          response.faithfulness
            ? printPercentage(
                response.faithfulness
                  .score,
              )
            : 'N/A'
        }`,
      );

      console.log(
        `Relevance: ${
          response.relevance
            ? printPercentage(
                response.relevance
                  .score,
              )
            : 'N/A'
        }`,
      );

      console.log(
        `Citation validity: ${
          response
            .citationValidation
            .valid
            ? 'PASS'
            : 'FAIL'
        }`,
      );

      console.log(
        `Citations: ${
          response.citations.length
        }`,
      );

      console.log(
        `Sources: ${
          response.sources
            .map(
              (source) =>
                source.chunk.id,
            )
            .join(', ')
        }`,
      );

      if (response.relevance) {
        console.log(
          `Relevance explanation: ${
            response.relevance
              .explanation
          }`,
        );
      }

      if (
        !response.citationValidation
          .valid
      ) {
        console.log(
          '\nCitation validation failure:',
        );

        console.log(
          response.citationValidation,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      console.error(
        `\nERROR evaluating ${testCase.id}:`,
        message,
      );

      results.push({
        questionId: testCase.id,
        error: message,
        citationValid: false,
      });
    }
  }

  return results;
}

/* ============================================================
 * GENERATION SUMMARY
 * ============================================================ */

function buildGenerationQuestionResults(
  results: GenerationEvaluation[],
): GenerationQuestionResult[] {
  return results.map(
    (result) => {
      const faithfulness =
        result.faithfulness ?? 0;

      const relevance =
        result.relevance ?? 0;

      const citationValidity =
        result.citationValid
          ? 1
          : 0;

      const passed =
        result.error ===
          undefined &&
        faithfulness >=
          QUALITY_THRESHOLDS.faithfulness &&
        relevance >=
          QUALITY_THRESHOLDS.relevance &&
        citationValidity >=
          QUALITY_THRESHOLDS.citationValidity;

      return {
        questionId:
          result.questionId,
        faithfulness,
        relevance,
        citationValidity,
        passed,
      };
    },
  );
}

function printGenerationSummary(
  results: GenerationEvaluation[],
): void {
  console.log(
    '\n==============================================',
  );

  console.log(
    'GENERATION SUMMARY',
  );

  console.log(
    '==============================================',
  );

  const generationResults =
    buildGenerationQuestionResults(
      results,
    );

  const metrics =
    calculateGenerationMetrics(
      generationResults,
      QUALITY_THRESHOLDS,
    );

  const successful =
    results.filter(
      (result) =>
        result.response !==
        undefined,
    );

  const failed =
    results.filter(
      (result) =>
        result.error !==
        undefined,
    );

  console.log(
    `\nQuestions: ${results.length}`,
  );

  console.log(
    `Completed: ${successful.length}`,
  );

  console.log(
    `Errors: ${failed.length}`,
  );

  console.log(
    `Average Faithfulness: ${printPercentage(
      metrics.faithfulness,
    )}`,
  );

  console.log(
    `Average Relevance: ${printPercentage(
      metrics.relevance,
    )}`,
  );

  console.log(
    `Citation Validity: ${printPercentage(
      metrics.citationValidity,
    )}`,
  );

  console.log(
    `Generation PASS Rate: ${printPercentage(
      metrics.generationPassRate,
    )}`,
  );

  console.log(
    '\nPer-question result:',
  );

  console.log(
    '----------------------------------------------',
  );

  for (const result of metrics.results) {
    console.log(
      `${result.questionId.padEnd(12)}` +
        `Faithfulness=${printPercentage(
          result.faithfulness,
        ).padEnd(18)}` +
        `Relevance=${printPercentage(
          result.relevance,
        ).padEnd(15)}` +
        `Citation=${
          result.citationValidity ===
          1
            ? 'PASS'
            : 'FAIL'
        } ` +
        `${
          result.passed
            ? 'PASS'
            : 'FAIL'
        }`,
    );
  }
}

/* ============================================================
 * RETRIEVAL EVALUATION
 * ============================================================ */

async function evaluateRetrieval(): Promise<
  RetrievalStageEvaluation[]
> {
  const vectorRetriever =
    new VectorRetriever();

  const bm25Retriever =
    new BM25Retriever();

  const hybridRetriever =
    new HybridRetriever(
      vectorRetriever,
      bm25Retriever,
    );

  const reranker =
    new BGEReranker();

  /*
   * ------------------------------------------
   * Vector
   * ------------------------------------------
   */

  console.log(
    '\nEvaluating Vector...',
  );

  const vectorResults =
    new Map<
      string,
      RetrievalResult[]
    >();

  for (const testCase of goldenDataset) {
    const results =
      await vectorRetriever.retrieve(
        testCase.question,
      );

    vectorResults.set(
      testCase.id,
      results,
    );
  }

  /*
   * ------------------------------------------
   * BM25
   * ------------------------------------------
   */

  console.log(
    '\nEvaluating BM25...',
  );

  const bm25Results =
    new Map<
      string,
      RetrievalResult[]
    >();

  for (const testCase of goldenDataset) {
    const results =
      await bm25Retriever.retrieve(
        testCase.question,
      );

    bm25Results.set(
      testCase.id,
      results,
    );
  }

  /*
   * ------------------------------------------
   * Hybrid
   * ------------------------------------------
   */

  console.log(
    '\nEvaluating Hybrid...',
  );

  const hybridResults =
    new Map<
      string,
      RetrievalResult[]
    >();

  for (const testCase of goldenDataset) {
    const results =
      await hybridRetriever.retrieve(
        testCase.question,
      );

    hybridResults.set(
      testCase.id,
      results,
    );
  }

  /*
   * ------------------------------------------
   * Hybrid + Reranker
   * ------------------------------------------
   */

  console.log(
    '\nEvaluating Hybrid + Reranker...',
  );

  const rerankedResults =
    new Map<
      string,
      RetrievalResult[]
    >();

  for (const testCase of goldenDataset) {
    const hybrid =
      hybridResults.get(
        testCase.id,
      ) ?? [];

    const reranked =
      await reranker.rerank(
        testCase.question,
        hybrid,
        5,
      );

    rerankedResults.set(
      testCase.id,
      reranked,
    );
  }

  /*
   * ------------------------------------------
   * Calculate retrieval metrics
   * ------------------------------------------
   */

  return [
    evaluateRetrievalStage(
      goldenDataset,
      vectorResults,
      'Vector',
    ),

    evaluateRetrievalStage(
      goldenDataset,
      bm25Results,
      'BM25',
    ),

    evaluateRetrievalStage(
      goldenDataset,
      hybridResults,
      'Hybrid',
    ),

    evaluateRetrievalStage(
      goldenDataset,
      rerankedResults,
      'Hybrid + Reranker',
    ),
  ];
}

/* ============================================================
 * MAIN
 * ============================================================ */

async function main(): Promise<void> {
  /*
   * ------------------------------------------
   * 1. Retrieval evaluation
   * ------------------------------------------
   */

  const retrievalEvaluations =
    await evaluateRetrieval();

  printRetrievalSummary(
    retrievalEvaluations,
  );

  printPerQuestionRetrievalResults(
    retrievalEvaluations,
  );

  /*
   * ------------------------------------------
   * 2. Generation dependencies
   * ------------------------------------------
   */

  const vectorRetriever =
    new VectorRetriever();

  const bm25Retriever =
    new BM25Retriever();

  const hybridRetriever =
    new HybridRetriever(
      vectorRetriever,
      bm25Retriever,
    );

  const reranker =
    new BGEReranker();

  const llm =
    new OllamaClient();

  const faithfulnessEvaluator =
    new FaithfulnessEvaluator(
      llm,
    );

  const relevanceEvaluator =
    new AnswerRelevanceEvaluator(
      llm,
    );

  const agent =
    new AskMyDocsAgent(
      hybridRetriever,
      reranker,
      faithfulnessEvaluator,
      relevanceEvaluator,
      llm,
    );

  /*
   * ------------------------------------------
   * 3. Generation evaluation
   * ------------------------------------------
   */

  const generationResults =
    await evaluateGeneration(
      agent,
    );

  printGenerationSummary(
    generationResults,
  );

  /*
   * ------------------------------------------
   * 4. Build retrieval metrics
   * ------------------------------------------
   */

  const retrievalMetrics = {
    vectorRecallAt5:
      retrievalEvaluations.find(
        (evaluation) =>
          evaluation.name ===
          'Vector',
      )?.recallAt5 ?? 0,

    bm25RecallAt5:
      retrievalEvaluations.find(
        (evaluation) =>
          evaluation.name ===
          'BM25',
      )?.recallAt5 ?? 0,

    hybridRecallAt5:
      retrievalEvaluations.find(
        (evaluation) =>
          evaluation.name ===
          'Hybrid',
      )?.recallAt5 ?? 0,

    rerankedRecallAt5:
      retrievalEvaluations.find(
        (evaluation) =>
          evaluation.name ===
          'Hybrid + Reranker',
      )?.recallAt5 ?? 0,
  };

  /*
   * ------------------------------------------
   * 5. Build generation metrics
   * ------------------------------------------
   */

  const generationQuestionResults =
    buildGenerationQuestionResults(
      generationResults,
    );

  const generationMetrics =
    calculateGenerationMetrics(
      generationQuestionResults,
      QUALITY_THRESHOLDS,
    );

  /*
   * ------------------------------------------
   * 6. Evaluation Summary + Quality Gate
   * ------------------------------------------
   */

  const evaluationSummary =
    evaluateQualityGate(
      retrievalMetrics,
      generationMetrics,
      QUALITY_THRESHOLDS,
    );

  /*
   * ------------------------------------------
   * 7. Print final summary
   * ------------------------------------------
   */

  console.log(
    '\n==============================================',
  );

  console.log(
    'EVALUATION SUMMARY',
  );

  console.log(
    '==============================================',
  );

  console.log('\nRetrieval:');

  console.log(
    `Vector Recall@5:       ${printPercentage(
      evaluationSummary.retrieval
        .vectorRecallAt5,
    )}`,
  );

  console.log(
    `BM25 Recall@5:         ${printPercentage(
      evaluationSummary.retrieval
        .bm25RecallAt5,
    )}`,
  );

  console.log(
    `Hybrid Recall@5:       ${printPercentage(
      evaluationSummary.retrieval
        .hybridRecallAt5,
    )}`,
  );

  console.log(
    `Reranked Recall@5:     ${printPercentage(
      evaluationSummary.retrieval
        .rerankedRecallAt5,
    )}`,
  );

  console.log('\nGeneration:');

  console.log(
    `Faithfulness:          ${printPercentage(
      evaluationSummary.generation
        .faithfulness,
    )}`,
  );

  console.log(
    `Answer Relevance:      ${printPercentage(
      evaluationSummary.generation
        .relevance,
    )}`,
  );

  console.log(
    `Citation Validity:     ${printPercentage(
      evaluationSummary.generation
        .citationValidity,
    )}`,
  );

  console.log(
    `Generation Pass Rate:  ${printPercentage(
      evaluationSummary.generation
        .generationPassRate,
    )}`,
  );

  /*
   * ------------------------------------------
   * 8. Quality Gate
   * ------------------------------------------
   */

  console.log(
    '\n==============================================',
  );

  console.log(
    'QUALITY GATE',
  );

  console.log(
    '==============================================',
  );

  console.log(
    '\nMetric'.padEnd(26) +
      'Actual'.padEnd(12) +
      'Threshold'.padEnd(12) +
      'Result',
  );

  console.log(
    '----------------------------------------------',
  );

  for (const result of evaluationSummary
    .qualityGate.results) {
    console.log(
      `${result.metric.padEnd(26)}` +
        `${printPercentage(
          result.actual,
        ).padEnd(12)}` +
        `${printPercentage(
          result.threshold,
        ).padEnd(12)}` +
        `${
          result.passed
            ? 'PASS'
            : 'FAIL'
        }`,
    );
  }

  console.log(
    '\n==============================================',
  );

  console.log(
    evaluationSummary.qualityGate
      .passed
      ? 'QUALITY GATE: PASS'
      : 'QUALITY GATE: FAIL',
  );

  console.log(
    '==============================================',
  );

  /*
   * IMPORTANT:
   *
   * We are NOT setting process.exitCode = 1
   * yet. Thresholds are still provisional.
   *
   * Once we inspect the 15-question results
   * and finalize the thresholds, we will
   * enable CI failure here.
   */
}

/* ============================================================
 * PROCESS LIFECYCLE
 * ============================================================ */

main()
  .catch((error) => {
    console.error(
      '\nEvaluation failed:',
    );

    console.error(error);

    process.exitCode = 1;
  })
  .finally(async () => {
    await sdk.shutdown();
  });

