import { HybridRetriever } from '../retrieval/hybrid.retriever.js';

import type { RetrievalResult } from '../types/retrieval.js';

import type { Reranker } from '../reranking/reranker.js';

import { buildRagPrompt } from '../prompts/rag.prompt.js';



import { OllamaClient } from '../llm/ollama.client.js';
import { validateCitations } from '../evaluation/citations/citation-validator.js';
import { repairCitations } from '../evaluation/citations/citation-repair.js';
import { FaithfulnessEvaluator, FaithfulnessResult } from '../evaluation/faithfulness/faithfulness-evaluator.js';


export interface AskMyDocsResponse {
  answer: string;
  sources: RetrievalResult[];
  citations: string[];
   faithfulness?: FaithfulnessResult;
}

export class AskMyDocsAgent {
 constructor(
  private readonly retriever: HybridRetriever,
  private readonly reranker: Reranker,
  private readonly faithfulnessEvaluator: FaithfulnessEvaluator,
  private readonly llm = new OllamaClient(),
) {}

  async ask(query: string): Promise<AskMyDocsResponse> {
     if (!query.trim()) {
      throw new Error('Query cannot be empty');
    }
    // 1. Retrieve
    const candidates = await this.retriever.retrieve(query);

    // 2. Rerank
    if (candidates.length === 0) {
      return {
        answer: 'I could not find relevant information in the available documents.',
        sources: [],
        citations: [],
      };
    }
    const reranked = await this.reranker.rerank(
      query,
      candidates,
      5,
    );

    // 3. Select final sources
    const sources = reranked.slice(0, 2);

    // 4. Generate answer
    const prompt = buildRagPrompt(query, sources);

    let answer = await this.llm.generate(prompt);

    // 5. Validate citations
    let citationResult = validateCitations(
      answer,
      sources,
    );

    // 6. Repair if necessary
    if (!citationResult.valid) { 
    console.log('\n===== CITATION VALIDATION FAILED =====');
  console.log(citationResult);

  console.log('\n===== REPAIRING CITATIONS =====');

  answer = await repairCitations(
    answer,
    sources,
    this.llm,
  );

  console.log('\n===== ANSWER AFTER REPAIR =====');
  console.log(answer);

  citationResult = validateCitations(
    answer,
    sources,
  );

  console.log('\n===== CITATION VALIDATION AFTER REPAIR =====');
  console.log(citationResult)
    }

    if (!citationResult.valid) {
      throw new Error(
        `Citation validation failed after repair: ${JSON.stringify(
          citationResult,
        )}`,
      );
    }

    // 7. Evaluate faithfulness
    const faithfulness =
      await this.faithfulnessEvaluator.evaluate(
        answer,
        sources,
      );

    // 8. Return complete response
    return {
      answer,
      sources,
      citations: citationResult.citations,
      faithfulness,
    };
  }
}