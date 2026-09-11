import { VectorRetriever } from '../src/retrieval/vector.retriever.js';
import { BM25Retriever } from '../src/retrieval/bm25.retriever.js';
import { HybridRetriever } from '../src/retrieval/hybrid.retriever.js';
import { BGEReranker } from '../src/reranking/bge-reranker.js';
import { FaithfulnessEvaluator } from '../src/evaluation/faithfulness/faithfulness-evaluator.js';
import { AnswerRelevanceEvaluator } from '../src/evaluation/relevance/answer-relevance-evaluator.js';
import { evaluateRetrievalStage } from '../src/evaluation/retrieval/retrieval-evaluator.js';
import { goldenDataset } from '../src/evaluation/datasets/golden-dataset.js';
import type { RetrievalResult } from '../src/types/retrieval.js';
import { AskMyDocsAgent } from '../src/agent/ask-my-docs.agent.js';
import {
  calculateGenerationMetrics,
  evaluateQualityGate,
  formatEvaluationConsoleReport,
  saveEvaluationJson,
  DEFAULT_QUALITY_THRESHOLDS,
  type GenerationQuestionResult,
  type QualityThresholds,
} from '../src/evaluation/evaluation-summary.js';
import { sdk } from '../src/instrumentation.js';

const QUALITY_THRESHOLDS: QualityThresholds = DEFAULT_QUALITY_THRESHOLDS;

interface CliOptions {
  jsonPath?: string;
  enforceGate: boolean;
}

function parseCliArgs(): CliOptions {
  const args = process.argv.slice(2);
  let jsonPath: string | undefined;
  let enforceGate = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--json') {
      jsonPath = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : 'evaluation-summary.json';
    } else if (arg.startsWith('--json=')) {
      jsonPath = arg.split('=')[1] || 'evaluation-summary.json';
    } else if (arg === '--ci' || arg === '--enforce') {
      enforceGate = true;
    }
  }

  return { jsonPath, enforceGate };
}

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
  const generationResults: GenerationQuestionResult[] = [];
  const vector = new Map<string, RetrievalResult[]>();
  const bm25 = new Map<string, RetrievalResult[]>();
  const hybrid = new Map<string, RetrievalResult[]>();
  const reranked = new Map<string, RetrievalResult[]>();

  for (const testCase of goldenDataset) {
    console.log(`\nEvaluating [${testCase.id}]: ${testCase.question}`);

    try {
      const result = await agent.ask(testCase.question);

      if (result.retrieval) {
        vector.set(testCase.id, result.retrieval.vector);
        bm25.set(testCase.id, result.retrieval.bm25);
        hybrid.set(testCase.id, result.retrieval.hybrid);
        reranked.set(testCase.id, result.retrieval.reranked);
      }

      const faithfulness = result.faithfulness?.score ?? 0;
      const relevance = result.relevance?.score ?? 0;
      const citationValidity = result.citationValidation.valid ? 1 : 0;

      const passed =
        faithfulness >= QUALITY_THRESHOLDS.faithfulness &&
        relevance >= QUALITY_THRESHOLDS.relevance &&
        citationValidity >= QUALITY_THRESHOLDS.citationValidity;

      generationResults.push({
        questionId: testCase.id,
        faithfulness,
        relevance,
        citationValidity,
        passed,
      });

      console.log(`  Faithfulness:      ${(faithfulness * 100).toFixed(1)}%`);
      console.log(`  Answer Relevance:  ${(relevance * 100).toFixed(1)}%`);
      console.log(`  Citation Validity: ${(citationValidity * 100).toFixed(1)}%`);
      console.log(`  Generation Status: ${passed ? '✓ PASS' : '✗ FAIL'}`);
    } catch (error) {
      console.error(`  Evaluation error for ${testCase.id}:`, error);

      generationResults.push({
        questionId: testCase.id,
        faithfulness: 0,
        relevance: 0,
        citationValidity: 0,
        passed: false,
      });
    }
  }

  return {
    results: generationResults,
    retrievalResults: {
      vector,
      bm25,
      hybrid,
      reranked,
    },
  };
}

async function main(): Promise<void> {
  const options = parseCliArgs();

  /*
   * 1. Build the RAG system
   */
  const vectorRetriever = new VectorRetriever();
  const bm25Retriever = new BM25Retriever();
  const hybridRetriever = new HybridRetriever(vectorRetriever, bm25Retriever);
  const reranker = new BGEReranker();
  const faithfulnessEvaluator = new FaithfulnessEvaluator();
  const relevanceEvaluator = new AnswerRelevanceEvaluator();

  const agent = new AskMyDocsAgent(
    hybridRetriever,
    reranker,
    faithfulnessEvaluator,
    relevanceEvaluator,
  );

  /*
   * 2. Run evaluation
   */
  const { results: generationResults, retrievalResults } = await evaluateGeneration(agent);

  /*
   * 3. Retrieval evaluation stages
   */
  const vectorEvaluation = evaluateRetrievalStage(goldenDataset, retrievalResults.vector, 'Vector');
  const bm25Evaluation = evaluateRetrievalStage(goldenDataset, retrievalResults.bm25, 'BM25');
  const hybridEvaluation = evaluateRetrievalStage(goldenDataset, retrievalResults.hybrid, 'Hybrid');
  const rerankedEvaluation = evaluateRetrievalStage(
    goldenDataset,
    retrievalResults.reranked,
    'Hybrid + Reranker',
  );

  /*
   * 4. Aggregate metrics & quality gate
   */
  const generationMetrics = calculateGenerationMetrics(generationResults, QUALITY_THRESHOLDS);

  const retrievalMetrics = {
    vectorRecallAt5: vectorEvaluation.recallAt5,
    bm25RecallAt5: bm25Evaluation.recallAt5,
    hybridRecallAt5: hybridEvaluation.recallAt5,
    rerankedRecallAt5: rerankedEvaluation.recallAt5,
  };

  const summary = evaluateQualityGate(
    retrievalMetrics,
    generationMetrics,
    QUALITY_THRESHOLDS,
    !options.enforceGate, // provisional if not enforced
  );

  /*
   * 5. Print canonical console report
   */
  const report = formatEvaluationConsoleReport(summary);
  console.log(report);

  /*
   * 6. Save JSON artifact if requested
   */
  if (options.jsonPath) {
    await saveEvaluationJson(summary, options.jsonPath);
    console.log(`\nMachine-readable evaluation artifact saved to: ${options.jsonPath}`);
  }

  /*
   * 7. Exit code handling for CI
   */
  if (options.enforceGate && !summary.qualityGate.passed) {
    console.error('\nQuality gate failed under strict CI enforcement.');
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error('\nEvaluation runner encountered a fatal error:');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sdk.shutdown();
  });