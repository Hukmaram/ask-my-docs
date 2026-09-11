import React, { useState } from 'react';

interface ChatInputProps {
  onAsk: (query: string) => void;
  isLoading: boolean;
}

const SAMPLE_QUESTIONS = [
  'What is RAG and how does it combine parametric and non-parametric memory?',
  'How does Dense Passage Retrieval (DPR) compare to BM25?',
  'What is REALM pre-training and salient span masking?',
];

export const ChatInput: React.FC<ChatInputProps> = ({ onAsk, isLoading }) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() || isLoading) return;
    onAsk(query);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Only submit on Ctrl+Enter or Cmd+Enter to prevent accidental submits on multiline queries
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="chat-input-container">
      <form onSubmit={handleSubmit} className="chat-input-form">
        <div className="textarea-wrapper">
          <textarea
            id="chat-query-input"
            rows={3}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your indexed documents..."
            disabled={isLoading}
            className="chat-textarea"
          />
          <div className="textarea-footer">
            <span className="input-hint">
              Press <kbd>Ctrl</kbd> + <kbd>Enter</kbd> or click Ask
            </span>
            <button
              id="ask-button"
              type="submit"
              disabled={isLoading || !query.trim()}
              className="ask-button"
            >
              {isLoading ? (
                <>
                  <span className="spinner" />
                  <span>Thinking...</span>
                </>
              ) : (
                <>
                  <span>Ask</span>
                  <svg
                    className="send-icon"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    width="16"
                    height="16"
                  >
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      <div className="sample-questions">
        <span className="sample-label">Try asking:</span>
        <div className="sample-chips">
          {SAMPLE_QUESTIONS.map((q, idx) => (
            <button
              key={idx}
              type="button"
              className="sample-chip"
              disabled={isLoading}
              onClick={() => {
                setQuery(q);
                onAsk(q);
              }}
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
