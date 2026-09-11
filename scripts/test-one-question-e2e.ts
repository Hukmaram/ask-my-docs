import { AskMyDocsAgent } from '../src/agent/ask-my-docs.agent.js';

import { HybridRetriever } from '../src/retrieval/hybrid.retriever.js';
import { VectorRetriever } from '../src/retrieval/vector.retriever.js';
import { BM25Retriever } from '../src/retrieval/bm25.retriever.js';

import { BGEReranker } from '../src/reranking/bge-reranker.js';

import { FaithfulnessEvaluator } from '../src/evaluation/faithfulness/faithfulness-evaluator.js';
import { AnswerRelevanceEvaluator } from '../src/evaluation/relevance/answer-relevance-evaluator.js';

const QUESTION =
  'How does retrieval augmented generation improve knowledge intensive NLP tasks?';

async function main(): Promise<void> {
  console.log('\n========================================');
  console.log('       ONE QUESTION END-TO-END TEST');
  console.log('========================================\n');

  console.log(`Question:\n${QUESTION}\n`);

  // ----------------------------------------
  // 1. Build dependencies
  // ----------------------------------------

  const vectorRetriever = new VectorRetriever();

  const bm25Retriever = new BM25Retriever();

  const hybridRetriever = new HybridRetriever(
    vectorRetriever,
    bm25Retriever,
    60,
  );

  const reranker = new BGEReranker();

  const faithfulnessEvaluator =
    new FaithfulnessEvaluator();

  const relevanceEvaluator =
    new AnswerRelevanceEvaluator();

  // ----------------------------------------
  // 2. Build agent
  // ----------------------------------------

  const agent = new AskMyDocsAgent(
    hybridRetriever,
    reranker,
    faithfulnessEvaluator,
    relevanceEvaluator,
  );

  // ----------------------------------------
  // 3. Run complete RAG pipeline
  // ----------------------------------------

  console.log('Running Ask My Docs...\n');

  const result = await agent.ask(QUESTION);

  // ----------------------------------------
  // 4. FINAL ANSWER
  // ----------------------------------------

  console.log('========================================');
  console.log('                 ANSWER');
  console.log('========================================\n');

  console.log(result.answer);

  // ----------------------------------------
  // 5. SOURCES
  // ----------------------------------------

  console.log('\n========================================');
  console.log('                SOURCES');
  console.log('========================================\n');

  result.sources.forEach((source, index) => {
    console.log(`SOURCE_${index + 1}`);
    console.log(`Chunk: ${source.chunk.id}`);
    console.log(
      `Pages: ${source.chunk.pageNumbers.join(', ')}`,
    );

    console.log(
      `Rerank score: ${
        source.rerankScore?.toFixed(4) ?? '-'
      }`,
    );

    console.log(
      `RRF score: ${
        source.rrfScore?.toFixed(6) ?? '-'
      }`,
    );

    console.log();
  });

  // ----------------------------------------
  // 6. CITATIONS
  // ----------------------------------------

  console.log('========================================');
  console.log('             CITATIONS');
  console.log('========================================\n');

  console.log(
    result.citations.length > 0
      ? result.citations.join(', ')
      : 'None',
  );

  // ----------------------------------------
  // 7. CITATION VALIDATION
  // ----------------------------------------

  console.log('\n========================================');
  console.log('          CITATION VALIDATION');
  console.log('========================================\n');

  console.log(
    `Valid: ${result.citationValidation.valid}`,
  );

  console.log(
    `Missing citations: ${
      result.citationValidation.missingCitations
    }`,
  );

  console.log(
    `Invalid citations: ${
      result.citationValidation.invalidCitations
        .length > 0
        ? result.citationValidation.invalidCitations.join(
            ', ',
          )
        : 'None'
    }`,
  );

  console.log(
    `Uncited sentences: ${
      result.citationValidation.uncitedSentences
        .length > 0
        ? result.citationValidation.uncitedSentences.length
        : 'None'
    }`,
  );

  // ----------------------------------------
  // 8. FAITHFULNESS
  // ----------------------------------------

  console.log('\n========================================');
  console.log('              FAITHFULNESS');
  console.log('========================================\n');

  if (result.faithfulness) {
    console.log(
      `Score: ${result.faithfulness.score.toFixed(4)}`,
    );

    console.log(
      `Claims evaluated: ${
        result.faithfulness.claims.length
      }`,
    );
  } else {
    console.log('Not evaluated.');
  }

  // ----------------------------------------
  // 9. ANSWER RELEVANCE
  // ----------------------------------------

  console.log('\n========================================');
  console.log('            ANSWER RELEVANCE');
  console.log('========================================\n');

  if (result.relevance) {
    console.log(
      `Score: ${result.relevance.score.toFixed(4)}`,
    );

    console.log(
      `Explanation: ${result.relevance.explanation}`,
    );
  } else {
    console.log('Not evaluated.');
  }

  // ----------------------------------------
  // 10. RETRIEVAL SUMMARY
  // ----------------------------------------

  console.log('\n========================================');
  console.log('          RETRIEVAL SUMMARY');
  console.log('========================================\n');

  if (result.retrieval) {
    console.log(
      `Vector results: ${result.retrieval.vector.length}`,
    );

    console.log(
      `FTS results: ${result.retrieval.bm25.length}`,
    );

    console.log(
      `Hybrid results: ${result.retrieval.hybrid.length}`,
    );

    console.log(
      `Reranked results: ${result.retrieval.reranked.length}`,
    );
  }

  // ----------------------------------------
  // 11. FINAL STATUS
  // ----------------------------------------

  console.log('\n========================================');
  console.log('                 RESULT');
  console.log('========================================\n');

  const citationPassed =
    result.citationValidation.valid;

  const faithfulnessPassed =
    result.faithfulness !== undefined;

  const relevancePassed =
    result.relevance !== undefined;

  console.log(
    `Citation validation: ${
      citationPassed ? '✅ PASS' : '❌ FAIL'
    }`,
  );

  console.log(
    `Faithfulness evaluated: ${
      faithfulnessPassed ? '✅ YES' : '❌ NO'
    }`,
  );

  console.log(
    `Relevance evaluated: ${
      relevancePassed ? '✅ YES' : '❌ NO'
    }`,
  );

  console.log('\n========================================\n');
}

main().catch((error) => {
  console.error('\nEnd-to-end test failed:');
  console.error(error);

  process.exitCode = 1;
});