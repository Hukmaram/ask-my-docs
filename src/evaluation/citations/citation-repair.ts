import type { RetrievalResult } from '../../types/retrieval.js';

/**
 * Repairs missing citations without changing the answer content.
 *
 * Important:
 * - Does NOT call the LLM.
 * - Does NOT add factual information.
 * - Does NOT remove factual information.
 * - Does NOT rewrite sentences.
 * - Only propagates an existing citation to nearby uncited sentences.
 *
 * If no citation exists before an uncited sentence, the sentence
 * is left unchanged. The citation validator will then fail safely.
 */
export function repairCitations(
  answer: string,
  _sources: RetrievalResult[],
): string {
  const sentences = splitSentences(answer);

  let lastCitation: string | undefined;

  const repaired = sentences.map((sentence) => {
    const citationMatch = sentence.match(
      /\[SOURCE_(\d+)\]/,
    );

    // The sentence already has a citation.
    if (citationMatch) {
      lastCitation = citationMatch[0];
      return sentence;
    }

    // If we have already seen a citation, propagate it.
    if (lastCitation) {
      return `${sentence} ${lastCitation}`;
    }

    // No citation is available yet.
    // Do not guess which source supports the sentence.
    return sentence;
  });

  return repaired.join(' ');
}

function splitSentences(answer: string): string[] {
  return answer
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}
