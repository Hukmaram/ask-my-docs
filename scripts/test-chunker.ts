
import { encodingForModel } from 'js-tiktoken';

import { DocumentChunker } from '../src/ingestion/chunkers/document.chunker.js';
import type { DocumentPage } from '../src/types/document.js';

const encoder = encodingForModel('gpt-4o');

const MIN_CHUNK_SIZE = 500;
const MAX_CHUNK_SIZE = 800;

/*
 * -------------------------------------------------------
 * TEST DATA
 * -------------------------------------------------------
 *
 * We generate unique sentences so that we can reliably
 * test sentence-level overlap.
 *
 * Two pages are used to verify that chunks can correctly
 * span PDF page boundaries.
 */

function createTestSentences(
  prefix: string,
  count: number,
): string {
  return Array.from(
    { length: count },
    (_, index) =>
      `${prefix} sentence ${index + 1} explains an important concept about retrieval augmented generation and provides unique context for testing chunk boundaries.`,
  ).join(' ');
}

const pages: DocumentPage[] = [
  {
    pageNumber: 1,
    content: createTestSentences(
      'Page one',
      80,
    ),
  },

  {
    pageNumber: 2,
    content: createTestSentences(
      'Page two',
      80,
    ),
  },
];

/*
 * -------------------------------------------------------
 * CREATE CHUNKS
 * -------------------------------------------------------
 */

const chunker = new DocumentChunker();

const chunks = chunker.chunk(
  'test-document',
  pages,
);

console.log(
  `Total chunks: ${chunks.length}`,
);

/*
 * -------------------------------------------------------
 * CHUNK DETAILS
 * -------------------------------------------------------
 */

for (const chunk of chunks) {
  const tokens = encoder.encode(
    chunk.content,
  );

  console.log(
    '\n------------------------------',
  );

  console.log(
    `Chunk: ${chunk.chunkIndex}`,
  );

  console.log(
    `ID: ${chunk.id}`,
  );

  console.log(
    `Tokens: ${tokens.length}`,
  );

  console.log(
    `Pages: [${chunk.pageNumbers.join(', ')}]`,
  );

  console.log(
    `Characters: ${chunk.content.length}`,
  );

  console.log('\nContent start:');

  console.log(
    chunk.content.slice(0, 300),
  );

  console.log('\nContent end:');

  console.log(
    chunk.content.slice(-300),
  );
}

/*
 * -------------------------------------------------------
 * CHUNK SIZE TEST
 * -------------------------------------------------------
 *
 * Normal chunks should contain between 500 and 800
 * tokens.
 *
 * The final chunk is allowed to be smaller because it
 * contains the remaining document content.
 */

console.log(
  '\n========== CHUNK SIZE TEST ==========',
);

let sizeTestPassed = true;

for (let i = 0; i < chunks.length; i++) {
  const chunk = chunks[i];

  if (!chunk) {
    continue;
  }

  const tokenCount = encoder.encode(
    chunk.content,
  ).length;

  const isLastChunk =
    i === chunks.length - 1;

  const isValid =
    isLastChunk ||
    (
      tokenCount >= MIN_CHUNK_SIZE &&
      tokenCount <= MAX_CHUNK_SIZE
    );

  if (!isValid) {
    sizeTestPassed = false;
  }

  console.log(
    `Chunk ${i}: ${tokenCount} tokens → ${
      isValid
        ? 'PASS ✅'
        : 'FAIL ❌'
    }`,
  );
}

console.log(
  `\nChunk size test: ${
    sizeTestPassed
      ? 'PASS ✅'
      : 'FAIL ❌'
  }`,
);

/*
 * -------------------------------------------------------
 * PAGE METADATA TEST
 * -------------------------------------------------------
 *
 * Every chunk must contain at least one page number.
 *
 * This is important because later we will use this
 * metadata to generate citations.
 */

console.log(
  '\n========== PAGE METADATA TEST ==========',
);

let pageTestPassed = true;

for (let i = 0; i < chunks.length; i++) {
  const chunk = chunks[i];

  if (!chunk) {
    continue;
  }

  const hasPages =
    chunk.pageNumbers.length > 0;

  if (!hasPages) {
    pageTestPassed = false;
  }

  console.log(
    `Chunk ${i}: Pages [${
      chunk.pageNumbers.join(', ')
    }] → ${
      hasPages
        ? 'PASS ✅'
        : 'FAIL ❌'
    }`,
  );
}

console.log(
  `\nPage metadata test: ${
    pageTestPassed
      ? 'PASS ✅'
      : 'FAIL ❌'
  }`,
);

/*
 * -------------------------------------------------------
 * SENTENCE OVERLAP TEST
 * -------------------------------------------------------
 *
 * The chunker uses sentence-aware overlap.
 *
 * We therefore don't require an exact 100-token
 * overlap.
 *
 * Instead, we verify that one or more complete sentences
 * from the end of the previous chunk also appear at the
 * beginning of the next chunk.
 */

function normalizeSentence(
  sentence: string,
): string {
  return sentence
    .replace(/\s+/g, ' ')
    .trim();
}

function getSentences(
  content: string,
): string[] {
  return content
    .split(/(?<=[.!?])\s+/)
    .map(normalizeSentence)
    .filter(Boolean);
}

console.log(
  '\n========== SENTENCE OVERLAP TEST ==========',
);

let overlapTestPassed = true;

for (
  let i = 0;
  i < chunks.length - 1;
  i++
) {
  const current = chunks[i];
  const next = chunks[i + 1];

  if (!current || !next) {
    continue;
  }

  const currentSentences =
    getSentences(current.content);

  const nextSentences =
    getSentences(next.content);

  /*
   * Look at the last 10 sentences of the current
   * chunk and the first 10 sentences of the next
   * chunk.
   */

  const currentEndSentences =
    currentSentences.slice(-10);

  const nextStartSentences =
    nextSentences.slice(0, 10);

  const overlappingSentences =
    currentEndSentences.filter(
      (sentence) =>
        nextStartSentences.includes(sentence),
    );

  const overlapCount =
    overlappingSentences.length;

  const passed =
    overlapCount > 0;

  if (!passed) {
    overlapTestPassed = false;
  }

  console.log(
    `Chunk ${i} → ${i + 1}: ` +
    `${overlapCount} overlapping sentences → ` +
    `${
      passed
        ? 'PASS ✅'
        : 'FAIL ❌'
    }`,
  );

  if (overlapCount > 0) {
    console.log(
      '  Overlap:',
    );

    for (
      const sentence of overlappingSentences
    ) {
      console.log(
        `  - ${sentence}`,
      );
    }
  }
}

console.log(
  `\nSentence overlap test: ${
    overlapTestPassed
      ? 'PASS ✅'
      : 'FAIL ❌'
  }`,
);

/*
 * -------------------------------------------------------
 * FINAL RESULT
 * -------------------------------------------------------
 */

const allPassed =
  chunks.length > 1 &&
  sizeTestPassed &&
  pageTestPassed &&
  overlapTestPassed;

console.log(
  '\n========================================',
);

console.log(
  `FINAL RESULT: ${
    allPassed
      ? 'PASS ✅'
      : 'FAIL ❌'
  }`,
);

console.log(
  '========================================',
);
