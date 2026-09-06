import { HybridRetriever } from '../src/retrieval/hybrid.retriever.js';
import { VectorRetriever } from '../src/retrieval/vector.retriever.js';
import { BM25Retriever } from '../src/retrieval/bm25.retriever.js';
import { BGEReranker } from '../src/reranking/bge-reranker.js';
import { FaithfulnessEvaluator } from '../src/evaluation/faithfulness/faithfulness-evaluator.js';

const query =
  'How does retrieval augmented generation improve knowledge intensive NLP tasks?';

const vectorRetriever = new VectorRetriever();
const bm25Retriever = new BM25Retriever();

const retriever = new HybridRetriever(
  vectorRetriever,
  bm25Retriever,
);

const reranker = new BGEReranker();
const evaluator = new FaithfulnessEvaluator();

const candidates = await retriever.retrieve(query);

const reranked = await reranker.rerank(
  query,
  candidates,
  5,
);

const sources = reranked.slice(0, 2);

const answer = `
Retrieval-Augmented Generation (RAG) improves knowledge-intensive NLP
tasks by combining pre-trained parametric and non-parametric memory for
language generation. [SOURCE_1]

This approach enables models to access and precisely manipulate knowledge,
addressing limitations of large pre-trained language models. [SOURCE_2]

By fine-tuning RAG models on a wide range of knowledge-intensive NLP tasks,
researchers achieved state-of-the-art results on open-domain QA tasks.
[SOURCE_2]
`;

const result = await evaluator.evaluate(
  answer,
  sources,
);

console.log('\n===== FAITHFULNESS =====\n');

console.log(
  `Score: ${(result.score * 100).toFixed(1)}%`,
);

for (const [index, claim] of result.claims.entries()) {
  console.log(`\nClaim ${index + 1}`);
  console.log(`Claim: ${claim.claim}`);
  console.log(`Citations: ${claim.citations.join(', ')}`);
  console.log(`Supported: ${claim.supported}`);
  console.log(`Explanation: ${claim.explanation}`);
}