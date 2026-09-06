import {
  BM25Retriever,
} from '../src/retrieval/bm25.retriever.js';

import {
  VectorRetriever,
} from '../src/retrieval/vector.retriever.js';

import {
  HybridRetriever,
} from '../src/retrieval/hybrid.retriever.js';

import {
  BGEReranker,
} from '../src/reranking/bge-reranker.js';

import {
  AskMyDocsAgent,
} from '../src/agent/ask-my-docs.agent.js';

const query =
  process.argv
    .slice(2)
    .join(' ')
    .trim();

if (!query) {
  throw new Error(
    'Usage: npx tsx scripts/ask.ts "your question"',
  );
}

const vectorRetriever =
  new VectorRetriever();

const bm25Retriever =
  new BM25Retriever();

const hybridRetriever =
  new HybridRetriever(
    vectorRetriever,
    bm25Retriever,
    {
      vectorTopK: 10,
      bm25TopK: 10,
      topK: 10,
    },
  );

const reranker =
  new BGEReranker();

const agent =
  new AskMyDocsAgent(
    hybridRetriever,
    reranker,
  );


const result =
  await agent.ask(query);

console.log('\nANSWER\n');
console.log(result.answer);

console.log('\nSOURCES\n');

for (
  const [index, source]
  of result.sources.entries()
) {
  console.log(
    `[SOURCE_${index + 1}] ` +
    `${source.chunk.id}`,
  );

  console.log(
    `Document: ${source.chunk.documentId}`,
  );

  console.log(
    `Pages: ${source.chunk.pageNumbers.join(', ')}`,
  );

  console.log(
    `Rerank: ${source.rerankScore?.toFixed(4)}`,
  );

  console.log();
}