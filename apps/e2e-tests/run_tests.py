"""
Quick test runner for Second Brain services.

Usage:
    python run_tests.py              # Run all tests
    python run_tests.py tts          # Run TTS tests only
    python run_tests.py stt          # Run STT tests only
    python run_tests.py integration  # Run integration tests
    python run_tests.py --fast       # Skip slow tests
"""

import subprocess
import sys
from pathlib import Path


def run_tests(test_type="all", skip_slow=False):
    """Run tests with pytest."""
    
    # Base command
    cmd = ["pytest", "-v", "--tb=short"]
    
    # Add color output
    cmd.append("--color=yes")
    
    # Select tests
    if test_type == "tts":
        cmd.append("tests/test_tts_service_new.py")
    elif test_type == "stt":
        cmd.append("tests/test_stt_service_new.py")
    elif test_type == "integration":
        cmd.append("tests/test_integration_new.py")
    elif test_type == "all":
        cmd.extend([
            "tests/test_tts_service_new.py",
            "tests/test_stt_service_new.py",
            "tests/test_integration_new.py"
        ])
    else:
        print(f"Unknown test type: {test_type}")
        sys.exit(1)
    
    # Skip slow tests if requested
    if skip_slow:
        cmd.extend(["-m", "not slow"])
    
    # Run tests
    print(f"\n{'='*60}")
    print(f"Running {test_type.upper()} tests...")
    print(f"{'='*60}\n")
    
    result = subprocess.run(cmd)
    return result.returncode


def main():
    """Main entry point."""
    args = sys.argv[1:]
    
    test_type = "all"
    skip_slow = False
    
    for arg in args:
        if arg == "--fast":
            skip_slow = True
        elif arg in ["tts", "stt", "integration", "all"]:
            test_type = arg
        elif arg in ["-h", "--help"]:
            print(__doc__)
            sys.exit(0)
    
    # Change to test directory
    test_dir = Path(__file__).parent
    import os
    os.chdir(test_dir)
    
    # Run tests
    exit_code = run_tests(test_type, skip_slow)
    
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
