#!/bin/bash
# Run Locust performance tests

echo "🚀 Running Performance Tests with Locust"
echo "========================================"

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Parse arguments
USERS=${1:-10}
SPAWN_RATE=${2:-2}
RUN_TIME=${3:-60s}
TARGET=${4:-tts}

echo "Configuration:"
echo "  Users: $USERS"
echo "  Spawn Rate: $SPAWN_RATE/sec"
echo "  Duration: $RUN_TIME"
echo "  Target: $TARGET"
echo ""

# Run Locust
if [ "$TARGET" = "tts" ]; then
    locust -f locustfile.py TTSUser \
        --users $USERS \
        --spawn-rate $SPAWN_RATE \
        --run-time $RUN_TIME \
        --headless \
        --html test_results/locust_report.html
elif [ "$TARGET" = "stt" ]; then
    locust -f locustfile.py STTUser \
        --users $USERS \
        --spawn-rate $SPAWN_RATE \
        --run-time $RUN_TIME \
        --headless \
        --html test_results/locust_report.html
else
    echo "Unknown target: $TARGET"
    echo "Use: tts or stt"
    exit 1
fi

echo ""
echo "✅ Performance tests completed!"
echo "📊 Report: test_results/locust_report.html"
