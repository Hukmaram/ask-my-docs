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
const GUTTER_TOLERANCE = 70;

/*
 * Width of each bucket (in PDF points) used when scanning
 * for the empty vertical band that separates two columns.
 */
const GUTTER_BIN_WIDTH = 4;

/*
 * We only search for the gutter within the central portion
 * of the page, so that left/right page margins are never
 * mistaken for a column gutter.
 */
const GUTTER_SEARCH_MARGIN = 0.2;

/*
 * Minimum number of items required on a page before we
 * trust a gutter computed from it.
 */
const MIN_ITEMS_FOR_GUTTER = 20;

/*
 * A row must span at least this fraction of the page width to be
 * trusted as a genuine "both columns present" row when voting on
 * the gutter position. Centered header lines (title, authors) are
 * usually narrower than this even though they look wide.
 */
const GUTTER_VOTING_WIDTH_RATIO = 0.7;

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

    /*
     * Step 2: find the column gutter directly from raw item
     * positions - the widest completely empty vertical band in
     * the central part of the page. This does NOT depend on rows
     * lining up between columns, so it stays reliable even on
     * pages where the two columns drift out of sync (figures,
     * footnotes, uneven paragraph lengths, etc).
     */
    const pageMinX = Math.min(...items.map((item) => item.x));
    const pageMaxX = Math.max(
      ...items.map((item) => item.x + item.width),
    );

    const gutterX = this.computeGutterX(rows, pageMinX, pageMaxX);

    if (gutterX === null) {
      // No consistent column gutter found anywhere on the page.
      return normalizeText(this.renderLines(rows));
    }

    const pageWidth = pageMaxX - pageMinX;

    const { leftLines, rightLines, fullWidthLines } =
      this.splitRowsAtGutter(rows, gutterX, pageWidth);

    if (leftLines.length === 0 || rightLines.length === 0) {
      // Nothing meaningful landed on one side - not really a
      // two-column page. Falling back here is safe: we only
      // reach it when the gutter signal didn't actually produce
      // a real split, so the raw rows were never miscategorized.
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
   * Find the page's column gutter (if any) by scanning rows for
   * the widest vertical band that almost no row ever has text in.
   *
   * We deliberately weight by ROW occupancy rather than raw item
   * occupancy: a single full-width row (title, a centered caption)
   * can span straight across where the gutter would otherwise be,
   * and counting every item would let that one row mask the gutter
   * entirely. By counting at most one "touch" per row per bin, a
   * lone wide header row can't outweigh the dozens of body rows
   * that never go near the gutter - we tolerate a small number of
   * rows touching a bin rather than requiring zero.
   *
   * This still doesn't require both columns to have text at the
   * same y-position to reveal the gutter, so it stays reliable even
   * when the two columns drift out of sync (figures, footnotes,
   * uneven paragraph lengths).
   */
  private computeGutterX(
    rows: TextLine[],
    pageMinX: number,
    pageMaxX: number,
  ): number | null {
    const pageWidth = pageMaxX - pageMinX;

    if (pageWidth <= 0 || rows.length < MIN_COLUMN_LINES) {
      return null;
    }

    /*
     * Only rows that already span most of the page width are used
     * to vote on the gutter position. This is the key filter that
     * keeps a centered title/author/affiliation block from masking
     * the gutter: those lines are single continuous runs of text
     * with no internal gap, so even though they're fairly wide,
     * they rarely reach the width of two real columns plus the
     * gutter between them. A row where BOTH columns have text at
     * the same y, by contrast, necessarily spans close to the full
     * page width. Excluding narrower rows here does not exclude
     * them from later classification - it only keeps them out of
     * the gutter vote.
     */
    const votingRows = rows.filter(
      (row) => row.maxX - row.minX >= pageWidth * GUTTER_VOTING_WIDTH_RATIO,
    );

    const totalItems = votingRows.reduce(
      (sum, row) => sum + row.items.length,
      0,
    );

    if (
      votingRows.length < MIN_COLUMN_LINES ||
      totalItems < MIN_ITEMS_FOR_GUTTER
    ) {
      return null;
    }

    const binCount = Math.ceil(pageWidth / GUTTER_BIN_WIDTH);
    const rowsTouchingBin = new Array<number>(binCount).fill(0);

    for (const row of votingRows) {
      const touchedBins = new Set<number>();

      for (const item of row.items) {
        const startBin = Math.max(
          0,
          Math.floor((item.x - pageMinX) / GUTTER_BIN_WIDTH),
        );
        const endBin = Math.min(
          binCount - 1,
          Math.floor(
            (item.x + item.width - pageMinX) / GUTTER_BIN_WIDTH,
          ),
        );

        for (let bin = startBin; bin <= endBin; bin++) {
          touchedBins.add(bin);
        }
      }

      for (const bin of touchedBins) {
        const current = rowsTouchingBin[bin];
        rowsTouchingBin[bin] = (current ?? 0) + 1;
      }
    }

    // Among the already-filtered wide rows, allow a small amount of
    // noise (a stray wide caption, an equation) without disqualifying
    // a bin - only a band that's almost always empty counts.
    const occupancyThreshold = Math.max(
      0,
      Math.floor(votingRows.length * 0.05),
    );

    // Restrict the search to the central portion of the page so
    // that left/right margins are never mistaken for a gutter.
    const searchStart = Math.floor(binCount * GUTTER_SEARCH_MARGIN);
    const searchEnd = Math.ceil(
      binCount * (1 - GUTTER_SEARCH_MARGIN),
    );

    let bestRunStart = -1;
    let bestRunLength = 0;
    let runStart = -1;

    for (let bin = searchStart; bin <= searchEnd; bin++) {
      const count = rowsTouchingBin[bin] ?? 0;

      if (count <= occupancyThreshold) {
        if (runStart === -1) {
          runStart = bin;
        }

        const runLength = bin - runStart + 1;

        if (runLength > bestRunLength) {
          bestRunLength = runLength;
          bestRunStart = runStart;
        }
      } else {
        runStart = -1;
      }
    }

    const bestRunWidth = bestRunLength * GUTTER_BIN_WIDTH;

    if (bestRunStart === -1 || bestRunWidth < MIN_COLUMN_GAP) {
      return null;
    }

    const gutterBinCenter = bestRunStart + bestRunLength / 2;

    return pageMinX + gutterBinCenter * GUTTER_BIN_WIDTH;
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

    /*
     * Track the y-position of every row that was genuinely split
     * (i.e. had real content on both sides of the gutter). A title
     * or author/affiliation line is a single continuous run of text
     * with no internal gap at the gutter, so it is never split -
     * only true two-column body rows are. The topmost split row
     * therefore marks where the real two-column body begins; we use
     * that below to pull any header content above it out of the
     * columns, even if that header content is too narrow to trip
     * the FULL_WIDTH_RATIO check on its own.
     */
    let topSplitY: number | null = null;

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

        if (topSplitY === null || row.y > topSplitY) {
          topSplitY = row.y;
        }

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

    if (topSplitY === null) {
      return { leftLines, rightLines, fullWidthLines };
    }

    const promoted: TextLine[] = [];

    const keepBelowHeader = (line: TextLine): boolean => {
      if (line.y > topSplitY) {
        promoted.push(line);
        return false;
      }
      return true;
    };

    const finalLeft = leftLines.filter(keepBelowHeader);
    const finalRight = rightLines.filter(keepBelowHeader);

    return {
      leftLines: finalLeft,
      rightLines: finalRight,
      fullWidthLines: [...fullWidthLines, ...promoted],
    };
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

    if (/[({[]$/.test(previous.text)) {
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
      .replace(/([({[])\s+/g, '$1')

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