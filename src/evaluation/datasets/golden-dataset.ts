export interface GoldenQuestion {
  id: string;
  question: string;
  expectedAnswer: string;
  expectedSourceIds: string[];
}

export const goldenDataset: GoldenQuestion[] = [
  {
    id: 'rag-001',
    question:
      'How does retrieval augmented generation improve knowledge intensive NLP tasks?',

    expectedAnswer:
      'RAG improves knowledge-intensive NLP tasks by combining pre-trained parametric and non-parametric memory for language generation.',

    expectedSourceIds: [
      '2005.11401v4-chunk-0',
    ],
  },

  {
    id: 'rag-002',
    question:
      'What are the two types of memory used by RAG?',

    expectedAnswer:
      'RAG combines parametric and non-parametric memory.',

    expectedSourceIds: [
      '2005.11401v4-chunk-0',
    ],
  },

  {
    id: 'rag-003',
    question:
      'What results did RAG achieve on open-domain question answering?',

    expectedAnswer:
      'RAG achieved state-of-the-art results on open-domain question answering tasks.',

    expectedSourceIds: [
      '2005.11401v4-chunk-1',
    ],
  },
];