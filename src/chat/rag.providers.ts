import type { Provider } from '@nestjs/common';

import { AskMyDocsAgent } from '../agent/ask-my-docs.agent.js';
import { EmbeddingClient } from '../embeddings/embedding.client.js';
import { EmbeddingService } from '../embeddings/embedding.service.js';
import { FaithfulnessEvaluator } from '../evaluation/faithfulness/faithfulness-evaluator.js';
import { AnswerRelevanceEvaluator } from '../evaluation/relevance/answer-relevance-evaluator.js';
import { OllamaClient } from '../llm/ollama.client.js';
import { BGEReranker } from '../reranking/bge-reranker.js';
import type { Reranker } from '../reranking/reranker.js';
import { BM25Retriever } from '../retrieval/bm25.retriever.js';
import { HybridRetriever } from '../retrieval/hybrid.retriever.js';
import { VectorRetriever } from '../retrieval/vector.retriever.js';

const OLLAMA_CLIENT = Symbol('OLLAMA_CLIENT');
const EMBEDDING_CLIENT = Symbol('EMBEDDING_CLIENT');
const EMBEDDING_SERVICE = Symbol('EMBEDDING_SERVICE');
const VECTOR_RETRIEVER = Symbol('VECTOR_RETRIEVER');
const BM25_RETRIEVER = Symbol('BM25_RETRIEVER');
const HYBRID_RETRIEVER = Symbol('HYBRID_RETRIEVER');
const RERANKER = Symbol('RERANKER');
const FAITHFULNESS_EVALUATOR = Symbol('FAITHFULNESS_EVALUATOR');
const RELEVANCE_EVALUATOR = Symbol('RELEVANCE_EVALUATOR');

export const ASK_MY_DOCS_AGENT = Symbol('ASK_MY_DOCS_AGENT');

function createReranker(): Reranker {
  if (process.env.RAG_RERANKER_ENABLED !== 'false') {
    return new BGEReranker();
  }

  return {
    async rerank(
      query: string,
      results,
      topK = 5,
    ) {
      void query;

      return results.slice(0, topK);
    },
  };
}

export const ragProviders: Provider[] = [
  {
    provide: OLLAMA_CLIENT,
    useFactory: () => new OllamaClient(),
  },
  {
    provide: EMBEDDING_CLIENT,
    useFactory: () => new EmbeddingClient(),
  },
  {
    provide: EMBEDDING_SERVICE,
    useFactory: (client: EmbeddingClient) =>
      new EmbeddingService(client),
    inject: [EMBEDDING_CLIENT],
  },
  {
    provide: VECTOR_RETRIEVER,
    useFactory: (embeddingService: EmbeddingService) =>
      new VectorRetriever(embeddingService),
    inject: [EMBEDDING_SERVICE],
  },
  {
    provide: BM25_RETRIEVER,
    useFactory: () => new BM25Retriever(),
  },
  {
    provide: HYBRID_RETRIEVER,
    useFactory: (
      vectorRetriever: VectorRetriever,
      bm25Retriever: BM25Retriever,
    ) => new HybridRetriever(vectorRetriever, bm25Retriever),
    inject: [VECTOR_RETRIEVER, BM25_RETRIEVER],
  },
  {
    provide: RERANKER,
    useFactory: createReranker,
  },
  {
    provide: FAITHFULNESS_EVALUATOR,
    useFactory: (llm: OllamaClient) =>
      new FaithfulnessEvaluator(llm),
    inject: [OLLAMA_CLIENT],
  },
  {
    provide: RELEVANCE_EVALUATOR,
    useFactory: (llm: OllamaClient) =>
      new AnswerRelevanceEvaluator(llm),
    inject: [OLLAMA_CLIENT],
  },
  {
    provide: ASK_MY_DOCS_AGENT,
    useFactory: (
      retriever: HybridRetriever,
      reranker: Reranker,
      faithfulnessEvaluator: FaithfulnessEvaluator,
      relevanceEvaluator: AnswerRelevanceEvaluator,
      llm: OllamaClient,
    ) =>
      new AskMyDocsAgent(
        retriever,
        reranker,
        faithfulnessEvaluator,
        relevanceEvaluator,
        llm,
      ),
    inject: [
      HYBRID_RETRIEVER,
      RERANKER,
      FAITHFULNESS_EVALUATOR,
      RELEVANCE_EVALUATOR,
      OLLAMA_CLIENT,
    ],
  },
];
