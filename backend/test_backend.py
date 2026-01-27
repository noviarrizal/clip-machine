import time
from processor import download_and_process

def run_test():
    # Use a short, high-quality video for testing (e.g., a 2-minute interview)
    TEST_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ" 
    JOB_ID = f"test_{int(time.time())}"
    
    print(f"--- Starting Backend Test [Job: {JOB_ID}] ---")
    
    try:
        start_time = time.time()
        
        # Call your clean engine
        results = download_and_process(TEST_URL, JOB_ID)
        
        duration = time.time() - start_time
        
        print(f"\n✅ SUCCESS! Processed in {duration:.2f} seconds.")
        print("-" * 30)
        for clip in results:
            print(f"Clip {clip['id']}: {clip['url']} (Timestamp: {clip['timestamp']})")
        print("-" * 30)
        print(f"Check the 'output/' folder to view your MP4s.")

    except Exception as e:
        print(f"\n❌ TEST FAILED!")
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    run_test()