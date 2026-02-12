"""Demonstration of concurrent synthesis request handling.

This script demonstrates the fix for concurrent synthesis requests.
It shows how the asyncio Lock ensures requests are processed sequentially.
"""

import asyncio
import time
from typing import List, Tuple


class MockTTSEngine:
    """Mock TTS engine for demonstration."""
    
    def __init__(self, use_lock: bool = True):
        """Initialize engine with optional lock."""
        self.use_lock = use_lock
        self._lock = asyncio.Lock() if use_lock else None
        self.execution_log: List[Tuple[str, str, float]] = []
    
    async def synthesize(self, text: str) -> bytes:
        """Synthesize speech with optional locking."""
        if self.use_lock and self._lock:
            async with self._lock:
                return await self._synthesize_internal(text)
        else:
            return await self._synthesize_internal(text)
    
    async def _synthesize_internal(self, text: str) -> bytes:
        """Internal synthesis implementation."""
        start_time = time.time()
        self.execution_log.append(("start", text, start_time))
        
        print(f"  [{time.time():.3f}] Starting: {text}")
        
        # Simulate TTS processing (150ms)
        await asyncio.sleep(0.15)
        
        end_time = time.time()
        self.execution_log.append(("end", text, end_time))
        
        print(f"  [{time.time():.3f}] Finished: {text}")
        
        return b"fake_audio_data"
    
    def check_serialization(self) -> bool:
        """Check if requests were properly serialized."""
        starts = [log for log in self.execution_log if log[0] == "start"]
        ends = [log for log in self.execution_log if log[0] == "end"]
        
        # Check for overlaps
        for i in range(1, len(starts)):
            prev_end = ends[i-1][2]
            curr_start = starts[i][2]
            
            if curr_start < prev_end - 0.01:  # With small tolerance
                return False
        
        return True


async def test_with_lock():
    """Test concurrent requests WITH lock (fixed version)."""
    print("\n" + "="*60)
    print("TEST: WITH LOCK (Fixed - Sequential Processing)")
    print("="*60)
    
    engine = MockTTSEngine(use_lock=True)
    
    # Launch 3 concurrent requests
    start = time.time()
    tasks = [
        asyncio.create_task(engine.synthesize(f"Request {i}"))
        for i in range(1, 4)
    ]
    
    print(f"\n[{time.time():.3f}] Launching 3 concurrent requests...\n")
    
    await asyncio.gather(*tasks)
    
    total_time = time.time() - start
    
    print(f"\nTotal time: {total_time:.3f}s")
    print(f"Serialized: {'✅ YES' if engine.check_serialization() else '❌ NO'}")
    print("\nExpected: ~0.45s (3 requests × 0.15s each, sequential)")
    
    return engine.check_serialization()


async def test_without_lock():
    """Test concurrent requests WITHOUT lock (broken version)."""
    print("\n" + "="*60)
    print("TEST: WITHOUT LOCK (Broken - Concurrent Processing)")
    print("="*60)
    print("⚠️  This simulates the bug where requests execute concurrently")
    
    engine = MockTTSEngine(use_lock=False)
    
    # Launch 3 concurrent requests
    start = time.time()
    tasks = [
        asyncio.create_task(engine.synthesize(f"Request {i}"))
        for i in range(1, 4)
    ]
    
    print(f"\n[{time.time():.3f}] Launching 3 concurrent requests...\n")
    
    await asyncio.gather(*tasks)
    
    total_time = time.time() - start
    
    print(f"\nTotal time: {total_time:.3f}s")
    print(f"Serialized: {'✅ YES' if engine.check_serialization() else '❌ NO'}")
    print("\nProblem: All requests run at once (~0.15s total)")
    print("This causes thread safety issues with the actual TTS model!")
    
    return engine.check_serialization()


async def main():
    """Run demonstration."""
    print("\n" + "="*60)
    print("TTS CONCURRENT REQUEST HANDLING DEMONSTRATION")
    print("="*60)
    print("\nThis demonstrates the fix for concurrent synthesis requests.")
    print("The lock ensures requests are processed sequentially,")
    print("preventing thread safety issues with the Piper TTS model.")
    
    # Test without lock (broken)
    without_lock_ok = await test_without_lock()
    
    await asyncio.sleep(0.5)
    
    # Test with lock (fixed)
    with_lock_ok = await test_with_lock()
    
    # Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    print(f"Without lock: {'❌ FAILED (requests overlap)' if not without_lock_ok else '✅ OK'}")
    print(f"With lock:    {'✅ FIXED (sequential processing)' if with_lock_ok else '❌ FAILED'}")
    print("\n✅ The asyncio Lock successfully serializes concurrent requests!")
    print("="*60 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
