import { VectorRetriever } from '../src/retrieval/vector.retriever.js';
import { BM25Retriever } from '../src/retrieval/bm25.retriever.js';
import { HybridRetriever } from '../src/retrieval/hybrid.retriever.js';

import { BGEReranker } from '../src/reranking/bge-reranker.js';

import { FaithfulnessEvaluator } from '../src/evaluation/faithfulness/faithfulness-evaluator.js';

import { AnswerRelevanceEvaluator } from '../src/evaluation/relevance/answer-relevance-evaluator.js';

import { AskMyDocsAgent } from '../src/agent/ask-my-docs.agent.js';

import { sdk } from '../src/instrumentation.js';

const QUESTION =
  'What are the two types of memory used by RAG?';

async function main(): Promise<void> {
  console.log('\n================================');
  console.log('       SINGLE QUERY TEST');
  console.log('================================\n');

  console.log(`Question: ${QUESTION}\n`);

  const vectorRetriever =
    new VectorRetriever();

  const bm25Retriever =
    new BM25Retriever();

  const hybridRetriever =
    new HybridRetriever(
      vectorRetriever,
      bm25Retriever,
    );

  const reranker =
    new BGEReranker();

  const faithfulnessEvaluator =
    new FaithfulnessEvaluator();

  const relevanceEvaluator =
    new AnswerRelevanceEvaluator();

  const agent =
    new AskMyDocsAgent(
      hybridRetriever,
      reranker,
      faithfulnessEvaluator,
      relevanceEvaluator,
    );

  const result =
    await agent.ask(QUESTION);

  console.log(
    '================================',
  );

  console.log('ANSWER');
  console.log(
    '================================\n',
  );

  console.log(result.answer);

  console.log(
    '\n================================',
  );

  console.log('CITATIONS');
  console.log(
    '================================\n',
  );

  console.log(
    'Citations:',
    result.citations,
  );

  console.log(
    'Citation valid:',
    result.citationValidation.valid,
  );

  console.log(
    'Missing citations:',
    result.citationValidation
      .missingCitations,
  );

  console.log(
    'Uncited sentences:',
    result.citationValidation
      .uncitedSentences,
  );

  console.log(
    '\n================================',
  );

  console.log('RETRIEVAL EXECUTION');
  console.log(
    '================================\n',
  );

  if (result.retrieval) {
    console.log(
      'Vector:',
      result.retrieval.vector.map(
        (item) => item.chunk.id,
      ),
    );

    console.log(
      '\nBM25:',
      result.retrieval.bm25.map(
        (item) => item.chunk.id,
      ),
    );

    console.log(
      '\nHybrid:',
      result.retrieval.hybrid.map(
        (item) => item.chunk.id,
      ),
    );

    console.log(
      '\nReranked:',
      result.retrieval.reranked.map(
        (item) => item.chunk.id,
      ),
    );
  }

  console.log(
    '\n================================',
  );

  console.log('EVALUATION');
  console.log(
    '================================\n',
  );

  console.log(
    'Faithfulness:',
    result.faithfulness?.score,
  );

  console.log(
    'Relevance:',
    result.relevance?.score,
  );

  console.log(
    '\nSingle query test completed.',
  );
}

main()
  .catch((error) => {
    console.error(
      '\nSingle query test failed:',
    );

    console.error(error);

    process.exitCode = 1;
  })
  .finally(async () => {
    await sdk.shutdown();
  });