import { RetrievalResult } from "../../types/retrieval.js";


export interface CitationValidationResult {
  valid: boolean;
  citations: string[];
  invalidCitations: string[];
  missingCitations: boolean;
}

export function validateCitations(
  answer: string,
  sources: RetrievalResult[],
): CitationValidationResult {
  const citationPattern = /\[SOURCE_(\d+)\]/g;

  const matches = [...answer.matchAll(citationPattern)];

  const citations = [
    ...new Set(matches.map((match) => `SOURCE_${match[1]}`)),
  ];

  const invalidCitations = citations.filter((citation) => {
    const sourceNumber = Number(
      citation.replace('SOURCE_', ''),
    );

    return (
      !Number.isInteger(sourceNumber) ||
      sourceNumber < 1 ||
      sourceNumber > sources.length
    );
  });

  const sentences = answer
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const factualSentencesWithoutCitation = sentences.filter(
    (sentence) => !sentence.includes('[SOURCE_'),
  );

  const missingCitations =
    factualSentencesWithoutCitation.length > 0;

  return {
    valid:
      citations.length > 0 &&
      invalidCitations.length === 0 &&
      !missingCitations,

    citations,
    invalidCitations,
    missingCitations,
  };
}