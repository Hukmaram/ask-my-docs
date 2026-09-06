import type { RetrievalResult } from '../types/retrieval.js';

export function buildRagPrompt(
  query: string,
  sources: RetrievalResult[],
): string {
  const context = sources
    .map((source, index) => {
      const sourceNumber = index + 1;

      return `
SOURCE_${sourceNumber}:
${source.chunk.content}
`.trim();
    })
    .join('\n\n');

  return `
You answer questions about research papers.

Use ONLY the provided sources.

IMPORTANT:
Every sentence containing information from a source MUST end with
[SOURCE_1] or [SOURCE_2].

Example:
RAG combines parametric and non-parametric memory for generation. [SOURCE_1]

Another example:
RAG achieved state-of-the-art results on several open-domain QA tasks. [SOURCE_2]

NEVER use [1], [2], [3].
NEVER write "Source 1" or "Source 2".
ONLY use citations in this exact format:
[SOURCE_1]
[SOURCE_2]

QUESTION:
${query}

${context}

Write 1-3 short paragraphs.
Write ONLY the answer.
`.trim();
}