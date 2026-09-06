import type { RetrievalResult } from '../../types/retrieval.js';
import { OllamaClient } from '../../llm/ollama.client.js';

export async function repairCitations(
  answer: string,
  sources: RetrievalResult[],
  llm: OllamaClient,
): Promise<string> {
  const context = sources
    .map((source, index) => {
      const sourceNumber = index + 1;

      return `
SOURCE_${sourceNumber}:
${source.chunk.content}
`.trim();
    })
    .join('\n\n');

  const prompt = `
You are a citation repair system.

Your ONLY job is to repair citations in the answer.

STRICT RULES:

1. Return the complete answer.
2. Do not change the meaning.
3. Do not add new factual information.
4. Do not remove factual information unless it is unsupported.
5. EVERY factual sentence MUST end with a citation.
6. Citations MUST use exactly [SOURCE_N].
7. Only use the provided sources.
8. If multiple sentences are supported by the same source,
   EACH sentence must have its own citation.
9. Do not combine sentences just to place one citation at the end.
10. Do not use [1], [2], [3].
11. Do not write "Source 1" or "Source 2".
12. Return ONLY the repaired answer.

IMPORTANT EXAMPLE:

INVALID:

RAG uses parametric and non-parametric memory. The parametric
memory is a seq2seq model [SOURCE_1].

VALID:

RAG uses parametric and non-parametric memory [SOURCE_1].
The parametric memory is a seq2seq model [SOURCE_1].

Another INVALID example:

RAG improves NLP tasks [SOURCE_1].
This allows models to access external knowledge.

VALID:

RAG improves NLP tasks [SOURCE_1].
This allows models to access external knowledge [SOURCE_1].

ANSWER:
${answer}

SOURCES:
${context}

Return ONLY the repaired answer.
`.trim();

  const repaired = await llm.generate(prompt);

  return enforceCitationPropagation(repaired);
}

function enforceCitationPropagation(
  answer: string,
): string {
  const sentences = answer
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  let lastCitation: string | undefined;

  const repaired = sentences.map((sentence) => {
    const citationMatch = sentence.match(
      /\[SOURCE_(\d+)\]/,
    );

    if (citationMatch) {
      lastCitation = `[SOURCE_${citationMatch[1]}]`;
      return sentence;
    }

    if (lastCitation) {
      return `${sentence} ${lastCitation}`;
    }

    return sentence;
  });

  return repaired.join(' ');
}