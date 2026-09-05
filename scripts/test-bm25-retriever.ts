import {
  BM25Retriever,
} from '../src/retrieval/bm25.retriever.js';

const retriever =
  new BM25Retriever();

const queries = [
  'What is Retrieval-Augmented Generation?',
  'How does dense retrieval work?',
  'Why are citations important in a RAG system?',
];

async function main(): Promise<void> {
  console.log(
    '========== BM25 RETRIEVAL TEST ==========\n',
  );

  for (const query of queries) {
    console.log(
      '========================================',
    );

    console.log(
      `Query: ${query}`,
    );

    console.log(
      '========================================\n',
    );

    const results =
      await retriever.retrieve(
        query,
        5,
      );

    if (results.length === 0) {
      console.log(
        'No results found.\n',
      );

      continue;
    }

    for (
      let i = 0;
      i < results.length;
      i++
    ) {
      const result = results[i];

      if (!result) {
        continue;
      }

      const {
        chunk,
        score,
      } = result;

      console.log(
        `Result ${i + 1}`,
      );

      console.log(
        `BM25 Score: ${score.toFixed(4)}`,
      );

      console.log(
        `Chunk ID: ${chunk.id}`,
      );

      console.log(
        `Pages: [${chunk.pageNumbers.join(', ')}]`,
      );

      console.log(
        '\nContent:',
      );

      console.log(
        chunk.content.slice(0, 500),
      );

      console.log('\n');
    }
  }
}

main().catch((error: unknown) => {
  console.error(
    '\nBM25 retrieval test failed:',
  );

  console.error(error);

  // process.exit(1);
});