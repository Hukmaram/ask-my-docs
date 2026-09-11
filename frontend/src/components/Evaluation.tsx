import React, { useState } from 'react';
import type {
  CitationValidationResult,
  FaithfulnessResult,
  AnswerRelevanceResult,
} from '../types/chat.js';

interface EvaluationProps {
  citationValidation?: CitationValidationResult;
  faithfulness?: FaithfulnessResult;
  relevance?: AnswerRelevanceResult;
}

export const Evaluation: React.FC<EvaluationProps> = ({
  citationValidation,
  faithfulness,
  relevance,
}) => {
  const [showClaims, setShowClaims] = useState(false);

  if (!citationValidation && !faithfulness && !relevance) {
    return null;
  }

  const formatPercent = (val?: number) => {
    if (val === undefined || isNaN(val)) return 'N/A';
    return `${Math.round(val * 100)}%`;
  };

  const getScoreColorClass = (score?: number) => {
    if (score === undefined) return 'score-neutral';
    if (score >= 0.8) return 'score-good';
    if (score >= 0.5) return 'score-warning';
    return 'score-danger';
  };

  return (
    <div className="card evaluation-container">
      <div className="card-header">
        <div className="card-title-group">
          <span className="card-icon">🔬</span>
          <h3 className="card-title">Evaluation & Verification</h3>
        </div>
      </div>

      <div className="eval-metrics-grid">
        {/* Faithfulness Metric */}
        {faithfulness && (
          <div className="eval-metric-box">
            <div className="metric-header">
              <span className="metric-title">Faithfulness</span>
              <span className={`metric-score ${getScoreColorClass(faithfulness.score)}`}>
                {formatPercent(faithfulness.score)}
              </span>
            </div>
            <p className="metric-desc">
              {faithfulness.claims.length > 0
                ? `${faithfulness.claims.filter((c) => c.supported).length} of ${faithfulness.claims.length} claims supported by sources`
                : 'No factual claims extracted to evaluate.'}
            </p>
            {faithfulness.claims.length > 0 && (
              <button
                type="button"
                className="claims-toggle-btn"
                onClick={() => setShowClaims(!showClaims)}
              >
                {showClaims ? 'Hide Claim Breakdown' : 'View Claim Breakdown'}
              </button>
            )}
          </div>
        )}

        {/* Answer Relevance Metric */}
        {relevance && (
          <div className="eval-metric-box">
            <div className="metric-header">
              <span className="metric-title">Answer Relevance</span>
              <span className={`metric-score ${getScoreColorClass(relevance.score)}`}>
                {formatPercent(relevance.score)}
              </span>
            </div>
            <p className="metric-desc">{relevance.explanation}</p>
          </div>
        )}

        {/* Citation Validation Metric */}
        {citationValidation && (
          <div className="eval-metric-box">
            <div className="metric-header">
              <span className="metric-title">Citation Grounding</span>
              <span
                className={`metric-badge ${
                  citationValidation.valid ? 'badge-success' : 'badge-warning'
                }`}
              >
                {citationValidation.valid ? 'Verified Grounded' : 'Needs Grounding'}
              </span>
            </div>
            <ul className="citation-validation-details">
              <li>
                <span>Valid citations:</span>{' '}
                <strong>{citationValidation.citations.join(', ') || 'None'}</strong>
              </li>
              {citationValidation.invalidCitations.length > 0 && (
                <li className="text-danger">
                  <span>Invalid citations:</span>{' '}
                  <strong>{citationValidation.invalidCitations.join(', ')}</strong>
                </li>
              )}
              {citationValidation.uncitedSentences.length > 0 && (
                <li className="text-warning">
                  <span>Uncited sentences:</span>{' '}
                  <strong>{citationValidation.uncitedSentences.length} detected</strong>
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Expanded Claims Table */}
      {showClaims && faithfulness && faithfulness.claims.length > 0 && (
        <div className="claims-breakdown">
          <h4 className="claims-title">Claim-by-Claim Verification</h4>
          <div className="claims-list">
            {faithfulness.claims.map((claim, idx) => (
              <div
                key={idx}
                className={`claim-item ${claim.supported ? 'claim-supported' : 'claim-unsupported'}`}
              >
                <div className="claim-item-header">
                  <span className="claim-status-icon">
                    {claim.supported ? '✅ Supported' : '❌ Unsupported'}
                  </span>
                  <div className="claim-citations">
                    {claim.citations.map((c) => (
                      <span key={c} className="claim-cite-badge">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="claim-text">"{claim.claim}"</p>
                {claim.explanation && (
                  <p className="claim-explanation">
                    <em>Rationale:</em> {claim.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
