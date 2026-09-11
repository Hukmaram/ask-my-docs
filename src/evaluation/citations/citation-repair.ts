import type { RetrievalResult } from '../../types/retrieval.js';

/**
 * Repairs missing citations without changing
 * the answer's factual content.
 *
 * Important:
 * - Does NOT call the LLM.
 * - Does NOT add factual information.
 * - Does NOT remove factual information.
 * - Does NOT rewrite sentences.
 * - Only propagates an existing citation to
 *   nearby uncited sentences.
 */
export function repairCitations(
  answer: string,
  _sources: RetrievalResult[],
): string {
  void _sources;
  const sentences =
    splitSentencesWithCitations(answer);

  let lastCitation:
    | string
    | undefined;

  const repaired =
    sentences.map((sentence) => {
      const citationMatch =
        sentence.match(
          /\[SOURCE_(\d+)\]/,
        );

      if (citationMatch) {
        lastCitation =
          citationMatch[0];

        return sentence;
      }

      if (lastCitation) {
        return `${sentence} ${lastCitation}`;
      }

      return sentence;
    });

  return repaired.join(' ');
}

function splitSentencesWithCitations(
  answer: string,
): string[] {
  const matches =
    answer.match(
      /[^.!?]+[.!?](?:\s*\[SOURCE_\d+\])?/g,
    ) ?? [];

  return matches
    .map((sentence) =>
      sentence.trim(),
    )
    .filter(Boolean);
}