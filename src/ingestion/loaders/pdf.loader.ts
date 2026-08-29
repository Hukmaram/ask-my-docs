import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

import type { DocumentPage } from '../../types/document.js';

interface PositionedTextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hasEOL: boolean;
}

interface TextLine {
  items: PositionedTextItem[];
  y: number;
  minX: number;
  maxX: number;
  height: number;
}

interface Column {
  minX: number;
  maxX: number;
  lines: TextLine[];
}

const LINE_Y_TOLERANCE = 3;

/*
 * A line occupying more than this percentage of the
 * page width is considered full-width content (title,
 * authors, abstract, section headings, captions, etc).
 */
const FULL_WIDTH_RATIO = 0.75;

/*
 * Minimum number of rows required before we even
 * attempt two-column detection on a page.
 */
const MIN_COLUMN_LINES = 8;

/*
 * Minimum horizontal gap between items that we're
 * willing to treat as a column gutter (as opposed to
 * ordinary inter-word spacing).
 */
const MIN_COLUMN_GAP = 20;

/*
 * How far (in PDF points) a row's internal gap may sit
 * from the page's detected gutter position and still be
 * treated as *that* gutter, rather than an unrelated gap
 * (e.g. spacing in an author list or a table).
 */
const GUTTER_TOLERANCE = 60;

export class PdfLoader {
  async load(buffer: Buffer): Promise<DocumentPage[]> {
    const pdf = await getDocument({
      data: new Uint8Array(buffer),
      standardFontDataUrl: `${process.cwd()}/node_modules/pdfjs-dist/standard_fonts/`,
    }).promise;

    const pages: DocumentPage[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();

      const items: PositionedTextItem[] = textContent.items
        .filter(
          (
            item,
          ): item is typeof item & {
            str: string;
            transform: number[];
            width: number;
            height: number;
            hasEOL: boolean;
          } => 'str' in item,
        )
        .map((item) => ({
          text: item.str,
          x: item.transform[4] ?? 0,
          y: item.transform[5] ?? 0,
          width: item.width ?? 0,
          height: item.height ?? 0,
          hasEOL: item.hasEOL ?? false,
        }))
        .filter((item) => item.text.trim().length > 0);

      const content = this.extractText(items);

      pages.push({ pageNumber, content });
    }

    return pages;
  }

  private extractText(items: PositionedTextItem[]): string {
    if (items.length === 0) {
      return '';
    }

    /*
     * Step 1: group items into visual rows by y-position only.
     *
     * IMPORTANT: at this stage a "row" can legitimately contain
     * items from BOTH columns of a two-column page, since both
     * columns commonly have text sitting at the same y-coordinate.
     * We deliberately do NOT try to build final reading-order lines
     * here - that happens after we know where the column gutter is.
     */
    const rows = this.buildRows(items);

    if (rows.length < MIN_COLUMN_LINES) {
      return normalizeText(this.renderLines(rows));
    }

    const pageMinX = Math.min(...rows.map((row) => row.minX));
    const pageMaxX = Math.max(...rows.map((row) => row.maxX));
    const pageWidth = pageMaxX - pageMinX;

    const gutterX =
      pageWidth > 0 ? this.computeGutterX(rows, pageWidth) : null;

    if (gutterX === null) {
      // No consistent column gutter found anywhere on the page.
      return normalizeText(this.renderLines(rows));
    }

    const { leftLines, rightLines, fullWidthLines } =
      this.splitRowsAtGutter(rows, gutterX, pageWidth);

    if (
      leftLines.length < MIN_COLUMN_LINES ||
      rightLines.length < MIN_COLUMN_LINES
    ) {
      // Not a genuine two-column page - fall back to plain top-to-bottom order.
      return normalizeText(this.renderLines(rows));
    }

    return normalizeText(
      this.renderTwoColumnPage(fullWidthLines, [
        this.createColumn(leftLines),
        this.createColumn(rightLines),
      ]),
    );
  }

