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
import { goldenDataset } from '../src/evaluation/datasets/golden-dataset.js';
import type { RetrievalResult } from '../src/types/retrieval.js';
import { AskMyDocsAgent, type AskMyDocsResponse } from '../src/agent/ask-my-docs.agent.js';
/* * ============================================================ * HELPERS * ============================================================ */ function printPercentage(
  value: number,
): string {
  return `${(value * 100).toFixed(1)}%`;
}
function printRetrievalSummary(evaluations: RetrievalStageEvaluation[]): void {
  console.log('\n==============================================');
  console.log('RETRIEVAL EVALUATION');
  console.log('==============================================');
  console.log(`Dataset: ${goldenDataset.length} questions`);
  console.log('\nSummary\n');
  console.log('Stage Recall@5 Recall@10');
  console.log('----------------------------------------------');
  for (const evaluation of evaluations) {
    console.log(
      `${evaluation.name.padEnd(22)}` +
        `${printPercentage(evaluation.recallAt5).padEnd(12)}` +
        `${printPercentage(evaluation.recallAt10)}`,
    );
  }
}
function printPerQuestionRetrievalResults(evaluations: RetrievalStageEvaluation[]): void {
  console.log('\n==============================================');
  console.log('PER-QUESTION RETRIEVAL RESULTS');
  console.log('==============================================');
  for (const testCase of goldenDataset) {
    console.log(`\n${testCase.id}: ${testCase.question}`);
    console.log(`Expected: ${testCase.expectedSourceIds.join(', ')}`);
    for (const evaluation of evaluations) {
      const result = evaluation.results.find((item) => item.questionId === testCase.id);
      if (!result) {
        continue;
      }
      console.log(
        ` ${evaluation.name.padEnd(22)}` +
          `@5=${printPercentage(result.recallAt5.recall)} ` +
          `@10=${printPercentage(result.recallAt10.recall)}`,
      );
    }
  }
}
/* * ============================================================ * GENERATION EVALUATION * ============================================================ */ interface GenerationEvaluation {
  questionId: string;
  response?: AskMyDocsResponse;
  error?: string;
  citationValid: boolean;
  faithfulness?: number;
  relevance?: number;
}
async function evaluateGeneration(agent: AskMyDocsAgent): Promise<GenerationEvaluation[]> {
  console.log('\n==============================================');
  console.log('GENERATION EVALUATION');
  console.log('==============================================');
  const results: GenerationEvaluation[] = [];
  for (const testCase of goldenDataset) {
    console.log(`\n\nTEST: ${testCase.id}`);
    console.log(`Question: ${testCase.question}`);
    try {
      const response = await agent.ask(testCase.question);
      results.push({
        questionId: testCase.id,
        response,
        citationValid: response.citationValidation.valid,
        faithfulness: response.faithfulness?.score,
        relevance: response.relevance?.score,
      });
      console.log('\nAnswer:');
      console.log(response.answer);
      console.log(
        `\nFaithfulness: ${response.faithfulness ? printPercentage(response.faithfulness.score) : 'N/A'}`,
      );
      console.log(
        `Relevance: ${response.relevance ? printPercentage(response.relevance.score) : 'N/A'}`,
      );
      console.log(`Citation validity: ${response.citationValidation.valid ? 'PASS' : 'FAIL'}`);
      console.log(`Citations: ${response.citations.length}`);
      console.log(`Sources: ${response.sources.map((source) => source.chunk.id).join(', ')}`);
      if (response.relevance) {
        console.log(`Relevance explanation: ${response.relevance.explanation}`);
      }
      /* * Citation failure is a test failure, * but not a program failure. */ if (
        !response.citationValidation.valid
      ) {
        console.log('\nCitation validation failure:');
        console.log(response.citationValidation);
      }
    } catch (error) {
      /* * Unexpected errors should also not stop * the remaining dataset from running. */ const message =
        error instanceof Error ? error.message : String(error);
      console.error(`\nERROR evaluating ${testCase.id}:`, message);
      results.push({ questionId: testCase.id, error: message, citationValid: false });
    }
  }
  return results;
}
function printGenerationSummary(results: GenerationEvaluation[]): void {
  console.log('\n==============================================');
  console.log('GENERATION SUMMARY');
  console.log('==============================================');
  const successful = results.filter((result) => result.response !== undefined);
  const failed = results.filter((result) => result.error !== undefined);
  const citationPassed = results.filter((result) => result.citationValid);
  const faithfulnessResults = successful.filter((result) => result.faithfulness !== undefined);
  const relevanceResults = successful.filter((result) => result.relevance !== undefined);
  const averageFaithfulness =
    faithfulnessResults.length === 0
      ? 0
      : faithfulnessResults.reduce((sum, result) => sum + (result.faithfulness ?? 0), 0) /
        faithfulnessResults.length;
  const averageRelevance =
    relevanceResults.length === 0
      ? 0
      : relevanceResults.reduce((sum, result) => sum + (result.relevance ?? 0), 0) /
        relevanceResults.length;
  const citationValidity = results.length === 0 ? 0 : citationPassed.length / results.length;
  const generationPassCount = results.filter(
    (result) =>
      result.error === undefined &&
      result.citationValid &&
      (result.faithfulness ?? 0) >= 0.9 &&
      (result.relevance ?? 0) >= 0.75,
  ).length;
  const generationPassRate = results.length === 0 ? 0 : generationPassCount / results.length;
  console.log(`\nQuestions: ${results.length}`);
  console.log(`Completed: ${successful.length}`);
  console.log(`Errors: ${failed.length}`);
  console.log(`Average Faithfulness: ${printPercentage(averageFaithfulness)}`);
  console.log(`Average Relevance: ${printPercentage(averageRelevance)}`);
  console.log(`Citation Validity: ${printPercentage(citationValidity)}`);
  console.log(
    `Generation PASS: ${generationPassCount}/${results.length} (${printPercentage(generationPassRate)})`,
  );
  console.log('\nPer-question result:');
  console.log('----------------------------------------------');
  for (const result of results) {
    if (result.error) {
      console.log(`${result.questionId.padEnd(12)} ERROR`);
      continue;
    }
    console.log(
      `${result.questionId.padEnd(12)}` +
        `Faithfulness=${printPercentage(result.faithfulness ?? 0).padEnd(18)}` +
        `Relevance=${printPercentage(result.relevance ?? 0).padEnd(15)}` +
        `Citation=${result.citationValid ? 'PASS' : 'FAIL'}`,
    );
  }
}
/* * ============================================================ * RETRIEVAL * ============================================================ */ async function evaluateRetrieval(): Promise<
  RetrievalStageEvaluation[]
