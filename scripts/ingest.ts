import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { loadPapersConfig } from '../src/config/papers.loader.js';
import { ArxivClient } from '../src/ingestion/sources/arxiv.client.js';
import { PdfDownloader } from '../src/ingestion/downloaders/pdf.downloader.js';
import { PdfLoader } from '../src/ingestion/loaders/pdf.loader.js';
import { DocumentChunker } from '../src/ingestion/chunkers/document.chunker.js';

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
     * CREATE PROCESSED DOCUMENT
     * ---------------------------------------------------
     *
     * We save everything we currently have.
     *
     * This is temporary persistence for inspecting the
     * ingestion pipeline.
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

      chunks,
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
      `${chunks.length} chunks`,
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

  //process.exit(1);
});

