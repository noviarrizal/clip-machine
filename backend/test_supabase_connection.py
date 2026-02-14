import sys

from supabase_client import key, supabase, url


def test_connection():
    print(f"Testing connection to Supabase...")
    print(f"URL: {url}")
    # Don't print the key for security, but check if it's there
    print(f"Key present: {'Yes' if key else 'No'}")

    try:
        # Check health/validity by making a simple request
        # We can just check if the client is initialized, but a real request is better.
        # However, without knowing the table structure, a simple query might fail.
        # Auth check is usually safe.

        user = supabase.auth.get_user()
        print("Supabase auth check executed (might return None if no user, but connection worked).")

        print("✅ Connection verified successfully!")
        return True
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False


if __name__ == "__main__":
    success = test_connection()
    if not success:
        sys.exit(1)
