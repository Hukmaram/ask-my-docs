const PDF_DOWNLOAD_TIMEOUT_MS = 30_000;

export class PdfDownloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PdfDownloadError';
  }
}

export class PdfDownloader {
  async download(url: string): Promise<Buffer> {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, PDF_DOWNLOAD_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new PdfDownloadError(
          `PDF download failed: ${response.status} ${response.statusText}`,
        );
      }

      const contentType = response.headers.get('content-type');

      if (contentType && !contentType.includes('application/pdf')) {
        throw new PdfDownloadError(
          `Expected a PDF but received: ${contentType}`,
        );
      }

      const arrayBuffer = await response.arrayBuffer();

      return Buffer.from(arrayBuffer);
    } catch (error) {
      if (error instanceof PdfDownloadError) {
        throw error;
      }

      throw new PdfDownloadError(
        `PDF download failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}