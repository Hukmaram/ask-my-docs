import {
  AutoModelForSequenceClassification,
  AutoTokenizer,
} from '@huggingface/transformers';

import type { RetrievalResult } from '../types/retrieval.js';
import type { Reranker } from './reranker.js';

const MODEL =
  'woxpas-ai/bge-reranker-v2-m3-onnx';

export class BGEReranker implements Reranker {
  private tokenizer?: Awaited<
    ReturnType<typeof AutoTokenizer.from_pretrained>
  >;

  private model?: Awaited<
    ReturnType<
      typeof AutoModelForSequenceClassification.from_pretrained
    >
  >;

  private async initialize(): Promise<void> {
    if (this.tokenizer && this.model) {
      return;
    }

    this.tokenizer =
      await AutoTokenizer.from_pretrained(
        MODEL,
      );

    this.model =
      await AutoModelForSequenceClassification.from_pretrained(
        MODEL,
        {
          dtype: 'q8',
        },
      );
  }

  async rerank(
    query: string,
    results: RetrievalResult[],
    topK = 5,
  ): Promise<RetrievalResult[]> {
    if (results.length === 0) {
      return [];
    }

    await this.initialize();

    const tokenizer = this.tokenizer;
    const model = this.model;

    if (!tokenizer || !model) {
      throw new Error(
        'Reranker failed to initialize',
      );
    }

    const reranked: RetrievalResult[] = [];

    for (const result of results) {
      const inputs = await tokenizer(
        [query],
        {
          text_pair: [result.chunk.content],
          padding: true,
          truncation: true,
        },
      );

      const output = await model(inputs);

      const score = output.logits.data[0];

      if (score === undefined) {
        throw new Error(
          `Reranker returned no score for chunk ${result.chunk.id}`,
        );
      }

      reranked.push({
        ...result,
        score,
        rerankScore: score,
      });
    }

    reranked.sort(
      (a, b) => b.score - a.score,
    );

    return reranked.slice(0, topK);
  }
}