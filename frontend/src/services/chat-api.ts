import type { AskMyDocsResponse, ChatRequest } from '../types/chat.js';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');

export class ChatApiError extends Error {
  public statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'ChatApiError';
    this.statusCode = statusCode;
  }
}

export async function askQuestion(query: string): Promise<AskMyDocsResponse> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new ChatApiError('Please enter a question before asking.');
  }

  const payload: ChatRequest = { query: trimmed };

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw new ChatApiError(
      `Failed to connect to the backend server at ${API_BASE_URL}. Ensure the NestJS server is running. (${err instanceof Error ? err.message : String(err)})`,
    );
  }

  if (!response.ok) {
    let errorDetails = `Request failed with status ${response.status}`;
    try {
      const errorJson = await response.json();
      if (errorJson && typeof errorJson === 'object') {
        errorDetails = (errorJson as { message?: string }).message || errorDetails;
      }
    } catch {
      // ignore json parse error on non-json error responses
    }
    throw new ChatApiError(errorDetails, response.status);
  }

  const data = (await response.json()) as AskMyDocsResponse;
  return data;
}
