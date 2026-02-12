import { describe, it, expect } from 'vitest';
import { parseDuckDuckGoHtml } from '../duckduckgo';

describe('DuckDuckGo HTML parser', () => {
  it('should parse results from DuckDuckGo HTML', () => {
    const html = `
      <div class="result">
        <div class="result__body">
          <a class="result__a" href="https://example.com/one">Title One</a>
          <a class="result__snippet">Snippet <b>one</b> &amp; more</a>
        </div>
      </div>
      <div class="result">
        <div class="result__body">
          <a class="result__a" href="/l/?kh=-1&amp;uddg=https%3A%2F%2Fexample.org%2Ftwo">Title &quot;Two&quot;</a>
          <div class="result__snippet">Second snippet&#039;s details</div>
        </div>
      </div>
    `;

    const results = parseDuckDuckGoHtml(html, 10);

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      title: 'Title One',
      url: 'https://example.com/one',
      snippet: 'Snippet one & more',
      displayUrl: 'example.com',
    });
    expect(results[1]).toMatchObject({
      title: 'Title "Two"',
      url: 'https://example.org/two',
      snippet: "Second snippet's details",
      displayUrl: 'example.org',
    });
  });

  it('should return empty array when no results found', () => {
    const results = parseDuckDuckGoHtml('<html><body>No results</body></html>', 5);
    expect(results).toEqual([]);
  });

  it('should respect maxResults', () => {
    const html = `
      <div class="result">
        <div class="result__body">
          <a class="result__a" href="https://example.com/one">Title One</a>
          <a class="result__snippet">Snippet one</a>
        </div>
      </div>
      <div class="result">
        <div class="result__body">
          <a class="result__a" href="https://example.com/two">Title Two</a>
          <a class="result__snippet">Snippet two</a>
        </div>
      </div>
    `;

    const results = parseDuckDuckGoHtml(html, 1);
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Title One');
  });
});
