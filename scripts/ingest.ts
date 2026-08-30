import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { loadPapersConfig } from '../src/config/papers.loader.js';
import { ArxivClient } from '../src/ingestion/sources/arxiv.client.js';
import { PdfDownloader } from '../src/ingestion/downloaders/pdf.downloader.js';
import { PdfLoader } from '../src/ingestion/loaders/pdf.loader.js';
import { DocumentChunker } from '../src/ingestion/chunkers/document.chunker.js';
import { EmbeddingService } from '../src/embeddings/embedding.service.js';

const PROCESSED_DATA_DIR = path.resolve(
  'data/processed',
);

async function main(): Promise<void> {
  /*
   * -------------------------------------------------------
   * 1. LOAD CONFIGURATION
   * -------------------------------------------------------
   */

  const config = await loadPapersConfig();

  console.log(
    `Found ${config.papers.length} papers to ingest.`,
  );

  /*
   * -------------------------------------------------------
   * 2. CREATE SERVICES
   * -------------------------------------------------------
   */

  const arxivClient = new ArxivClient();

  const pdfDownloader = new PdfDownloader();

  const pdfLoader = new PdfLoader();

  const chunker = new DocumentChunker();

  const embeddingService =
    new EmbeddingService();

  /*
   * -------------------------------------------------------
   * 3. CREATE OUTPUT DIRECTORY
   * -------------------------------------------------------
   */

  await mkdir(
    PROCESSED_DATA_DIR,
    {
      recursive: true,
    },
  );

  /*
   * -------------------------------------------------------
   * 4. PROCESS EACH PAPER
   * -------------------------------------------------------
   */

  for (const paperConfig of config.papers) {
    console.log(
      `\nIngesting ${paperConfig.id}...`,
    );

    /*
     * ---------------------------------------------------
     * FETCH ARXIV METADATA
     * ---------------------------------------------------
     */

    const paper =
      await arxivClient.getPaper(
        paperConfig.id,
      );

    console.log(
      `Title: ${paper.title}`,
    );

    /*
     * ---------------------------------------------------
     * DOWNLOAD PDF
     * ---------------------------------------------------
     */

    const pdfBuffer =
      await pdfDownloader.download(
        paper.pdfUrl,
      );

    console.log(
      `Downloaded: ${pdfBuffer.length} bytes`,
    );

    /*
     * ---------------------------------------------------
     * LOAD PDF
     * ---------------------------------------------------
     *
     * PDF Buffer → DocumentPage[]
     */

    const pages =
      await pdfLoader.load(
        pdfBuffer,
      );

    console.log(
      `Pages: ${pages.length}`,
    );

    /*
     * ---------------------------------------------------
     * CHUNK DOCUMENT
     * ---------------------------------------------------
     *
     * DocumentPage[] → DocumentChunk[]
     */

    const chunks =
      chunker.chunk(
        paper.id,
        pages,
      );

    console.log(
      `Chunks: ${chunks.length}`,
    );

    /*
     * ---------------------------------------------------
     * CREATE EMBEDDINGS
     * ---------------------------------------------------
     *
     * DocumentChunk[] →
     * EmbeddedDocumentChunk[]
     *
     * Ollama generates a 768-dimensional
     * vector for every chunk.
     */

    console.log(
      'Generating embeddings with Ollama...',
    );

    const embeddedChunks =
      await embeddingService.embedChunks(
        chunks,
      );

    console.log(
      `Embeddings: ${embeddedChunks.length}`,
    );

    /*
     * ---------------------------------------------------
     * CREATE PROCESSED DOCUMENT
     * ---------------------------------------------------
     *
     * We save:
     *
     * - paper metadata
     * - extracted pages
     * - chunks
     * - embeddings
     */

    const result = {
      paper: {
        id: paper.id,
        title: paper.title,
        authors: paper.authors,
        abstract: paper.abstract,
        publishedAt: paper.publishedAt,
        updatedAt: paper.updatedAt,
        pdfUrl: paper.pdfUrl,
      },

      pages,

      chunks: embeddedChunks,
    };

    /*
     * ---------------------------------------------------
     * SAVE JSON
     * ---------------------------------------------------
     */

    const outputPath =
      path.join(
        PROCESSED_DATA_DIR,
        `${paper.id}.json`,
      );

    await writeFile(
      outputPath,
      JSON.stringify(
        result,
        null,
        2,
      ),
      'utf-8',
    );

    console.log(
      `Saved: ${outputPath}`,
    );

    /*
     * ---------------------------------------------------
     * SUMMARY
     * ---------------------------------------------------
     */

    console.log(
      `Completed ${paper.id}: ` +
      `${pages.length} pages → ` +
      `${chunks.length} chunks → ` +
      `${embeddedChunks.length} embeddings`,
    );
  }
}

/*
 * -------------------------------------------------------
 * ERROR HANDLING
 * -------------------------------------------------------
 */

main().catch((error: unknown) => {
  console.error(
    '\nIngestion failed:',
  );

  console.error(error);

  // process.exit(1);
});