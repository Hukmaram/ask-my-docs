export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  pageNumbers: number[];
  metadata?: Record<string, unknown>;
}

export interface RetrievalResult {
  chunk: DocumentChunk;
  score: number;
  vectorScore?: number;
  bm25Score?: number;
  vectorRank?: number;
  bm25Rank?: number;
  rrfScore?: number;
  rerankScore?: number;
}

export interface CitationValidationResult {
  valid: boolean;
  citations: string[];
  invalidCitations: string[];
  missingCitations: boolean;
  uncitedSentences: string[];
}

export interface FaithfulnessClaim {
  claim: string;
  citations: string[];
  supported: boolean;
  explanation: string;
}

export interface FaithfulnessResult {
  score: number;
  claims: FaithfulnessClaim[];
}

export interface AnswerRelevanceResult {
  score: number;
  explanation: string;
}

export interface AskMyDocsResponse {
  answer: string;
  sources: RetrievalResult[];
  citations: string[];
  citationValidation: CitationValidationResult;
  faithfulness?: FaithfulnessResult;
  relevance?: AnswerRelevanceResult;
}

export interface ChatRequest {
  query: string;
}
