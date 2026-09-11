import { BM25Retriever } from '../src/retrieval/bm25.retriever.js';
import { HybridRetriever } from '../src/retrieval/hybrid.retriever.js';
import { VectorRetriever } from '../src/retrieval/vector.retriever.js';
import { BGEReranker } from '../src/reranking/bge-reranker.js';

const QUESTION =
  'How does retrieval augmented generation improve knowledge intensive NLP tasks?';

const RETRIEVAL_TOP_K = 10;
const RERANK_TOP_K = 5;
const FINAL_TOP_K = 2;

async function main(): Promise<void> {
  console.log('\n========================================');
  console.log('        ONE QUESTION RETRIEVAL TEST');
  console.log('========================================\n');

  console.log(`Question:\n${QUESTION}\n`);

  // ----------------------------------------
  // 1. Create retrievers
  // ----------------------------------------

  const vectorRetriever = new VectorRetriever();
  const bm25Retriever = new BM25Retriever();

  const hybridRetriever = new HybridRetriever(
    vectorRetriever,
    bm25Retriever,
    60,
  );

  const reranker = new BGEReranker();

  // ----------------------------------------
  // 2. Vector + FTS + Hybrid
  // ----------------------------------------

  console.log('----------------------------------------');
  console.log('1. VECTOR + FTS + HYBRID RETRIEVAL');
  console.log('----------------------------------------\n');

  const execution =
    await hybridRetriever.retrieveWithStages(
      QUESTION,
      RETRIEVAL_TOP_K,
    );

  // ----------------------------------------
  // Vector results
  // ----------------------------------------

  console.log('VECTOR TOP 10\n');

  execution.vector.forEach((result, index) => {
    console.log(
      `#${index + 1} ` +
        `score=${result.vectorScore?.toFixed(4) ?? result.score.toFixed(4)} ` +
        `${result.chunk.id}`,
    );

    console.log(
      `   pages: ${result.chunk.pageNumbers.join(', ')}`,
    );

    console.log(
      `   ${result.chunk.content.slice(0, 180)}...`,
    );

    console.log();
  });

  // ----------------------------------------
  // FTS results
  // ----------------------------------------

  console.log('LEXICAL / FTS TOP 10\n');

  execution.bm25.forEach((result, index) => {
    console.log(
      `#${index + 1} ` +
        `score=${result.bm25Score?.toFixed(4) ?? result.score.toFixed(4)} ` +
        `${result.chunk.id}`,
    );

    console.log(
      `   pages: ${result.chunk.pageNumbers.join(', ')}`,
    );

    console.log(
      `   ${result.chunk.content.slice(0, 180)}...`,
    );

    console.log();
  });

  // ----------------------------------------
  // Hybrid RRF results
  // ----------------------------------------

  console.log('HYBRID RRF TOP 10\n');

  execution.hybrid.forEach((result, index) => {
    console.log(
      `#${index + 1} ` +
        `RRF=${result.rrfScore?.toFixed(6) ?? 'N/A'} ` +
        `vectorRank=${result.vectorRank ?? '-'} ` +
        `ftsRank=${result.bm25Rank ?? '-'} ` +
        `${result.chunk.id}`,
    );

    console.log(
      `   vectorScore=${result.vectorScore?.toFixed(4) ?? '-'} ` +
        `ftsScore=${result.bm25Score?.toFixed(4) ?? '-'}`,
    );

    console.log(
      `   pages: ${result.chunk.pageNumbers.join(', ')}`,
    );

    console.log(
      `   ${result.chunk.content.slice(0, 180)}...`,
    );

    console.log();
  });

  // ----------------------------------------
  // 3. BGE reranking
  // ----------------------------------------

  console.log('----------------------------------------');
  console.log('2. BGE RERANKING');
  console.log('----------------------------------------\n');

  const reranked = await reranker.rerank(
    QUESTION,
    execution.hybrid,
    RERANK_TOP_K,
  );

  console.log(`RERANKED TOP ${RERANK_TOP_K}\n`);

  reranked.forEach((result, index) => {
    console.log(
      `#${index + 1} ` +
        `rerank=${result.rerankScore?.toFixed(4) ?? result.score.toFixed(4)} ` +
        `RRF=${result.rrfScore?.toFixed(6) ?? '-'} ` +
        `${result.chunk.id}`,
    );

    console.log(
      `   vectorRank=${result.vectorRank ?? '-'} ` +
        `ftsRank=${result.bm25Rank ?? '-'}`,
    );

    console.log(
      `   pages: ${result.chunk.pageNumbers.join(', ')}`,
    );

    console.log(
      `   ${result.chunk.content.slice(0, 250)}...`,
    );

    console.log();
  });

  // ----------------------------------------
  // 4. Final Top 2
  // ----------------------------------------

  const finalResults = reranked.slice(0, FINAL_TOP_K);

  console.log('----------------------------------------');
  console.log(`3. FINAL TOP ${FINAL_TOP_K}`);
  console.log('----------------------------------------\n');

  finalResults.forEach((result, index) => {
    console.log(
      `SOURCE_${index + 1}`,
    );

    console.log(
      `chunk: ${result.chunk.id}`,
    );

    console.log(
      `pages: ${result.chunk.pageNumbers.join(', ')}`,
    );

    console.log(
      `rerank score: ${result.rerankScore?.toFixed(4) ?? '-'}`,
    );

    console.log(
      `content:\n${result.chunk.content}`,
    );

    console.log('\n----------------------------------------\n');
  });

  console.log('Retrieval pipeline completed successfully.\n');
}

main().catch((error) => {
  console.error('\nRetrieval test failed:');
  console.error(error);
  process.exitCode = 1;
});