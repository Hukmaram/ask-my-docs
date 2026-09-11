import {
  startActiveObservation,
} from '@langfuse/tracing';

import { HybridRetriever } from '../retrieval/hybrid.retriever.js';

import type {
  RetrievalExecution,
  RetrievalResult,
} from '../types/retrieval.js';

import type { Reranker } from '../reranking/reranker.js';

import { buildRagPrompt } from '../prompts/rag.prompt.js';

import { OllamaClient } from '../llm/ollama.client.js';

import {
  validateCitations,
  type CitationValidationResult,
} from '../evaluation/citations/citation-validator.js';

import { repairCitations } from '../evaluation/citations/citation-repair.js';

import {
  FaithfulnessEvaluator,
  type FaithfulnessResult,
} from '../evaluation/faithfulness/faithfulness-evaluator.js';

import {
  AnswerRelevanceEvaluator,
  type AnswerRelevanceResult,
} from '../evaluation/relevance/answer-relevance-evaluator.js';

export interface AskMyDocsResponse {
  answer: string;

  sources: RetrievalResult[];

  citations: string[];

  citationValidation: CitationValidationResult;

  retrieval?: RetrievalExecution;

  faithfulness?: FaithfulnessResult;

  relevance?: AnswerRelevanceResult;
}

export class AskMyDocsAgent {
  constructor(
    private readonly retriever: HybridRetriever,
    private readonly reranker: Reranker,
    private readonly faithfulnessEvaluator: FaithfulnessEvaluator,
    private readonly relevanceEvaluator: AnswerRelevanceEvaluator,
    private readonly llm = new OllamaClient(),
  ) {}

