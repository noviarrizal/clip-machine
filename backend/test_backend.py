import time
import asyncio
from processor import download_and_process

async def run_test():
    # Use a short, high-quality video for testing (e.g., a 2-minute interview)
    TEST_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    JOB_ID = f"test_{int(time.time())}"

    print(f"--- Starting Backend Test [Job: {JOB_ID}] ---")

    try:
        start_time = time.time()

        # Call your clean engine (now async)
        results = await download_and_process(TEST_URL, JOB_ID)

        duration = time.time() - start_time

        print(f"\n✅ SUCCESS! Processed in {duration:.2f} seconds.")
        print("-" * 30)
        for clip in results['clips']:
            print(f"Clip {clip['id']}: {clip['url']} (Timestamp: {clip['timestamp']})")
            print(f"Reason: {clip.get('reason', 'N/A')}")
        print("-" * 30)
        print(f"Check the 'output/' folder to view your MP4s.")

    except Exception as e:
        print(f"\n❌ TEST FAILED!")
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    asyncio.run(run_test())
