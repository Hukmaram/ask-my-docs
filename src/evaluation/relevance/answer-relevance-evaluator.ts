import { OllamaClient } from '../../llm/ollama.client.js';
export interface AnswerRelevanceResult {
  score: number;
  explanation: string;
}
export class AnswerRelevanceEvaluator {
  constructor(private readonly llm = new OllamaClient()) {}
  async evaluate(question: string, answer: string): Promise<AnswerRelevanceResult> {
    const prompt =
      ` You are evaluating the relevance of an answer to a question. Your ONLY job is to determine whether the answer directly and appropriately addresses the question. Do NOT evaluate factual correctness. Do NOT evaluate whether the answer is supported by sources. Do NOT use outside knowledge. Evaluate ONLY how well the answer addresses the question. Scoring criteria: 1. 1.0 = The answer directly and completely answers the question. 2. 0.75 = The answer answers the question but contains some unnecessary information or minor omissions. 3. 0.5 = The answer partially addresses the question. 4. 0.25 = The answer is mostly unrelated to the question. 5. 0.0 = The answer does not answer the question at all. Return ONLY valid JSON in this exact format: { "score": 0.0, "explanation": "short explanation" } Rules: - score MUST be one of: 0, 0.25, 0.5, 0.75, 1. - Do not evaluate factual correctness. - Do not evaluate citation correctness. - Do not penalize the answer merely because it is short. - Penalize unnecessary information when it distracts from the question. - Do not add any fields. - Return ONLY the JSON object. QUESTION: ${question} ANSWER: ${answer} `.trim();
    const response = await this.llm.generate(prompt);
    return this.parseResponse(response);
  }
  private parseResponse(response: string): AnswerRelevanceResult {
    const json = this.extractJson(response);
    const parsed = JSON.parse(json) as { score: number; explanation: string };
    if (![0, 0.25, 0.5, 0.75, 1].includes(parsed.score)) {
      throw new Error(`Invalid relevance score: ${parsed.score}`);
    }
    return { score: parsed.score, explanation: parsed.explanation };
  }
  private extractJson(response: string): string {
    const start = response.indexOf('{');
    const end = response.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      throw new Error('Answer relevance evaluator did not return valid JSON');
    }
    return response.slice(start, end + 1);
  }
}