  async ask(
    query: string,
  ): Promise<AskMyDocsResponse> {
    if (!query.trim()) {
      throw new Error('Query cannot be empty');
    }

    return startActiveObservation(
      'ask-my-docs',
      async (trace) => {
        trace.update({
          input: {
            query,
          },
        });

        try {
          /*
           * --------------------------------------------------
           * 1. RETRIEVAL
           * --------------------------------------------------
           *
           * Vector + BM25 + Hybrid are calculated once.
           */
          const retrieval =
            await startActiveObservation(
              'retrieval',
              async (retrievalObservation) => {
                retrievalObservation.update({
                  input: {
                    query,
                  },
                });

                const execution =
                  await this.retriever
                    .retrieveWithStages(
                      query,
                      10,
                    );

                retrievalObservation.update({
                  output: {
                    vectorCount:
                      execution.vector.length,

                    bm25Count:
                      execution.bm25.length,

                    hybridCount:
                      execution.hybrid.length,

                    vectorChunkIds:
                      execution.vector.map(
                        (result) =>
                          result.chunk.id,
                      ),

                    bm25ChunkIds:
                      execution.bm25.map(
                        (result) =>
                          result.chunk.id,
                      ),

                    hybridChunkIds:
                      execution.hybrid.map(
                        (result) =>
                          result.chunk.id,
                      ),
                  },
                  metadata: {
                    topK: '10',
                    rrfK: '60',
                  },
                });

                return execution;
              },
              {
                asType: 'retriever',
              },
            );

          if (retrieval.hybrid.length === 0) {
            const answer =
              'I could not find relevant information in the available documents.';

            const response: AskMyDocsResponse = {
              answer,
              sources: [],
              citations: [],
              citationValidation: {
                valid: false,
                citations: [],
                invalidCitations: [],
                missingCitations: true,
                uncitedSentences: [],
              },
              retrieval,
            };

            trace.update({
              output: response,
            });

            return response;
          }

          /*
           * --------------------------------------------------
           * 2. RERANKING
           * --------------------------------------------------
           */
          const reranked =
            await startActiveObservation(
              'reranking',
              async (rerankingObservation) => {
                rerankingObservation.update({
                  input: {
                    query,
                    candidateCount:
                      retrieval.hybrid.length,

                    candidateIds:
                      retrieval.hybrid.map(
                        (candidate) =>
                          candidate.chunk.id,
                      ),
                  },
                });

                const results =
                  await this.reranker.rerank(
                    query,
                    retrieval.hybrid,
                    5,
                  );

                rerankingObservation.update({
                  output: {
                    resultCount:
                      results.length,

                    chunkIds:
                      results.map(
                        (result) =>
                          result.chunk.id,
                      ),

                    scores:
                      results.map(
                        (result) =>
                          result.rerankScore ??
                          result.score,
                      ),
                  },
                });

                return results;
              },
            );

          /*
           * Save reranked results in the execution.
           */
          retrieval.reranked =
            reranked;

          /*
           * Only the top 2 sources are sent
           * to the generator.
           */
          const sources =
            reranked.slice(0, 2);

          /*
           * --------------------------------------------------
           * 3. GENERATION
           * --------------------------------------------------
           */
          const prompt =
            buildRagPrompt(
              query,
              sources,
            );

          let answer =
            await this.llm.generate(
              prompt,
            );

          /*
           * --------------------------------------------------
           * 4. CITATION VALIDATION
           * --------------------------------------------------
           */
          let citationValidation =
            await startActiveObservation(
              'citation-validation',
              async (
                validationObservation,
              ) => {
                const result =
                  validateCitations(
                    answer,
                    sources,
                  );

                validationObservation.update({
                  input: {
                    answer,
                  },

                  output: {
                    valid:
                      result.valid,

                    citations:
                      result.citations,

                    invalidCitations:
                      result.invalidCitations,

                    missingCitations:
                      result.missingCitations,

                    uncitedSentenceCount:
                      result
                        .uncitedSentences
                        .length,
                  },
                });

                return result;
              },
              {
                asType: 'evaluator',
              },
            );

          /*
           * --------------------------------------------------
           * 5. CITATION REPAIR
           * --------------------------------------------------
           */
          if (!citationValidation.valid) {
            answer =
              await startActiveObservation(
                'citation-repair',
                async (
                  repairObservation,
                ) => {
                  repairObservation.update({
                    input: {
                      answer,
                    },
                  });

                  const repaired =
                    repairCitations(
                      answer,
                      sources,
                    );

                  repairObservation.update({
                    output: {
                      changed:
                        repaired !==
                        answer,

                      answer:
                        repaired,
                    },
                  });

                  return repaired;
                },
              );

            citationValidation =
              await startActiveObservation(
                'citation-validation-after-repair',
                async (
                  validationObservation,
                ) => {
                  const result =
                    validateCitations(
                      answer,
                      sources,
                    );

                  validationObservation.update({
                    input: {
                      answer,
                    },

                    output: {
                      valid:
                        result.valid,

                      citations:
                        result.citations,

                      invalidCitations:
                        result
                          .invalidCitations,

                      missingCitations:
                        result
                          .missingCitations,

                      uncitedSentenceCount:
                        result
                          .uncitedSentences
                          .length,
                    },
                  });

                  return result;
                },
                {
                  asType: 'evaluator',
                },
              );
          }

          /*
           * If citations are still invalid,
           * fail safely.
           */
          if (
            !citationValidation.valid
          ) {
            const response: AskMyDocsResponse =
              {
                answer,
                sources,

                citations:
                  citationValidation
                    .citations,

                citationValidation,

                retrieval,
              };

            trace.update({
              output: response,
            });

            return response;
          }

          /*
           * --------------------------------------------------
           * 6. FAITHFULNESS
           * --------------------------------------------------
           */
          const faithfulness =
            await startActiveObservation(
              'faithfulness',
              async (
                evaluationObservation,
              ) => {
                const result =
                  await this
                    .faithfulnessEvaluator
                    .evaluate(
                      answer,
                      sources,
                    );

                evaluationObservation.update({
                  input: {
                    answer,
                  },

                  output: {
                    score:
                      result.score,

                    claims:
                      result.claims,
                  },
                });

                return result;
              },
              {
                asType: 'evaluator',
              },
            );

          /*
           * --------------------------------------------------
           * 7. ANSWER RELEVANCE
           * --------------------------------------------------
           */
          const relevance =
            await startActiveObservation(
              'answer-relevance',
              async (
                evaluationObservation,
              ) => {
                const result =
                  await this
                    .relevanceEvaluator
                    .evaluate(
                      query,
                      answer,
                    );

                evaluationObservation.update({
                  input: {
                    question:
                      query,

                    answer,
                  },

                  output: {
                    score:
                      result.score,

                    explanation:
                      result
                        .explanation,
                  },
                });

                return result;
              },
              {
                asType: 'evaluator',
              },
            );

          /*
           * --------------------------------------------------
           * 8. FINAL RESPONSE
           * --------------------------------------------------
           */
          const response: AskMyDocsResponse =
            {
              answer,

              sources,

              citations:
                citationValidation
                  .citations,

              citationValidation,

              retrieval,

              faithfulness,

              relevance,
            };

          trace.update({
            output: {
              answer,

              sourceCount:
                sources.length,

              citations:
                citationValidation
                  .citations,

              citationValid:
                citationValidation
                  .valid,

              faithfulness:
                faithfulness.score,

              relevance:
                relevance.score,

              retrieval: {
                vectorCount:
                  retrieval.vector
                    .length,

                bm25Count:
                  retrieval.bm25
                    .length,

                hybridCount:
                  retrieval.hybrid
                    .length,

                rerankedCount:
                  retrieval.reranked
                    .length,
              },
            },
          });

          return response;
        } catch (error) {
          trace.update({
            output: {
              error:
                error instanceof Error
                  ? error.message
                  : String(error),
            },
          });

          throw error;
        }
      },
      {
        asType: 'agent',
      },
    );
  }
}