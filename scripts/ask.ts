import { BM25Retriever } from '../src/retrieval/bm25.retriever.js';

import { HybridRetriever } from '../src/retrieval/hybrid.retriever.js';

import { VectorRetriever } from '../src/retrieval/vector.retriever.js';

import { BGEReranker } from '../src/reranking/bge-reranker.js';

import { OllamaClient } from '../src/llm/ollama.client.js';

import { FaithfulnessEvaluator } from '../src/evaluation/faithfulness/faithfulness-evaluator.js';

import { AnswerRelevanceEvaluator } from '../src/evaluation/relevance/answer-relevance-evaluator.js';

import { AskMyDocsAgent } from '../src/agent/ask-my-docs.agent.js';

const query = process.argv.slice(2).join(' ');

if (!query.trim()) {
  console.error('Usage: npx tsx scripts/ask.ts "your question"');

  process.exit(1);
}

// ----------------------------------------
// RETRIEVERS
// ----------------------------------------

const vectorRetriever = new VectorRetriever();

const bm25Retriever = new BM25Retriever();

const retriever = new HybridRetriever(vectorRetriever, bm25Retriever);

// ----------------------------------------
// RERANKER
// ----------------------------------------

const reranker = new BGEReranker();

// ----------------------------------------
// LLM
// ----------------------------------------

const llm = new OllamaClient();

// ----------------------------------------
// EVALUATORS
// ----------------------------------------

const faithfulnessEvaluator = new FaithfulnessEvaluator(llm);

const relevanceEvaluator = new AnswerRelevanceEvaluator(llm);

// ----------------------------------------
// AGENT
// ----------------------------------------

const agent = new AskMyDocsAgent(
  retriever,
  reranker,
  faithfulnessEvaluator,
  relevanceEvaluator,
  llm,
);

// ----------------------------------------
// ASK
// ----------------------------------------

const response = await agent.ask(query);

// ----------------------------------------
// ANSWER
// ----------------------------------------

console.log('\nANSWER\n');

console.log(response.answer);

// ----------------------------------------
// SOURCES
// ----------------------------------------

console.log('\nSOURCES\n');

response.sources.forEach((source, index) => {
  console.log(`[SOURCE_${index + 1}] ${source.chunk.id}`);

  console.log(`Document: ${source.chunk.documentId}`);

  console.log(`Pages: ${source.chunk.pageNumbers.join(', ')}`);

  if (source.rerankScore !== undefined) {
    console.log(`Rerank: ${source.rerankScore.toFixed(4)}`);
  }

  if (source.rrfScore !== undefined) {
    console.log(`RRF: ${source.rrfScore.toFixed(6)}`);
  }

  console.log();
});

// ----------------------------------------
// CITATIONS
// ----------------------------------------

console.log('\nCITATIONS\n');

console.log(response.citations.length > 0 ? response.citations.join(', ') : 'None');

// ----------------------------------------
// FAITHFULNESS
// ----------------------------------------

console.log('\nFAITHFULNESS\n');

if (!response.faithfulness) {
  console.log('Faithfulness evaluation not available.');
} else {
  const { score, claims } = response.faithfulness;

  console.log(`Score: ${(score * 100).toFixed(1)}%\n`);

  claims.forEach((claim, index) => {
    console.log(`Claim ${index + 1}`);

    console.log(`Claim: ${claim.claim}`);

    console.log(`Citations: ${claim.citations.join(', ')}`);

    console.log(`Supported: ${claim.supported}`);

    console.log(`Explanation: ${claim.explanation}`);

    console.log();
  });
}

// ----------------------------------------
// ANSWER RELEVANCE
// ----------------------------------------

console.log('\nANSWER RELEVANCE\n');

if (!response.relevance) {
  console.log('Answer relevance evaluation not available.');
} else {
  console.log(`Score: ${(response.relevance.score * 100).toFixed(1)}%\n`);

  console.log(`Explanation: ${response.relevance.explanation}`);
}