> {
  const vectorRetriever = new VectorRetriever();
  const bm25Retriever = new BM25Retriever();
  const hybridRetriever = new HybridRetriever(vectorRetriever, bm25Retriever);
  const reranker = new BGEReranker();
  /* * ------------------------------------------ * Vector * ------------------------------------------ */ console.log(
    '\nEvaluating Vector...',
  );
  const vectorResults = new Map<string, RetrievalResult[]>();
  for (const testCase of goldenDataset) {
    const results = await vectorRetriever.retrieve(testCase.question);
    vectorResults.set(testCase.id, results);
  }
  /* * ------------------------------------------ * BM25 * ------------------------------------------ */ console.log(
    '\nEvaluating BM25...',
  );
  const bm25Results = new Map<string, RetrievalResult[]>();
  for (const testCase of goldenDataset) {
    const results = await bm25Retriever.retrieve(testCase.question);
    bm25Results.set(testCase.id, results);
  }
  /* * ------------------------------------------ * Hybrid * ------------------------------------------ */ console.log(
    '\nEvaluating Hybrid...',
  );
  const hybridResults = new Map<string, RetrievalResult[]>();
  for (const testCase of goldenDataset) {
    const results = await hybridRetriever.retrieve(testCase.question);
    hybridResults.set(testCase.id, results);
  }
  /* * ------------------------------------------ * Hybrid + Reranker * ------------------------------------------ */ console.log(
    '\nEvaluating Hybrid + Reranker...',
  );
  const rerankedResults = new Map<string, RetrievalResult[]>();
  for (const testCase of goldenDataset) {
    const hybrid = hybridResults.get(testCase.id) ?? [];
    const reranked = await reranker.rerank(testCase.question, hybrid, 5);
    rerankedResults.set(testCase.id, reranked);
  }
  /* * ------------------------------------------ * Calculate metrics * ------------------------------------------ */ return [
    evaluateRetrievalStage(goldenDataset, vectorResults, 'Vector'),
    evaluateRetrievalStage(goldenDataset, bm25Results, 'BM25'),
    evaluateRetrievalStage(goldenDataset, hybridResults, 'Hybrid'),
    evaluateRetrievalStage(goldenDataset, rerankedResults, 'Hybrid + Reranker'),
  ];
}
/* * ============================================================ * MAIN * ============================================================ */ async function main(): Promise<void> {
  /* * Retrieval evaluation. */ const retrievalEvaluations = await evaluateRetrieval();
  printRetrievalSummary(retrievalEvaluations);
  printPerQuestionRetrievalResults(retrievalEvaluations);
  /* * Generation dependencies. */ const vectorRetriever = new VectorRetriever();
  const bm25Retriever = new BM25Retriever();
  const hybridRetriever = new HybridRetriever(vectorRetriever, bm25Retriever);
  const reranker = new BGEReranker();
  const llm = new OllamaClient();
  const faithfulnessEvaluator = new FaithfulnessEvaluator(llm);
  const relevanceEvaluator = new AnswerRelevanceEvaluator(llm);
  const agent = new AskMyDocsAgent(
    hybridRetriever,
    reranker,
    faithfulnessEvaluator,
    relevanceEvaluator,
    llm,
  );
  /* * Generation evaluation. */ const generationResults = await evaluateGeneration(agent);
  printGenerationSummary(generationResults);
}
main().catch((error) => {
  console.error('\nEvaluation failed:');
  console.error(error);
  process.exitCode = 1;
});
