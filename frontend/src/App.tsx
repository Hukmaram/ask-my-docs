import { useState } from 'react';
import { ChatInput } from './components/ChatInput.js';
import { Answer } from './components/Answer.js';
import { Sources } from './components/Sources.js';
import { Evaluation } from './components/Evaluation.js';
import { askQuestion, ChatApiError } from './services/chat-api.js';
import type { AskMyDocsResponse } from './types/chat.js';
import './App.css';

export function App() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AskMyDocsResponse | null>(null);
  const [currentQuery, setCurrentQuery] = useState<string>('');

  const handleAsk = async (query: string) => {
    setIsLoading(true);
    setError(null);
    setCurrentQuery(query);

    try {
      const data = await askQuestion(query);
      setResponse(data);
    } catch (err) {
      if (err instanceof ChatApiError) {
        setError(err.message);
      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'An unexpected error occurred while processing your request.',
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-badge">
          <span className="badge-dot" />
          <span>RAG Knowledge Engine</span>
        </div>
        <h1 className="app-title">Ask My Docs</h1>
        <p className="app-subtitle">
          Citation-grounded retrieval-augmented generation with automated factual verification.
        </p>
      </header>

      {/* Main Content Area */}
      <main className="app-main">
        {/* Search / Input Box */}
        <section className="input-section">
          <ChatInput onAsk={handleAsk} isLoading={isLoading} />
        </section>

        {/* Error Alert Banner */}
        {error && (
          <div className="error-banner" role="alert">
            <div className="error-icon">⚠️</div>
            <div className="error-content">
              <strong>Query Failed</strong>
              <p>{error}</p>
            </div>
            <button
              type="button"
              className="error-dismiss"
              onClick={() => setError(null)}
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="loading-container">
            <div className="loading-card">
              <div className="loading-pulse-bar" />
              <div className="loading-content">
                <div className="loading-header">
                  <div className="spinner-large" />
                  <div>
                    <h4 className="loading-title">Analyzing Documents & Synthesizing Answer</h4>
                    <p className="loading-step">
                      Executing hybrid search, LLM generation, citation check, and faithfulness evaluation...
                    </p>
                  </div>
                </div>
                <div className="skeleton-lines">
                  <div className="skeleton-line line-1" />
                  <div className="skeleton-line line-2" />
                  <div className="skeleton-line line-3" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Response Results Section */}
        {response && !isLoading && (
          <section className="results-section">
            {currentQuery && (
              <div className="query-recap">
                <span className="query-recap-label">Question:</span>
                <span className="query-recap-text">"{currentQuery}"</span>
              </div>
            )}

            {/* Answer Box */}
            <Answer
              answer={response.answer}
              citations={response.citations}
            />

            {/* Evaluation and Grounding Metrics */}
            <Evaluation
              citationValidation={response.citationValidation}
              faithfulness={response.faithfulness}
              relevance={response.relevance}
            />

            {/* Source References */}
            <Sources sources={response.sources} />
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <p>Ask My Docs · Powered by Hybrid BM25 + Vector Retrieval & Local LLMs</p>
      </footer>
    </div>
  );
}

export default App;