  /**
   * Group PDF text items into visual rows purely by y-position.
   * Rows are NOT yet assigned to a column.
   */
  private buildRows(items: PositionedTextItem[]): TextLine[] {
    const sorted = [...items].sort((a, b) => {
      const yDifference = b.y - a.y;

      if (Math.abs(yDifference) > LINE_Y_TOLERANCE) {
        return yDifference;
      }

      return a.x - b.x;
    });

    const rows: TextLine[] = [];

    for (const item of sorted) {
      let targetRow: TextLine | undefined;

      for (const row of rows) {
        if (Math.abs(row.y - item.y) <= LINE_Y_TOLERANCE) {
          targetRow = row;
          break;
        }
      }

      if (!targetRow) {
        rows.push({
          items: [item],
          y: item.y,
          minX: item.x,
          maxX: item.x + item.width,
          height: item.height,
        });

        continue;
      }

      targetRow.items.push(item);
      targetRow.minX = Math.min(targetRow.minX, item.x);
      targetRow.maxX = Math.max(targetRow.maxX, item.x + item.width);
      targetRow.height = Math.max(targetRow.height, item.height);
    }

    for (const row of rows) {
      row.items.sort((a, b) => a.x - b.x);
    }

    return rows.sort((a, b) => b.y - a.y);
  }

  /**
   * Find the page's column gutter (if any) by looking at the
   * largest internal horizontal gap in every sufficiently wide row,
   * then taking the median of those gap midpoints.
   *
   * Only rows that already span at least half the page are
   * considered, since those are the rows most likely to contain
   * text from both columns (and therefore reveal where the true
   * gutter sits). Narrow rows near the gutter width would just add
   * noise.
   */
  private computeGutterX(
    rows: TextLine[],
    pageWidth: number,
  ): number | null {
    const gapMidpoints: number[] = [];

    for (const row of rows) {
      if (row.items.length < 2) {
        continue;
      }

      if (row.maxX - row.minX < pageWidth * 0.5) {
        continue;
      }

      let bestGap = 0;
      let bestMid = 0;

      for (let i = 0; i < row.items.length - 1; i++) {
        const current = row.items[i];
        const next = row.items[i + 1];

        if (!current || !next) {
          continue;
        }

        const gap = next.x - (current.x + current.width);

        if (gap > bestGap) {
          bestGap = gap;
          bestMid = (current.x + current.width + next.x) / 2;
        }
      }

      if (bestGap >= MIN_COLUMN_GAP) {
        gapMidpoints.push(bestMid);
      }
    }

    if (gapMidpoints.length < MIN_COLUMN_LINES) {
      return null;
    }

    gapMidpoints.sort((a, b) => a - b);

    const mid = Math.floor(gapMidpoints.length / 2);

    const median =
      gapMidpoints.length % 2 === 0
        ? ((gapMidpoints[mid - 1] ?? 0) + (gapMidpoints[mid] ?? 0)) / 2
        : (gapMidpoints[mid] ?? 0);

    return median;
  }

  /**
   * Split every row at the detected gutter, BEFORE any line text is
   * built. A row is only split when it has an internal gap that is
   * both wide enough (>= MIN_COLUMN_GAP) and close enough to the
   * page's gutter position (within GUTTER_TOLERANCE) - this avoids
   * mistaking ordinary wide inter-word spacing (e.g. in an author
   * list) for a column break.
   *
   * Rows with no qualifying gap are kept whole and classified as
   * full-width (title/heading/caption) or assigned to whichever
   * column their center falls on.
   */
  private splitRowsAtGutter(
    rows: TextLine[],
    gutterX: number,
    pageWidth: number,
  ): {
    leftLines: TextLine[];
    rightLines: TextLine[];
    fullWidthLines: TextLine[];
  } {
    const leftLines: TextLine[] = [];
    const rightLines: TextLine[] = [];
    const fullWidthLines: TextLine[] = [];

    for (const row of rows) {
      let splitIndex = -1;
      let splitGap = 0;

      for (let i = 0; i < row.items.length - 1; i++) {
        const current = row.items[i];
        const next = row.items[i + 1];

        if (!current || !next) {
          continue;
        }

        const gap = next.x - (current.x + current.width);

        if (gap < MIN_COLUMN_GAP) {
          continue;
        }

        const gapMid = (current.x + current.width + next.x) / 2;

        if (
          Math.abs(gapMid - gutterX) <= GUTTER_TOLERANCE &&
          gap > splitGap
        ) {
          splitGap = gap;
          splitIndex = i;
        }
      }

      if (splitIndex >= 0) {
        const leftItems = row.items.slice(0, splitIndex + 1);
        const rightItems = row.items.slice(splitIndex + 1);

        leftLines.push(this.rowFromItems(leftItems));
        rightLines.push(this.rowFromItems(rightItems));

        continue;
      }

      if (row.maxX - row.minX >= pageWidth * FULL_WIDTH_RATIO) {
        fullWidthLines.push(row);
        continue;
      }

      const centerX = (row.minX + row.maxX) / 2;

      if (centerX < gutterX) {
        leftLines.push(row);
      } else {
        rightLines.push(row);
      }
    }

    return { leftLines, rightLines, fullWidthLines };
  }

