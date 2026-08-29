export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  pageNumbers: number[];
  metadata: Record<string, unknown>;
}