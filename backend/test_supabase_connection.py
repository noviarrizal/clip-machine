import sys

from supabase_client import key, supabase, url


def test_connection():
    print(f"Testing connection to Supabase...")
    print(f"URL: {url}")
    # Don't print the key for security, but check if it's there
    print(f"Key present: {'Yes' if key else 'No'}")

    try:
        # Check if we can select from keys and jobs tables
        keys_check = supabase.table("keys").select("key").limit(1).execute()
        print(f"Supabase 'keys' table check: {len(keys_check.data) >= 0} (table exists)")

        jobs_check = supabase.table("jobs").select("job_id").limit(1).execute()
        print(f"Supabase 'jobs' table check: {len(jobs_check.data) >= 0} (table exists)")

        print("✅ Connection and tables verified successfully!")
        return True
    except Exception as e:
        print(f"❌ Connection or table check failed. Did you run the SQL script in Supabase? Error: {e}")
        return False


if __name__ == "__main__":
    success = test_connection()
    if not success:
        sys.exit(1)
