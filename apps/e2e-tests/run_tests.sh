#!/bin/bash
# Run E2E tests

set -e

echo "🧪 Running E2E Tests for Second Brain Services"
echo "=============================================="

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Parse arguments
TEST_MARKER=""
PARALLEL=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --unit)
            TEST_MARKER="-m unit"
            shift
            ;;
        --integration)
            TEST_MARKER="-m integration"
            shift
            ;;
        --e2e)
            TEST_MARKER="-m e2e"
            shift
            ;;
        --slow)
            TEST_MARKER="-m slow"
            shift
            ;;
        --parallel)
            PARALLEL="-n auto"
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Create test results directory
mkdir -p test_results

# Run tests
echo ""
echo "Running tests with: pytest $TEST_MARKER $PARALLEL"
echo ""

pytest $TEST_MARKER $PARALLEL \
    --html=test_results/report.html \
    --self-contained-html \
    --junitxml=test_results/junit.xml

echo ""
echo "✅ Tests completed!"
echo "📊 HTML report: test_results/report.html"
