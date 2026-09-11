import { VectorRetriever } from '../src/retrieval/vector.retriever.js';
import { BM25Retriever } from '../src/retrieval/bm25.retriever.js';
import { HybridRetriever } from '../src/retrieval/hybrid.retriever.js';

import { BGEReranker } from '../src/reranking/bge-reranker.js';

import { OllamaClient } from '../src/llm/ollama.client.js';

import {
  FaithfulnessEvaluator,
} from '../src/evaluation/faithfulness/faithfulness-evaluator.js';

import {
  AnswerRelevanceEvaluator,
} from '../src/evaluation/relevance/answer-relevance-evaluator.js';

import {
  evaluateRetrievalStage,
} from '../src/evaluation/retrieval/retrieval-evaluator.js';

import {
  goldenDataset,
} from '../src/evaluation/datasets/golden-dataset.js';

import type {
  RetrievalResult,
} from '../src/types/retrieval.js';

import {
  AskMyDocsAgent,
} from '../src/agent/ask-my-docs.agent.js';

import {
  calculateGenerationMetrics,
  evaluateQualityGate,
  type GenerationQuestionResult,
  type QualityThresholds,
} from '../src/evaluation/evaluation-summary.js';

import {
  sdk,
} from '../src/instrumentation.js';


const QUALITY_THRESHOLDS:
  QualityThresholds = {
    rerankedRecallAt5: 0.80,
    faithfulness: 0.90,
    relevance: 0.80,
    citationValidity: 1.00,
    generationPassRate: 0.80,
  };


async function evaluateGeneration(
  agent: AskMyDocsAgent,
): Promise<{
  results: GenerationQuestionResult[];
  retrievalResults: {
    vector: Map<string, RetrievalResult[]>;
    bm25: Map<string, RetrievalResult[]>;
    hybrid: Map<string, RetrievalResult[]>;
    reranked: Map<string, RetrievalResult[]>;
  };
}> {
  const generationResults:
    GenerationQuestionResult[] = [];

  const vector =
    new Map<string, RetrievalResult[]>();

  const bm25 =
    new Map<string, RetrievalResult[]>();

  const hybrid =
    new Map<string, RetrievalResult[]>();

  const reranked =
    new Map<string, RetrievalResult[]>();


  for (const testCase of goldenDataset) {
    console.log(
      `\nEvaluating ${testCase.id}: ${testCase.question}`,
    );

    try {
      const result =
        await agent.ask(
          testCase.question,
        );

      /*
       * Store retrieval stages produced
       * by this SAME execution.
       */
      if (result.retrieval) {
        vector.set(
          testCase.id,
          result.retrieval.vector,
        );

        bm25.set(
          testCase.id,
          result.retrieval.bm25,
        );

        hybrid.set(
          testCase.id,
          result.retrieval.hybrid,
        );

        reranked.set(
          testCase.id,
          result.retrieval.reranked,
        );
      }


      const faithfulness =
        result.faithfulness?.score ??
        0;

      const relevance =
        result.relevance?.score ??
        0;

      const citationValidity =
        result.citationValidation.valid
          ? 1
          : 0;


      const passed =
        faithfulness >=
          QUALITY_THRESHOLDS
            .faithfulness &&
        relevance >=
          QUALITY_THRESHOLDS
            .relevance &&
        citationValidity >=
          QUALITY_THRESHOLDS
            .citationValidity;


      generationResults.push({
        questionId:
          testCase.id,

        faithfulness,

        relevance,

        citationValidity,

        passed,
      });


      console.log(
        `Faithfulness: ${faithfulness.toFixed(2)}`,
      );

      console.log(
        `Relevance: ${relevance.toFixed(2)}`,
      );

      console.log(
        `Citation validity: ${citationValidity.toFixed(2)}`,
      );

      console.log(
        `Generation: ${passed ? 'PASS' : 'FAIL'}`,
      );
    } catch (error) {
      console.error(
        `Evaluation failed for ${testCase.id}`,
      );

      console.error(error);

      generationResults.push({
        questionId:
          testCase.id,

        faithfulness: 0,

        relevance: 0,

        citationValidity: 0,

        passed: false,
      });
    }
  }


  return {
    results:
      generationResults,

    retrievalResults: {
      vector,
      bm25,
      hybrid,
      reranked,
    },
  };
}