  private rowFromItems(items: PositionedTextItem[]): TextLine {
    return {
      items,
      y: items[0]?.y ?? 0,
      minX: Math.min(...items.map((item) => item.x)),
      maxX: Math.max(...items.map((item) => item.x + item.width)),
      height: Math.max(...items.map((item) => item.height)),
    };
  }

  private createColumn(lines: TextLine[]): Column {
    return {
      minX:
        lines.length > 0 ? Math.min(...lines.map((line) => line.minX)) : 0,
      maxX:
        lines.length > 0 ? Math.max(...lines.map((line) => line.maxX)) : 0,
      lines: [...lines].sort((a, b) => b.y - a.y),
    };
  }

  /**
   * Render a two-column page in reading order:
   *
   *     full-width header (title / authors / abstract)
   *     left column, top to bottom
   *     right column, top to bottom
   *     any trailing full-width content (footnotes, page number)
   */
  private renderTwoColumnPage(
    fullWidthLines: TextLine[],
    columns: Column[],
  ): string {
    const orderedColumns = [...columns].sort((a, b) => a.minX - b.minX);

    const parts: string[] = [];

    const columnYs = orderedColumns.flatMap((column) =>
      column.lines.map((line) => line.y),
    );
    const topOfColumns = columnYs.length > 0 ? Math.max(...columnYs) : -Infinity;

    const topFullWidth = fullWidthLines
      .filter((line) => line.y > topOfColumns)
      .sort((a, b) => b.y - a.y);

    if (topFullWidth.length > 0) {
      parts.push(this.renderLines(topFullWidth));
    }

    const leftColumn = orderedColumns[0];

    if (leftColumn) {
      parts.push(this.renderLines(leftColumn.lines));
    }

    const rightColumn = orderedColumns[1];

    if (rightColumn) {
      parts.push(this.renderLines(rightColumn.lines));
    }

    const remainingFullWidth = fullWidthLines
      .filter((line) => !topFullWidth.includes(line))
      .sort((a, b) => b.y - a.y);

    if (remainingFullWidth.length > 0) {
      parts.push(this.renderLines(remainingFullWidth));
    }

    return parts.join('\n\n');
  }

  private renderLines(lines: TextLine[]): string {
    return [...lines]
      .sort((a, b) => b.y - a.y)
      .map((line) => this.buildLineText(line))
      .filter((line) => line.length > 0)
      .join('\n');
  }

  /**
   * Reconstruct text within a single line/row.
   */
  private buildLineText(line: TextLine): string {
    let text = '';

    for (let i = 0; i < line.items.length; i++) {
      const item = line.items[i];

      if (!item) {
        continue;
      }

      const previous = line.items[i - 1];

      if (previous && this.needsSpace(previous, item)) {
        text += ' ';
      }

      text += item.text;
    }

    return text.trim();
  }

  private needsSpace(
    previous: PositionedTextItem,
    current: PositionedTextItem,
  ): boolean {
    /*
     * PDF line wrapping:
     *
     * know-
     * ledge
     *
     * is handled later by normalizeText().
     */
    if (previous.text.endsWith('-')) {
      return false;
    }

    if (/^[.,;:!?%)\]}]/.test(current.text)) {
      return false;
    }

    if (/[(\[{]$/.test(previous.text)) {
      return false;
    }

    const previousEnd = previous.x + previous.width;
    const gap = current.x - previousEnd;

    return gap > 1;
  }
}

function normalizeText(value: string): string {
  return (
    value
      /*
       * Fix words split by a PDF line break:
       *
       * know-
       * ledge
       *
       * -> knowledge
       */
      .replace(/(\p{L})-\s*\n\s*(\p{L})/gu, '$1$2')

      /*
       * Convert ordinary visual line breaks into spaces.
       */
      .replace(/(?<!\n)\n(?!\n)/g, ' ')

      /*
       * Remove spaces before punctuation.
       */
      .replace(/\s+([.,;:!?%)\]}])/g, '$1')

      /*
       * Remove spaces after opening punctuation.
       */
      .replace(/([(\[{])\s+/g, '$1')

      /*
       * Collapse repeated spaces.
       */
      .replace(/[ \t]+/g, ' ')

      /*
       * Preserve paragraph boundaries.
       */
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}