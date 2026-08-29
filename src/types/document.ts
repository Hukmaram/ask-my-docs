export interface Document {
  id: string;
  title: string;
  source: string;
  pages: DocumentPage[];
  metadata: Record<string, unknown>;
}

export interface DocumentPage {
  pageNumber: number;
  content: string;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  pageNumbers: number[];
  metadata: Record<string, unknown>;
}