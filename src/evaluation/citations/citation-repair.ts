import { OllamaClient } from "../../llm/ollama.client.js";
import { RetrievalResult } from "../../types/retrieval.js";


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

You are given an answer and the source documents used to generate it.

Your job is ONLY to add or correct citations.

IMPORTANT RULES:

- Do not change the meaning of the answer.
- Do not add new facts.
- Do not remove factual claims.
- Every factual sentence must end with a citation.
- Use ONLY citations that correspond to the provided sources.
- Valid citations are exactly:
  [SOURCE_1]
  [SOURCE_2]
- Never use [1], [2], [3].
- Never write "Source 1".
- If a sentence is supported by multiple sources, use multiple citations.
- If a sentence is not supported by the sources, remove that sentence.
- Return ONLY the repaired answer.

ANSWER:
${answer}

SOURCES:
${context}
`.trim();

  return llm.generate(prompt);
}