          //         DocumentPage[]
          //              │
          //              ▼
          //     ┌─────────────────┐
          //     │ createSentences │
          //     └─────────────────┘
          //              │
          //              ▼
          //         Sentence[]
          //              │
          //    ┌─────────┴─────────┐
          //    │                   │
          // text                tokens
          //    │                   │
          //    └─────────┬─────────┘
          //              ▼
          //     ┌─────────────────┐
          //     │  findChunkEnd   │
          //     └─────────────────┘
          //              │
          //              ▼
          //        ~500–800 tokens
          //              │
          //              ▼
          //     ┌─────────────────┐
          //     │ findOverlapStart│
          //     └─────────────────┘
          //              │
          //              ▼
          //         ~100-token
          //      sentence overlap
          //              │
          //              ▼
          //     ┌─────────────────┐
          //     │   createChunk   │
          //     └─────────────────┘
          //              │
          //              ▼
          //       DocumentChunk[]

// Our current strategy is: paragraph-aware → sentence-aware → token-based sizing → 500 minimum / ~700 target / 800 hard maximum → sentence-based ~100-token overlap.

// And importantly, we are NOT currently doing hard character-based chunking or arbitrary token slicing

import { encodingForModel } from 'js-tiktoken';

import type {
  DocumentChunk,
  DocumentPage,
} from '../../types/document.js';

export const TARGET_CHUNK_SIZE = 700;
const MIN_CHUNK_SIZE = 500;
const MAX_CHUNK_SIZE = 800;

const OVERLAP_TOKENS = 100;

const encoder = encodingForModel('gpt-4o');

interface Sentence {
  text: string;
  tokens: number[];
  pageNumber: number;
}

export class DocumentChunker {
  chunk(
    documentId: string,
    pages: DocumentPage[],
  ): DocumentChunk[] {
    const sentences = this.createSentences(pages);

    return this.createChunks(
      documentId,
      sentences,
    );
  }

  private createSentences(
    pages: DocumentPage[],
  ): Sentence[] {
    const sentences: Sentence[] = [];

    for (const page of pages) {
      const paragraphs = page.content
        .split(/\n\s*\n/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean);

      for (const paragraph of paragraphs) {
        const sentenceTexts =
          this.splitIntoSentences(paragraph);

        for (const text of sentenceTexts) {
          const tokens = encoder.encode(text);

          if (tokens.length === 0) {
            continue;
          }

          sentences.push({
            text,
            tokens,
            pageNumber: page.pageNumber,
          });
        }
      }
    }

    return sentences;
  }

  private splitIntoSentences(
    paragraph: string,
  ): string[] {
    return paragraph
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);
  }

private createChunks(
  documentId: string,
  sentences: Sentence[],
): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];

  let sentenceStart = 0;
  let chunkIndex = 0;

  while (sentenceStart < sentences.length) {
    const { endIndex } = this.findChunkEnd(
      sentences,
      sentenceStart,
    );

    const chunkSentences = sentences.slice(
      sentenceStart,
      endIndex,
    );

    chunks.push(
      this.createChunk(
        documentId,
        chunkIndex,
        chunkSentences,
      ),
    );

    chunkIndex++;

    if (endIndex >= sentences.length) {
      break;
    }

    sentenceStart = this.findOverlapStart(
      sentences,
      sentenceStart,
      endIndex,
    );
  }

  return chunks;
}

private findChunkEnd(
  sentences: Sentence[],
  start: number,
): {
  endIndex: number;
  tokenCount: number;
} {
  let tokenCount = 0;
  let endIndex = start;

  for (const sentence of sentences.slice(start)) {
    const sentenceTokenCount = sentence.tokens.length;

    const nextTokenCount =
      tokenCount + sentenceTokenCount;

    if (
      nextTokenCount > MAX_CHUNK_SIZE &&
      tokenCount >= MIN_CHUNK_SIZE
    ) {
      break;
    }

    tokenCount = nextTokenCount;
    endIndex++;

    if (endIndex >= sentences.length) {
      break;
    }
  }

  return {
    endIndex,
    tokenCount,
  };
}

private findOverlapStart(
  sentences: Sentence[],
  chunkStart: number,
  chunkEnd: number,
): number {
  let overlapTokens = 0;
  let overlapStart = chunkEnd;

  const chunkSentences = sentences.slice(
    chunkStart,
    chunkEnd,
  );

  for (let i = chunkSentences.length - 1; i >= 0; i--) {
    const sentence = chunkSentences[i];

    if (!sentence) {
      continue;
    }

    const sentenceTokenCount =
      sentence.tokens.length;

    if (
      overlapTokens + sentenceTokenCount >
      OVERLAP_TOKENS
    ) {
      break;
    }

    overlapTokens += sentenceTokenCount;

    overlapStart =
      chunkStart + i;
  }

  if (overlapStart === chunkStart) {
    return chunkEnd;
  }

  return overlapStart;
}

  private createChunk(
    documentId: string,
    chunkIndex: number,
    sentences: Sentence[],
  ): DocumentChunk {
    const content = sentences
      .map((sentence) => sentence.text)
      .join(' ');

    const pageNumbers = [
      ...new Set(
        sentences.map(
          (sentence) => sentence.pageNumber,
        ),
      ),
    ];

    return {
      id: `${documentId}-chunk-${chunkIndex}`,
      documentId,
      content,
      chunkIndex,
      pageNumbers,
      metadata: {},
    };
  }
}