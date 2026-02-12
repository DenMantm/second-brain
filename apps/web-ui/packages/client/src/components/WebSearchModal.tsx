/**
 * Web Search Modal - Display web search results
 */
import { useWebSearchStore } from '../stores/webSearchStore';
import './WebSearchModal.css';

export function WebSearchModal() {
  const {
    viewMode,
    modalSize,
    searchResults,
    duckduckgoResults,
    searchQuery,
    totalHits,
    suggestion,
    hide,
    toggleSize,
  } = useWebSearchStore();

  // Don't render if hidden
  if (viewMode === 'hidden') {
    return null;
  }

  const isMinimized = modalSize === 'minimized';

  // Class names based on state
  const modalClasses = [
    'websearch-modal',
    `websearch-modal--${modalSize}`,
  ].join(' ');

  return (
    <div className={modalClasses}>
      {/* Header */}
      <div className="websearch-modal__header">
        <div className="websearch-modal__header-left">
          <span className="websearch-modal__icon">🔎</span>
          <span className="websearch-modal__title">
            {searchQuery ? `Web Search: ${searchQuery}` : 'Web Search'}
          </span>
          {totalHits > 0 && !isMinimized && (
            <span className="websearch-modal__count">
              {totalHits.toLocaleString()} results
            </span>
          )}
        </div>
        <div className="websearch-modal__header-right">
          <button
            className="websearch-modal__header-btn"
            onClick={toggleSize}
            title={isMinimized ? 'Maximize' : 'Minimize'}
          >
            {isMinimized ? '🔼' : '🔽'}
          </button>
          <button
            className="websearch-modal__header-btn"
            onClick={hide}
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
        <div className="websearch-modal__content">
          {/* Suggestion */}
          {suggestion && (
            <div className="websearch-suggestion">
              Did you mean: <strong>{suggestion}</strong>?
            </div>
          )}

          {/* Results */}
          {searchResults.length === 0 && duckduckgoResults.length === 0 ? (
            <div className="websearch-empty">
              <p>No results found</p>
            </div>
          ) : (
            <div className="websearch-results">
              {searchResults.length > 0 && (
                <div className="websearch-section">
                  <div className="websearch-section__title">Wikipedia</div>
                  <div className="websearch-results-list">
                    {searchResults.map((article) => (
                      <div key={article.pageid} className="websearch-result">
                        <div className="websearch-result__header">
                          <h3 className="websearch-result__title">
                            {article.title}
                          </h3>
                          <a
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="websearch-result__link"
                            title="Open source"
                          >
                            ↗
                          </a>
                        </div>
                        <p
                          className="websearch-result__snippet"
                          dangerouslySetInnerHTML={{ __html: article.snippet }}
                        />
                        <div className="websearch-result__meta">
                          {article.wordcount.toLocaleString()} words
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {duckduckgoResults.length > 0 && (
                <div className="websearch-section">
                  <div className="websearch-section__title">DuckDuckGo</div>
                  <div className="websearch-results-list">
                    {duckduckgoResults.map((result, index) => (
                      <div key={`${result.url}-${index}`} className="websearch-result">
                        <div className="websearch-result__header">
                          <h3 className="websearch-result__title">
                            {result.title}
                          </h3>
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="websearch-result__link"
                            title="Open source"
                          >
                            ↗
                          </a>
                        </div>
                        <p className="websearch-result__snippet">
                          {result.snippet}
                        </p>
                        <div className="websearch-result__meta">
                          {result.displayUrl ?? result.url}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
