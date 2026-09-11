import { RetrievalResult } from "../../types/retrieval.js";

export interface CitationValidationResult {
  valid: boolean;
  citations: string[];
  invalidCitations: string[];
  missingCitations: boolean;
  uncitedSentences: string[];
}

export function validateCitations(
  answer: string,
  sources: RetrievalResult[],
): CitationValidationResult {
  const citationPattern = /\[SOURCE_(\d+)\]/g;

  const matches = [...answer.matchAll(citationPattern)];

  const citations = [
    ...new Set(
      matches.map(
        (match) => `SOURCE_${match[1]}`,
      ),
    ),
  ];

  const invalidCitations = citations.filter(
    (citation) => {
      const sourceNumber = Number(
        citation.replace('SOURCE_', ''),
      );

      return (
        sourceNumber < 1 ||
        sourceNumber > sources.length
      );
    },
  );

  const sentences =
    splitSentencesWithCitations(answer);

  const uncitedSentences =
    sentences.filter(
      (sentence) =>
        !/\[SOURCE_\d+\]/.test(sentence),
    );

  const missingCitations =
    uncitedSentences.length > 0;

  return {
    valid:
      citations.length > 0 &&
      invalidCitations.length === 0 &&
      !missingCitations,

    citations,

    invalidCitations,

    missingCitations,

    uncitedSentences,
  };
}

/**
 * Splits sentences while keeping a trailing
 * citation attached to the sentence.
 *
 * Example:
 *
 * "RAG uses retrieval. [SOURCE_1]"
 *
 * becomes ONE sentence instead of:
 *
 * "RAG uses retrieval."
 * "[SOURCE_1]"
 */
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