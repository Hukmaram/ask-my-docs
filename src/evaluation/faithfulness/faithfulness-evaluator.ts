import { OllamaClient } from "../../llm/ollama.client.js";
import { RetrievalResult } from "../../types/retrieval.js";

export interface FaithfulnessClaim {
  claim: string;
  citations: string[];
  supported: boolean;
  explanation: string;
}

export interface FaithfulnessResult {
  score: number;
  claims: FaithfulnessClaim[];
}

export class FaithfulnessEvaluator {
  constructor(
    private readonly llm = new OllamaClient(),
  ) {}

  async evaluate(
    answer: string,
    sources: RetrievalResult[],
  ): Promise<FaithfulnessResult> {
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
You are evaluating the factual faithfulness of an answer.

A claim is faithful ONLY if the cited source explicitly supports
the claim.

Do not use outside knowledge.

For every factual claim:
1. Extract the claim.
2. Identify its citation.
3. Decide whether the cited source supports it.
4. Give a short explanation.

Return ONLY valid JSON in this exact format:

{
  "claims": [
    {
      "claim": "string",
      "citations": ["SOURCE_1"],
      "supported": true,
      "explanation": "string"
    }
  ]
}

Rules:
- citations must use SOURCE_N without brackets.
- supported must be true or false.
- Do not infer information that is not stated in the sources.
- If the source only partially supports the claim, mark it false.
- Ignore purely stylistic statements.
- Do not add claims that are not present in the answer.

ANSWER:
${answer}

SOURCES:
${context}
`.trim();

    const response = await this.llm.generate(prompt);

    return this.parseResponse(response);
  }

  private parseResponse(
    response: string,
  ): FaithfulnessResult {
    const json = this.extractJson(response);

    const parsed = JSON.parse(json) as {
      claims: FaithfulnessClaim[];
    };

    const claims = parsed.claims;

    const score =
      claims.length === 0
        ? 1
        : claims.filter((claim) => claim.supported).length /
          claims.length;

    return {
      score,
      claims,
    };
  }

  private extractJson(response: string): string {
    const start = response.indexOf('{');
    const end = response.lastIndexOf('}');

    if (start === -1 || end === -1 || end <= start) {
      throw new Error(
        'Faithfulness evaluator did not return valid JSON',
      );
    }

    return response.slice(start, end + 1);
  }
}