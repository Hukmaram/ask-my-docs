import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateRecallAtK } from '../src/evaluation/retrieval/retrieval-metrics.js';
import { evaluateRetrievalStage } from '../src/evaluation/retrieval/retrieval-evaluator.js';
import {
  calculateGenerationMetrics,
  evaluateQualityGate,
  formatEvaluationConsoleReport,
  DEFAULT_QUALITY_THRESHOLDS,
  type GenerationQuestionResult,
  type RetrievalMetrics,
} from '../src/evaluation/evaluation-summary.js';
import { validateCitations } from '../src/evaluation/citations/citation-validator.js';
import { repairCitations } from '../src/evaluation/citations/citation-repair.js';
import type { RetrievalResult } from '../src/types/retrieval.js';
import type { GoldenQuestion } from '../src/evaluation/datasets/golden-dataset.js';

function createMockRetrievalResult(chunkId: string, score = 0.9): RetrievalResult {
  return {
    chunk: {
      id: chunkId,
      documentId: chunkId.split('-')[0] || 'doc1',
      content: `Sample content for ${chunkId}`,
      chunkIndex: 0,
      pageNumbers: [1],
      metadata: {},
      embedding: {
        model: 'nomic-embed-text',
        dimensions: 768,
        vector: [],
      },
    },
    score,
  };
}

describe('Retrieval Metrics - calculateRecallAtK', () => {
  it('returns 1.0 when all expected sources are present in top K', () => {
    const results: RetrievalResult[] = [
      createMockRetrievalResult('chunk-1'),
      createMockRetrievalResult('chunk-2'),
      createMockRetrievalResult('chunk-3'),
    ];

    const recallResult = calculateRecallAtK(results, ['chunk-1', 'chunk-2'], 2);
    assert.equal(recallResult.recall, 1.0);
    assert.deepEqual(recallResult.matchedSourceIds, ['chunk-1', 'chunk-2']);
  });

  it('returns 0.5 when only half of expected sources are in top K', () => {
    const results: RetrievalResult[] = [
      createMockRetrievalResult('chunk-1'),
      createMockRetrievalResult('chunk-99'),
    ];

    const recallResult = calculateRecallAtK(results, ['chunk-1', 'chunk-2'], 2);
    assert.equal(recallResult.recall, 0.5);
    assert.deepEqual(recallResult.matchedSourceIds, ['chunk-1']);
  });

  it('honors K cutoff properly', () => {
    const results: RetrievalResult[] = [
      createMockRetrievalResult('chunk-99'),
      createMockRetrievalResult('chunk-1'),
    ];

    // At K=1, chunk-1 is outside top-1
    const recallK1 = calculateRecallAtK(results, ['chunk-1'], 1);
    assert.equal(recallK1.recall, 0.0);

    // At K=2, chunk-1 is included
    const recallK2 = calculateRecallAtK(results, ['chunk-1'], 2);
    assert.equal(recallK2.recall, 1.0);
  });
});

describe('Retrieval Evaluator - evaluateRetrievalStage', () => {
  it('aggregates recall correctly across multiple dataset questions', () => {
    const dataset: GoldenQuestion[] = [
      {
        id: 'q1',
        question: 'Q1?',
        expectedAnswer: 'A1',
        expectedSourceIds: ['chunk-1'],
      },
      {
        id: 'q2',
        question: 'Q2?',
        expectedAnswer: 'A2',
        expectedSourceIds: ['chunk-2'],
      },
    ];

    const retrievalMap = new Map<string, RetrievalResult[]>([
      ['q1', [createMockRetrievalResult('chunk-1')]],
      ['q2', [createMockRetrievalResult('chunk-other')]],
    ]);

    const evalStage = evaluateRetrievalStage(dataset, retrievalMap, 'TestStage');
    assert.equal(evalStage.name, 'TestStage');
    assert.equal(evalStage.recallAt5, 0.5); // 1.0 for q1 + 0.0 for q2 = 0.5
  });
});

describe('Generation Metrics & Quality Gate', () => {
  it('calculates average generation metrics accurately', () => {
    const sampleResults: GenerationQuestionResult[] = [
      {
        questionId: 'q1',
        faithfulness: 1.0,
        relevance: 1.0,
        citationValidity: 1.0,
        passed: true,
      },
      {
        questionId: 'q2',
        faithfulness: 0.8,
        relevance: 0.6,
        citationValidity: 1.0,
        passed: false,
      },
    ];

    const metrics = calculateGenerationMetrics(sampleResults, DEFAULT_QUALITY_THRESHOLDS);
    assert.equal(metrics.faithfulness, 0.9);
    assert.equal(metrics.relevance, 0.8);
    assert.equal(metrics.citationValidity, 1.0);
    assert.equal(metrics.generationPassRate, 0.5);
  });

  it('evaluates quality gate with passing thresholds', () => {
    const retrievalMetrics: RetrievalMetrics = {
      vectorRecallAt5: 0.7,
      bm25RecallAt5: 0.6,
      hybridRecallAt5: 0.8,
      rerankedRecallAt5: 0.85, // threshold is 0.80 -> PASS
    };

    const generationMetrics = calculateGenerationMetrics([
      {
        questionId: 'q1',
        faithfulness: 0.95,
        relevance: 0.85,
        citationValidity: 1.0,
        passed: true,
      },
    ]);

    const summary = evaluateQualityGate(retrievalMetrics, generationMetrics);
    assert.equal(summary.qualityGate.passed, true);
    assert.equal(summary.qualityGate.results.length, 5);

    const report = formatEvaluationConsoleReport(summary);
    assert.ok(report.includes('Evaluation Summary'));
    assert.ok(report.includes('Quality Gate'));
  });

  it('evaluates quality gate with failing thresholds', () => {
    const retrievalMetrics: RetrievalMetrics = {
      vectorRecallAt5: 0.5,
      bm25RecallAt5: 0.5,
      hybridRecallAt5: 0.5,
      rerankedRecallAt5: 0.6, // threshold is 0.80 -> FAIL
    };

    const generationMetrics = calculateGenerationMetrics([
      {
        questionId: 'q1',
        faithfulness: 0.5,
        relevance: 0.5,
        citationValidity: 0,
        passed: false,
      },
    ]);

    const summary = evaluateQualityGate(retrievalMetrics, generationMetrics);
    assert.equal(summary.qualityGate.passed, false);
  });
});

describe('Citation Validation & Repair', () => {
  const mockSources = [createMockRetrievalResult('c1'), createMockRetrievalResult('c2')];

  it('validates correct citations properly', () => {
    const text = 'RAG utilizes non-parametric retrieval memory. [SOURCE_1] It outperforms pure parametric baselines. [SOURCE_2]';
    const validation = validateCitations(text, mockSources);
    assert.equal(validation.valid, true);
    assert.deepEqual(validation.citations, ['SOURCE_1', 'SOURCE_2']);
    assert.equal(validation.missingCitations, false);
  });

  it('detects invalid citation numbers outside source range', () => {
    const text = 'This claim references an out-of-range source. [SOURCE_5]';
    const validation = validateCitations(text, mockSources);
    assert.equal(validation.valid, false);
    assert.deepEqual(validation.invalidCitations, ['SOURCE_5']);
  });

  it('repairs trailing uncited sentences by propagating nearest citation', () => {
    const text = 'First sentence is cited. [SOURCE_1] Second sentence has no citation.';
    const repaired = repairCitations(text, mockSources);
    assert.ok(repaired.includes('[SOURCE_1]'));
    assert.ok(repaired.endsWith('[SOURCE_1]'));
  });
});
