import { BM25Retriever } from '../src/retrieval/bm25.retriever.js';
import { HybridRetriever } from '../src/retrieval/hybrid.retriever.js';
import { VectorRetriever } from '../src/retrieval/vector.retriever.js';

const vectorRetriever = new VectorRetriever();
const bm25Retriever = new BM25Retriever();

const hybridRetriever = new HybridRetriever(
  vectorRetriever,
  bm25Retriever,
  {
    vectorTopK: 10,
    bm25TopK: 10,
    topK: 10,
    rrfK: 60,
  },
);

const query =
  'How does retrieval augmented generation improve knowledge intensive NLP tasks?';

console.log(`\nQuery: ${query}\n`);

const results =
  await hybridRetriever.retrieve(query);

console.log(
  `Hybrid results: ${results.length}\n`,
);

results.forEach((result, index) => {
  console.log(
    `${index + 1}. ` +
      `RRF=${result.score.toFixed(6)} ` +
      `vector=${result.vectorScore?.toFixed(4) ?? '-'} ` +
      `bm25=${result.bm25Score?.toFixed(4) ?? '-'} ` +
      `vectorRank=${result.vectorRank ?? '-'} ` +
      `bm25Rank=${result.bm25Rank ?? '-'}`,
  );

  console.log(
    `   ${result.chunk.id}`,
  );

  console.log(
    `   ${result.chunk.content.slice(0, 250)}...`,
  );

  console.log();
});