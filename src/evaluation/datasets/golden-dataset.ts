export interface GoldenQuestion {
  id: string;
  question: string;
  expectedAnswer: string;
  expectedSourceIds: string[];
}

export const goldenDataset: GoldenQuestion[] = [
  // --------------------------------------------------
  // RAG FUNDAMENTALS
  // --------------------------------------------------

  {
    id: 'rag-001',
    question: 'How does retrieval augmented generation improve knowledge intensive NLP tasks?',
    expectedAnswer:
      'RAG improves knowledge-intensive NLP tasks by combining pre-trained parametric and non-parametric memory for language generation.',
    expectedSourceIds: ['2005.11401v4-chunk-0'],
  },

  {
    id: 'rag-002',
    question: 'What are the two types of memory used by RAG?',
    expectedAnswer: 'RAG combines parametric and non-parametric memory.',
    expectedSourceIds: ['2005.11401v4-chunk-0'],
  },

  {
    id: 'rag-003',
    question: 'What results did RAG achieve on open-domain question answering?',
    expectedAnswer:
      'RAG achieved state-of-the-art results on several open-domain question answering tasks.',
    expectedSourceIds: ['2005.11401v4-chunk-1'],
  },

  {
    id: 'rag-004',
    question: 'What is the role of parametric memory in RAG?',
    expectedAnswer: 'Parametric memory is provided by a pre-trained sequence-to-sequence model.',
    expectedSourceIds: ['2005.11401v4-chunk-0'],
  },

  {
    id: 'rag-005',
    question: 'What is the non-parametric memory used by RAG?',
    expectedAnswer:
      'The non-parametric memory is a dense vector index of Wikipedia accessed using a pre-trained neural retriever.',
    expectedSourceIds: ['2005.11401v4-chunk-0'],
  },

  // --------------------------------------------------
  // RAG ARCHITECTURE
  // --------------------------------------------------

  {
    id: 'rag-006',
    question: 'What are the two main components of a RAG model?',
    expectedAnswer: 'A RAG model consists of a retriever and a generator.',
    expectedSourceIds: ['2005.11401v4-chunk-2'],
  },

  {
    id: 'rag-007',
    question: 'What does the retriever do in the RAG architecture?',
    expectedAnswer:
      'The retriever returns a distribution over relevant text passages for a given query.',
    expectedSourceIds: ['2005.11401v4-chunk-2'],
  },

  {
    id: 'rag-008',
    question: 'What does the generator do in RAG?',
    expectedAnswer:
      'The generator produces the target sequence using the retrieved passage together with the previous generated tokens.',
    expectedSourceIds: ['2005.11401v4-chunk-2'],
  },

  {
    id: 'rag-009',
    question: 'How does RAG allow its knowledge to be updated?',
    expectedAnswer:
      'The non-parametric memory can be replaced to update the model knowledge as the world changes.',
    expectedSourceIds: ['2005.11401v4-chunk-0'],
  },

  // --------------------------------------------------
  // OPEN-DOMAIN QA
  // --------------------------------------------------

  {
    id: 'rag-010',
    question: 'Which open-domain question answering datasets were evaluated in the RAG paper?',
    expectedAnswer:
      'The paper evaluates RAG on Natural Questions, WebQuestions, CuratedTrec, and TriviaQA.',
    expectedSourceIds: ['2005.11401v4-chunk-1', '2005.11401v4-chunk-6'],
  },

  {
    id: 'rag-011',
    question: 'How does RAG compare with parametric sequence-to-sequence models on open-domain QA?',
    expectedAnswer:
      'RAG achieves state-of-the-art results on open-domain QA tasks and outperforms parametric sequence-to-sequence baselines on several tasks.',
    expectedSourceIds: ['2005.11401v4-chunk-1'],
  },

  {
    id: 'rag-012',
    question:
      'Does RAG require an expensive extractive reader to achieve strong open-domain QA performance?',
    expectedAnswer:
      'No. The paper shows that RAG can achieve strong performance without an expensive specialized extractive reader.',
    expectedSourceIds: ['2005.11401v4-chunk-1'],
  },

  // --------------------------------------------------
  // MODEL DESIGN / BEHAVIOR
  // --------------------------------------------------

  {
    id: 'rag-013',
    question: 'Why is non-parametric memory useful for a knowledge-intensive language model?',
    expectedAnswer:
      'Non-parametric memory provides external knowledge that can be retrieved and updated independently of the model parameters.',
    expectedSourceIds: ['2005.11401v4-chunk-0'],
  },

  {
    id: 'rag-014',
    question:
      'What advantage does RAG provide over storing all knowledge only in model parameters?',
    expectedAnswer:
      'RAG supplements parametric knowledge with an external non-parametric memory that can be retrieved and updated.',
    expectedSourceIds: ['2005.11401v4-chunk-0'],
  },

  {
    id: 'rag-015',
    question:
      'What does the RAG paper demonstrate about using a retriever together with a generator?',
    expectedAnswer:
      'The paper demonstrates that combining retrieval with generation can achieve strong and state-of-the-art performance on knowledge-intensive tasks, including open-domain question answering.',
    expectedSourceIds: ['2005.11401v4-chunk-0', '2005.11401v4-chunk-1', '2005.11401v4-chunk-2'],
  },
];
