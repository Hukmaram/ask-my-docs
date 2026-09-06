import { OllamaClient } from '../src/llm/ollama.client.js';

const llm = new OllamaClient();

const prompt = `
Answer this question in one short paragraph.

Question:
How does retrieval augmented generation improve knowledge intensive NLP tasks?

Use only this information:

Retrieval-Augmented Generation combines a pre-trained
sequence-to-sequence model with a dense vector index containing
external knowledge. The retrieved documents are provided as
additional context to the generator. The RAG paper reports that
RAG models achieve strong results on knowledge-intensive NLP
tasks and generate more specific, diverse, and factual language
than a parametric-only baseline.

Answer directly. Do not discuss the question itself.
`;

const answer = await llm.generate(prompt);

console.log('\n===== LLM ANSWER =====\n');
console.log(answer);