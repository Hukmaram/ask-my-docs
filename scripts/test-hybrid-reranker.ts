import { BM25Retriever } from '../src/retrieval/bm25.retriever.js';
import { VectorRetriever } from '../src/retrieval/vector.retriever.js';
import { HybridRetriever } from '../src/retrieval/hybrid.retriever.js';
import { BGEReranker } from '../src/reranking/bge-reranker.js';

const query =
  'How does retrieval augmented generation improve knowledge intensive NLP tasks?';

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

const candidates =
  await hybridRetriever.retrieve(
    query,
  );

console.log(
  `Hybrid candidates: ${candidates.length}`,
);
console.log();

const reranked =
  await reranker.rerank(
    query,
    candidates,
    5,
  );

console.log(
  `Reranked results: ${reranked.length}`,
);
console.log();

for (
  const [index, result]
  of reranked.entries()
) {
  console.log(
    `${index + 1}. ` +
      `rerank=${result.rerankScore?.toFixed(4)} ` +
      `RRF=${result.score.toFixed(6)} ` +
      `vector=${result.vectorScore?.toFixed(4) ?? '-'} ` +
      `bm25=${result.bm25Score?.toFixed(4) ?? '-'}`,
  );

  console.log(
    `   ${result.chunk.id}`,
  );

  console.log(
    `   ${result.chunk.content.slice(0, 250)}...`,
  );

  console.log();
}