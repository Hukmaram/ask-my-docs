import { XMLParser } from 'fast-xml-parser';
import type { ArxivPaper } from '../../types/arxiv.js';



const ARXIV_API_URL = 'https://export.arxiv.org/api/query';
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3_000;

class ArxivPaperNotFoundError extends Error {
  constructor(paperId: string) {
    super(`arXiv paper not found: ${paperId}`);
    this.name = 'ArxivPaperNotFoundError';
  }
}

class ArxivApiError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class ArxivClient {
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
  });

  async getPaper(paperId: string): Promise<ArxivPaper> {
    const url = new URL(ARXIV_API_URL);

    url.searchParams.set('search_query', `id:${paperId}`);
    url.searchParams.set('max_results', '1');

    const response = await this.fetchWithRetry(url);

    const xml = await response.text();

    const parsed = this.parser.parse(xml);

    const entry = parsed.feed?.entry;

    if (!entry) {
      throw new ArxivPaperNotFoundError(paperId);
    }

    const authors = Array.isArray(entry.author) ? entry.author : [entry.author];

    const pdfLink = Array.isArray(entry.link)
      ? entry.link.find((link: { '@_title'?: string }) => link['@_title'] === 'pdf')
      : undefined;

    if (!pdfLink?.['@_href']) {
      throw new ArxivApiError(`PDF URL not found for arXiv paper: ${paperId}`);
    }

    return {
      id: extractArxivId(entry.id),
      title: normalizeWhitespace(entry.title),
      authors: authors.map((author: { name: string }) => normalizeWhitespace(author.name)),
      abstract: normalizeWhitespace(entry.summary),
      publishedAt: entry.published,
      updatedAt: entry.updated,
      pdfUrl: pdfLink['@_href'],
    };
  }

private async fetchWithRetry(url: URL): Promise<Response> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await this.fetchWithTimeout(url);

      if (response.ok) {
        return response;
      }

      if (!this.isRetryableStatus(response.status)) {
        throw new ArxivApiError(
          `arXiv API request failed: ${response.status} ${response.statusText}`,
        );
      }

      if (attempt === MAX_RETRIES) {
        throw new ArxivApiError(
          `arXiv API request failed after ${attempt + 1} attempts: ${response.status} ${response.statusText}`,
        );
      }

      const retryAfter = response.headers.get('retry-after');

      const delayMs = retryAfter
        ? Number(retryAfter) * 1000
        : RETRY_DELAY_MS * 2 ** attempt;

      console.log(
        `arXiv request failed (${response.status}). ` +
        `Retrying in ${delayMs / 1000}s...`,
      );

      await this.delay(delayMs);
    } catch (error) {
      if (error instanceof ArxivApiError) {
        throw error;
      }

      if (attempt === MAX_RETRIES) {
        const message =
          error instanceof Error ? error.message : String(error);

        throw new ArxivApiError(
          `arXiv API request failed after ${attempt + 1} attempts: ${message}`,
        );
      }

      console.log(
        `arXiv request error: ${
          error instanceof Error ? error.message : String(error)
        }. Retrying...`,
      );

      await this.delay(RETRY_DELAY_MS * 2 ** attempt);
    }
  }

  throw new ArxivApiError('Unexpected retry state');
}

  private async fetchWithTimeout(url: URL): Promise<Response> {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      return await fetch(url, {
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private isRetryableStatus(status: number): boolean {
    return status === 429 || status >= 500;
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

function extractArxivId(id: string): string {
  return id.split('/abs/').pop() ?? id;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
