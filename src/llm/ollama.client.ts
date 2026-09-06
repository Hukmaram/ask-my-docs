const OLLAMA_URL =
  'http://localhost:11434';

const MODEL =
  'llama3.2:latest';

interface OllamaGenerateResponse {
  response: string;
  done: boolean;
}

export class OllamaClient {
  constructor(
    private readonly baseUrl = OLLAMA_URL,
    private readonly model = MODEL,
  ) {}

  async generate(
    prompt: string,
  ): Promise<string> {
    const response = await fetch(
      `${this.baseUrl}/api/generate`,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          options: {
            temperature: 0.1,
          },
        }),
      },
    );

    if (!response.ok) {
      const body =
        await response.text();

      throw new Error(
        `Ollama request failed: ` +
        `${response.status} ${body}`,
      );
    }

    const data =
      (await response.json()) as OllamaGenerateResponse;

    return data.response;
  }
}