async function main(): Promise<void> {
  /*
   * --------------------------------------------------
   * Build the RAG system
   * --------------------------------------------------
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

  const faithfulnessEvaluator =
    new FaithfulnessEvaluator();

  const relevanceEvaluator =
    new AnswerRelevanceEvaluator();

  const agent =
    new AskMyDocsAgent(
      hybridRetriever,
      reranker,
      faithfulnessEvaluator,
      relevanceEvaluator,
    );


  /*
   * --------------------------------------------------
   * One execution per question
   * --------------------------------------------------
   */

  const {
    results:
      generationResults,

    retrievalResults,
  } =
    await evaluateGeneration(
      agent,
    );


  /*
   * --------------------------------------------------
   * Retrieval evaluation
   * --------------------------------------------------
   */

  const vectorEvaluation =
    evaluateRetrievalStage(
      goldenDataset,
      retrievalResults.vector,
      'Vector',
    );

  const bm25Evaluation =
    evaluateRetrievalStage(
      goldenDataset,
      retrievalResults.bm25,
      'BM25',
    );

  const hybridEvaluation =
    evaluateRetrievalStage(
      goldenDataset,
      retrievalResults.hybrid,
      'Hybrid',
    );

  const rerankedEvaluation =
    evaluateRetrievalStage(
      goldenDataset,
      retrievalResults.reranked,
      'Hybrid + Reranker',
    );


  /*
   * --------------------------------------------------
   * Generation summary
   * --------------------------------------------------
   */

  const generationMetrics =
    calculateGenerationMetrics(
      generationResults,
      {
        faithfulness:
          QUALITY_THRESHOLDS
            .faithfulness,

        relevance:
          QUALITY_THRESHOLDS
            .relevance,

        citationValidity:
          QUALITY_THRESHOLDS
            .citationValidity,
      },
    );


  /*
   * --------------------------------------------------
   * Overall metrics
   * --------------------------------------------------
   */

  const retrievalMetrics = {
    vectorRecallAt5:
      vectorEvaluation.recallAt5,

    bm25RecallAt5:
      bm25Evaluation.recallAt5,

    hybridRecallAt5:
      hybridEvaluation.recallAt5,

    rerankedRecallAt5:
      rerankedEvaluation.recallAt5,
  };


  /*
   * --------------------------------------------------
   * Quality gate
   * --------------------------------------------------
   */

  const summary =
    evaluateQualityGate(
      retrievalMetrics,
      generationMetrics,
      QUALITY_THRESHOLDS,
    );


  /*
   * --------------------------------------------------
   * Print final report
   * --------------------------------------------------
   */

  console.log(
    '\n========================================',
  );

  console.log(
    '          EVALUATION SUMMARY',
  );

  console.log(
    '========================================\n',
  );


  console.log(
    'Retrieval',
  );

  console.log(
    `Vector Recall@5:       ${(retrievalMetrics.vectorRecallAt5 * 100).toFixed(1)}%`,
  );

  console.log(
    `BM25 Recall@5:         ${(retrievalMetrics.bm25RecallAt5 * 100).toFixed(1)}%`,
  );

  console.log(
    `Hybrid Recall@5:       ${(retrievalMetrics.hybridRecallAt5 * 100).toFixed(1)}%`,
  );

  console.log(
    `Reranked Recall@5:     ${(retrievalMetrics.rerankedRecallAt5 * 100).toFixed(1)}%`,
  );


  console.log(
    '\nGeneration',
  );

  console.log(
    `Faithfulness:          ${(generationMetrics.faithfulness * 100).toFixed(1)}%`,
  );

  console.log(
    `Answer Relevance:      ${(generationMetrics.relevance * 100).toFixed(1)}%`,
  );

  console.log(
    `Citation Validity:     ${(generationMetrics.citationValidity * 100).toFixed(1)}%`,
  );

  console.log(
    `Generation Pass Rate:  ${(generationMetrics.generationPassRate * 100).toFixed(1)}%`,
  );


  console.log(
    '\nQuality Gate',
  );


  for (
    const gate of
      summary.qualityGate.results
  ) {
    console.log(
      `${gate.passed ? 'PASS' : 'FAIL'}  ${gate.metric}: ${(gate.actual * 100).toFixed(1)}% >= ${(gate.threshold * 100).toFixed(1)}%`,
    );
  }


  console.log(
    `\nOVERALL: ${
      summary.qualityGate.passed
        ? 'PASS'
        : 'FAIL'
    }`,
  );


  /*
   * IMPORTANT:
   *
   * We are NOT failing the process yet
   * when the quality gate fails.
   *
   * Thresholds are still provisional.
   */
}


main()
  .catch((error) => {
    console.error(
      '\nEvaluation failed:',
    );

    console.error(error);

    //process.exitCode = 1;
  })
  .finally(
    async () => {
      await sdk.shutdown();
    },
  );