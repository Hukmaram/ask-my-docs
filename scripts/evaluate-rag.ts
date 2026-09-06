import { BM25Retriever } from '../src/retrieval/bm25.retriever.js';
import { HybridRetriever } from '../src/retrieval/hybrid.retriever.js';
import { VectorRetriever } from '../src/retrieval/vector.retriever.js';

import { BGEReranker } from '../src/reranking/bge-reranker.js';

import { OllamaClient } from '../src/llm/ollama.client.js';

import { FaithfulnessEvaluator } from '../src/evaluation/faithfulness/faithfulness-evaluator.js';

import { AskMyDocsAgent } from '../src/agent/ask-my-docs.agent.js';



import {
  evaluateRetrieval,
} from '../src/evaluation/retrieval/retrieval-evaluator.js';

import type { RetrievalResult } from '../src/types/retrieval.js';
import { goldenDataset } from '../src/evaluation/datasets/golden-dataset.js';

// ----------------------------------------
// RAG components
// ----------------------------------------

const vectorRetriever = new VectorRetriever();

const bm25Retriever = new BM25Retriever();

const retriever = new HybridRetriever(
  vectorRetriever,
  bm25Retriever,
);

const reranker = new BGEReranker();

const llm = new OllamaClient();

const faithfulnessEvaluator =
  new FaithfulnessEvaluator(llm);

const agent = new AskMyDocsAgent(
  retriever,
  reranker,
  faithfulnessEvaluator,
  llm,
);

// ----------------------------------------
// Retrieval results for evaluation
// ----------------------------------------

const retrievalResults = new Map<
  string,
  RetrievalResult[]
>();

// ----------------------------------------
// Run golden dataset
// ----------------------------------------

for (const testCase of goldenDataset) {
  console.log('\n========================================');
  console.log(`TEST: ${testCase.id}`);
  console.log('========================================');

  console.log(
    `\nQuestion:\n${testCase.question}`,
  );

  // --------------------------------------
  // 1. Retrieve
  // --------------------------------------

  const retrieved =
    await retriever.retrieve(
      testCase.question,
    );

  retrievalResults.set(
    testCase.id,
    retrieved,
  );

  // --------------------------------------
  // Retrieval details
  // --------------------------------------

  const expectedSourceIds =
    testCase.expectedSourceIds;

  const top5 = retrieved.slice(0, 5);
  const top10 = retrieved.slice(0, 10);

  const recallAt5 =
    expectedSourceIds.some((expectedId) =>
      top5.some(
        (result) =>
          result.chunk.id === expectedId,
      ),
    );

  const recallAt10 =
    expectedSourceIds.some((expectedId) =>
      top10.some(
        (result) =>
          result.chunk.id === expectedId,
      ),
    );

  console.log('\nRetrieval');

  console.log(
    `Expected sources: ${expectedSourceIds.join(', ')}`,
  );

  console.log(
    `Recall@5: ${recallAt5 ? 'PASS' : 'FAIL'}`,
  );

  console.log(
    `Recall@10: ${recallAt10 ? 'PASS' : 'FAIL'}`,
  );

  console.log(
    '\nTop retrieved chunks:',
  );

  retrieved
    .slice(0, 10)
    .forEach((result, index) => {
      const isExpected =
        expectedSourceIds.includes(
          result.chunk.id,
        );

      console.log(
        `${index + 1}. ${result.chunk.id}${
          isExpected ? '  <-- EXPECTED' : ''
        }`,
      );
    });

  // --------------------------------------
  // 2. Run complete RAG pipeline
  // --------------------------------------

  const response =
    await agent.ask(
      testCase.question,
    );

  // --------------------------------------
  // 3. Answer
  // --------------------------------------

  console.log('\nAnswer:');

  console.log(response.answer);

  // --------------------------------------
  // 4. Faithfulness
  // --------------------------------------

  console.log('\nFaithfulness:');

  if (!response.faithfulness) {
    console.log('N/A');
  } else {
    console.log(
      `${(
        response.faithfulness.score * 100
      ).toFixed(1)}%`,
    );
  }

  // --------------------------------------
  // 5. Citations
  // --------------------------------------

  console.log('\nCitations:');

  console.log(
    response.citations.length > 0
      ? response.citations.join(', ')
      : 'None',
  );

  // --------------------------------------
  // 6. Sources used for final answer
  // --------------------------------------

  console.log(
    '\nSources used for answer:',
  );

  response.sources.forEach(
    (source, index) => {
      console.log(
        `${index + 1}. ${source.chunk.id}`,
      );
    },
  );
}

// ----------------------------------------
// Aggregate retrieval evaluation
// ----------------------------------------

const retrievalEvaluation =
  evaluateRetrieval(
    goldenDataset,
    retrievalResults,
  );

// ----------------------------------------
// Final evaluation summary
// ----------------------------------------

console.log('\n========================================');
console.log('RAG EVALUATION');
console.log('========================================');

console.log(
  `Dataset: ${retrievalEvaluation.totalQuestions} questions`,
);

console.log('\nRetrieval');

console.log(
  `Recall@5: ${(
    retrievalEvaluation.recallAt5 * 100
  ).toFixed(1)}%`,
);

console.log(
  `Recall@10: ${(
    retrievalEvaluation.recallAt10 * 100
  ).toFixed(1)}%`,
);

console.log('\nPer-question results');

for (const result of retrievalEvaluation.results) {
  console.log(
    `${result.questionId} | ` +
      `Recall@5: ${(
        result.recallAt5.recall * 100
      ).toFixed(1)}% | ` +
      `Recall@10: ${(
        result.recallAt10.recall * 100
      ).toFixed(1)}%`,
  );
}

console.log('\n========================================');