import React, { useState } from 'react';

interface AnswerProps {
  answer: string;
  citations: string[];
}

export const Answer: React.FC<AnswerProps> = ({ answer, citations }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  // Helper to format text with highlighted citation badges
  const renderFormattedAnswer = (text: string) => {
    const parts = text.split(/(\[SOURCE_\d+\])/g);
    return parts.map((part, index) => {
      const match = part.match(/^\[(SOURCE_(\d+))\]$/);
      if (match) {
        const sourceLabel = match[1];
        const sourceNum = match[2];
        return (
          <a
            key={index}
            href={`#source-card-${sourceLabel}`}
            className="citation-badge"
            title={`Jump to Source ${sourceNum}`}
          >
            {sourceLabel}
          </a>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="card answer-card">
      <div className="card-header">
        <div className="card-title-group">
          <span className="card-icon">💡</span>
          <h3 className="card-title">Generated Answer</h3>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="copy-button"
          title="Copy answer to clipboard"
        >
          {copied ? '✓ Copied' : '📋 Copy'}
        </button>
      </div>

      <div className="answer-content">
        <p className="answer-text">{renderFormattedAnswer(answer)}</p>
      </div>

      {citations.length > 0 && (
        <div className="answer-citations-footer">
          <span className="citations-label">Referenced Sources:</span>
          <div className="citations-list">
            {citations.map((cit) => (
              <a
                key={cit}
                href={`#source-card-${cit}`}
                className="citation-pill"
              >
                {cit}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
