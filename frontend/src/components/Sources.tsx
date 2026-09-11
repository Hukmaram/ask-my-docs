import React, { useState } from 'react';
import type { RetrievalResult } from '../types/chat.js';

interface SourcesProps {
  sources: RetrievalResult[];
}

export const Sources: React.FC<SourcesProps> = ({ sources }) => {
  const [expandedChunks, setExpandedChunks] = useState<Record<number, boolean>>({});

  if (!sources || sources.length === 0) {
    return null;
  }

  const toggleExpand = (index: number) => {
    setExpandedChunks((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  return (
    <div className="card sources-container">
      <div className="card-header">
        <div className="card-title-group">
          <span className="card-icon">📚</span>
          <h3 className="card-title">Retrieved Sources</h3>
          <span className="count-badge">{sources.length}</span>
        </div>
      </div>

      <div className="sources-list">
        {sources.map((source, index) => {
          const sourceNum = index + 1;
          const sourceId = `SOURCE_${sourceNum}`;
          const isExpanded = expandedChunks[index] ?? false;
          const chunk = source.chunk;

          // Format relevance score for clean display
          const displayScore = source.rerankScore !== undefined
            ? `Rerank: ${source.rerankScore.toFixed(4)}`
            : source.score !== undefined
            ? `Relevance: ${source.score.toFixed(4)}`
            : null;

          return (
            <div
              key={chunk.id || index}
              id={`source-card-${sourceId}`}
              className="source-card"
            >
              <div className="source-card-header">
                <div className="source-meta-left">
                  <span className="source-tag">{sourceId}</span>
                  <span className="doc-id" title={chunk.documentId || chunk.id}>
                    {chunk.documentId || chunk.id}
                  </span>
                </div>

                <div className="source-meta-right">
                  {chunk.pageNumbers && chunk.pageNumbers.length > 0 && (
                    <span className="page-badge">
                      pp. {chunk.pageNumbers.join(', ')}
                    </span>
                  )}
                  {displayScore && (
                    <span className="score-badge">{displayScore}</span>
                  )}
                </div>
              </div>

              <div className="source-content-wrapper">
                <p className={`source-content ${isExpanded ? 'expanded' : 'collapsed'}`}>
                  {chunk.content}
                </p>
                {chunk.content && chunk.content.length > 280 && (
                  <button
                    type="button"
                    className="expand-toggle"
                    onClick={() => toggleExpand(index)}
                  >
                    {isExpanded ? 'Show less' : 'Show full chunk'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
