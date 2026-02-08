# YouTube Tests

## Overview

**Hybrid Testing Approach:**
- **YouTube Service Tests**: Fetch real data ONCE in `beforeAll`, reuse for all tests (fast + validates real scraping)
- **LangChain Tools Tests**: Use mocked service (fast + tests tool logic without network dependency)
- **Integration Tests**: SKIPPED by default (requires LLM service, real YouTube, slow)

## Running Tests

### Run All Tests (Fast - skips integration)
```bash
npm test
# Runs in ~5 seconds
```

### Run Integration Tests (Requires LLM Service)
```bash
npm run test:integration
# Runs in ~30 seconds, requires LM Studio on localhost:1234
```

Or with environment variable:
```bash
RUN_INTEGRATION_TESTS=true npm test
```

## Test Characteristics

### 🌐 YouTube Service Tests (Real Data)
- **Fetches once** in `beforeAll` hook (~2-3 seconds)
- **Reuses** cached data for all tests (instant)
- Validates against live YouTube HTML structure
- Only 2-3 real API calls total (not per test)

### 🎭 LangChain Tools Tests (Mocked)
- Uses `vi.mock()` to mock YouTube service
- Tests tool logic, parameter validation, formatting
- No network dependency - runs instantly
- Predictable test data for consistent assertions

### ⏱️ Timeouts** - Uses real API (fetched once):
- ✅ Parse video results correctly (title, channel, views, duration, etc.)
- ✅ Respect maxResults parameter (cached data)
- ✅ Handle special characters in queries (1 real call)
- ✅ No Brotli compression validates (cached data)
- ✅ Performance test (1 real call) - complete within 10 seconds
- ✅ Valid metadata structure (cached data)
- ✅ Handle different video types (cached data)

**LangChain Tools (`youtube-tools.test.ts`)** - Uses mocked service:
- ✅ Search tool formats results correctly
- ✅ Store results in memory for context
- ✅ Handle search errors gracefully
- ✅ Default parameter handling (maxResults=10)
- ✅ Format results with index for LLM
- ✅ Play video by index from stored results
- ✅ Play video by video ID
- ✅ Invalid index validation
- ✅ All playback controls (play, pause, seek, volume)
- ✅ Schema definitions and tool export
- ✅ Handle invalid queries gracefully
- ✅ Default maxResults parameter
- ✅ Play video by index from stored results
- ✅ Play video by video ID
- ✅ Invalid index handling
- ✅ Playback controls (play, pause, seek, volume)
- ✅ Tool array exports and schema definitions
- ✅ Memory management (clear search results)

## Important Notes
 (Minimal)
**YouTube Service Tests** require (only during `beforeAll`):
- Active internet connection
- Access to youtube.com (not blocked by firewall)
- Reasonable network speed
- **Only 2-3 API calls total** (not per test)

**LangChain Tools Tests** require:
- **No network** - fully mocked

### 🔄 Potential Failures
**YouTube Service Tests** may fail if:
- YouTube changes their HTML structure (needs scraping logic update)
- Network is down during initial fetch
- YouTube rate limits your IP (extremely rare - only 2-3 calls)
- YouTube is experiencing downtime

**LangChain Tools Tests** should never fail from network issuese with reasonable test runs)
- YouTube is experiencing downtime

### 🚀 CI/CD Considerations
When running in CI:
```bash
# Set longer timeout for slower CI environments
VITEST_TIMEOUT=30000 npx vitest run
```

CoInitial data fetch (`beforeAll`): ~3-5 seconds
- YouTube service tests (using cached data): **< 1 second each**
- LangChain tools tests (mocked): **< 1 second each**
- Full YouTube service suite: ~10-15 seconds (includes 2-3 real API calls)
- Full tools suite: ~1-2 seconds (all mocked)
- **Total: ~15-20 seconds** (vs 2-3 minutes with all real calls)laky network issues

### 📊 Performance Expectations
Typical test run times:
- Single test: 1-5 seconds
- Full YouTube service suite: ~30-60 seconds
- Full tools suite: ~60-90 seconds
- Total: ~2-3 minutes

## Debugging Failed Tests

### Test Fails with "Could not find ytInitialData"
**Cause:** YouTube changed their HTML structure

**Fix:**
1. Run manual curl to inspect current HTML:
   ```bash
   curl "https://www.youtube.com/results?search_query=test" \
     -H "Accept-Encoding: gzip, deflate" \
     -o youtube_response.html
   ```
2. Search for "ytInitialData" or similar data structures
3. Update parsing logic in `src/services/youtube.ts`

### Test Fails with Timeout
**Cause:** Network is slow or YouTube is throttling

**Solutions:**
- Increase test timeout: Change `15000` to `30000` in test file
- Run tests with slower network: `npx vitest --test-timeout=30000`
- Check your internet connection

### Test Fails with "YouTube returned status 500"
**Cause:** YouTube is experiencing issues or rate limiting

**Solutions:**8 tests) 8.2s
  ✓ YouTube Service (8 tests) 8.2s
    Fetching real YouTube data once...
    Fetched 10 videos (large query)
    Fetched 3 videos (small query)
    ✓ searchYouTube (8 tests) 8.2s
      ✓ should search YouTube and parse results correctly 0.01s
      ✓ should respect maxResults parameter 0.00s
      ✓ should handle search queries with special characters 2.1s
      ✓ should successfully scrape without brotli compression 0.00s
      ✓ should complete within timeout period 1.8s
      ✓ should return valid video metadata 0.00s
      ✓ should handle different video types 0.00s

✓ src/tools/__tests__/youtube-tools.test.ts (13 tests) 0.8s
  ✓ YouTube LangChain Tools (13 tests) 0.8s
    ✓ searchYouTubeTool (5 tests) 0.3s
    ✓ playYouTubeVideoTool (5 tests) 0.2s
    ✓ controlYouTubePlayerTool (4 tests) 0.1s
    ✓ youtubeTools array (2 tests) 0.0s
    ✓ Last search results management (1 test) 0.2s

Test Files  2 passed (2)
     Tests  21 passed (21)
  Start at  14:23:45
  Duration  9.0s (in band 4.3s)
```

**Note:** Only 2-3 real API calls made (in `beforeAll` + 2 specific tests). Everything else uses cached/mocked data. ✓ controlYouTubePlayerTool (4 tests) 0.1s
    ✓ youtubeTools array (2 tests) 0.0s
    ✓ Last search results management (2 tests) 4.0s

Test Files  2 passed (2)
     Tests  18 passed (18)
  Start at  14:23:45
  Duration  30.7s
```

## Maintenance

### When to Update Tests
- YouTube changes HTML structure → Update parsing expectations
- Add new features → Add corresponding tests
- Performance degrades → Adjust timeout expectations
- New edge cases discovered → Add test cases

### Test Quality Checklist
- [ ] Tests pass consistently (run 3+ times)
- [ ] Each test validates one specific behavior
- [ ] Error messages are clear and actionable
- [ ] Timeouts are reasonable for CI environments
- [ ] Tests don't depend on specific video IDs or content
- [ ] Tests clean up after themselves (clear search results)

## Contributing

When adding new YouTube functionality:
1. Write tests that use real API calls
2. Ensure tests pass locally 3+ times
3. Add appropriate timeouts (15-30 seconds for API calls)
4. Document expected behavior in test names
5. Handle edge cases (empty results, network errors)
