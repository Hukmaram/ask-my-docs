
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { PdfLoader } from '../src/ingestion/loaders/pdf.loader.js';

const PDF_PATH = path.resolve(
  'data/raw/DPR.pdf',
);

const OUTPUT_PATH = path.resolve(
  'data/processed/pdf-loader-test.json',
);

const pdfBuffer =
  await readFile(PDF_PATH);

const loader =
  new PdfLoader();

const pages =
  await loader.load(pdfBuffer);

const result = {
  pdf: PDF_PATH,
  totalPages: pages.length,
  pages: pages.map((page) => ({
    pageNumber: page.pageNumber,
    characters:
      page.content.length,
    content:
      page.content,
  })),
};

await import('node:fs/promises').then(
  ({ writeFile, mkdir }) =>
    mkdir(
      path.dirname(OUTPUT_PATH),
      { recursive: true },
    ).then(() =>
      writeFile(
        OUTPUT_PATH,
        JSON.stringify(
          result,
          null,
          2,
        ),
        'utf-8',
      ),
    ),
);

console.log(
  `PDF loader test complete.`,
);

console.log(
  `Pages: ${pages.length}`,
);

console.log(
  `Output: ${OUTPUT_PATH}`,
);
