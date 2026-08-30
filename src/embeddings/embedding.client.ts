const OLLAMA_URL = 'http://localhost:11434/api/embed';
export const EMBEDDING_MODEL = 'nomic-embed-text';

export class EmbeddingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmbeddingError';
  }
}

interface OllamaEmbeddingResponse {
  embeddings: number[][];
}


export class EmbeddingClient{
     async embed(text: string): Promise<number[]> {
    if (!text.trim()) {
      throw new EmbeddingError(
        'Cannot create embedding for empty text',
      );
    }
    try {
      const response = await fetch(OLLAMA_URL, {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: text,
        }),
      });

      if (!response.ok) {
        throw new EmbeddingError(
          `Ollama embedding request failed: ` +
          `${response.status} ${response.statusText}`,
        );
      }
      const data =
        (await response.json()) as OllamaEmbeddingResponse;

         const embedding = data.embeddings?.[0];

         if (!embedding || embedding.length === 0) {
        throw new EmbeddingError(
          'Ollama returned an empty embedding',
        );
      }
      return embedding;
    }
    catch (error) {
      if (error instanceof EmbeddingError) {
        throw error;
      }

      throw new EmbeddingError(
        `Embedding failed: ${
          error instanceof Error
            ? error.message
            : 'Unknown error'
        }`,
      );
    }
  }
  async embedMany(
    texts: string[],
  ): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }try {
      const response = await fetch(OLLAMA_URL, {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: texts,
        }),
      });

      if (!response.ok) {
        throw new EmbeddingError(
          `Ollama embedding request failed: ` +
          `${response.status} ${response.statusText}`,
        );
      }

      const data =
        (await response.json()) as OllamaEmbeddingResponse;

      if (
        !data.embeddings ||
        data.embeddings.length !== texts.length
      ) {
        throw new EmbeddingError(
          'Ollama returned an unexpected number of embeddings',
        );
      }

      return data.embeddings;
    } catch (error) {
      if (error instanceof EmbeddingError) {
        throw error;
      }

      throw new EmbeddingError(
        `Batch embedding failed: ${
          error instanceof Error
            ? error.message
            : 'Unknown error'
        }`,
      );
    }
  }


}