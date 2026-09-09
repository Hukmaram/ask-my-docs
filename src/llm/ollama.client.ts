import {
  startActiveObservation,
} from '@langfuse/tracing';

const OLLAMA_URL = 'http://localhost:11434';
const MODEL = 'llama3.2:latest';

interface OllamaGenerateResponse {
  response: string;
  done: boolean;
}

export class OllamaClient {
  constructor(
    private readonly baseUrl = OLLAMA_URL,
    private readonly model = MODEL,
  ) {}

  async generate(prompt: string): Promise<string> {
    return startActiveObservation(
      'ollama-generation',
      async (generation) => {
        generation.update({
          input: {
            prompt,
          },
          metadata: {
            provider: 'ollama',
            model: this.model,
          },
        });

        try {
          const response = await fetch(
            `${this.baseUrl}/api/generate`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
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
            const body = await response.text();

            throw new Error(
              `Ollama request failed: ${response.status} ${body}`,
            );
          }

          const data =
            (await response.json()) as OllamaGenerateResponse;

          generation.update({
            output: {
              response: data.response,
            },
          });

          return data.response;
        } catch (error) {
          generation.update({
            metadata: {
              provider: 'ollama',
              model: this.model,
              error:
                error instanceof Error
                  ? error.message
                  : String(error),
            },
          });

          throw error;
        }
      },
      {
        asType: 'generation',
      },
    );
  }
}