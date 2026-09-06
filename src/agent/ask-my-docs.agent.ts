import { HybridRetriever } from '../retrieval/hybrid.retriever.js';

import type { RetrievalResult } from '../types/retrieval.js';

import type { Reranker } from '../reranking/reranker.js';

import { buildRagPrompt } from '../prompts/rag.prompt.js';



import { OllamaClient } from '../llm/ollama.client.js';
import { validateCitations } from '../evaluation/citations/citation-validator.js';
import { repairCitations } from '../evaluation/citations/citation-repair.js';


export interface AskMyDocsResponse {
  answer: string;
  sources: RetrievalResult[];
  citations: string[];
}

export class AskMyDocsAgent {
  constructor(
    private readonly retriever: HybridRetriever,
    private readonly reranker: Reranker,
    private readonly llm = new OllamaClient(),
  ) {}

  async ask(query: string): Promise<AskMyDocsResponse> {
    if (!query.trim()) {
      throw new Error('Query cannot be empty');
    }

    const candidates = await this.retriever.retrieve(query);

    if (candidates.length === 0) {
      return {
        answer: 'I could not find relevant information in the available documents.',
        sources: [],
        citations: [],
      };
    }

    const reranked = await this.reranker.rerank(query, candidates, 5);

    const sources = reranked.slice(0, 2);

    const prompt = buildRagPrompt(query, sources);

    let answer = await this.llm.generate(prompt);

    let citationResult = validateCitations(answer, sources);

    if (!citationResult.valid) {
      console.log('\n===== CITATION VALIDATION FAILED =====');

      console.log(citationResult);

      console.log('\n===== REPAIRING CITATIONS =====');

      answer = await repairCitations(answer, sources, this.llm);

      citationResult = validateCitations(answer, sources);
    }

    if (!citationResult.valid) {
      throw new Error(`Citation validation failed after repair: ${JSON.stringify(citationResult)}`);
    }

    return {
      answer,
      sources,
      citations: citationResult.citations,
    };
  }
}
