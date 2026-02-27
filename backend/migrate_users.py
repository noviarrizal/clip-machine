"""
Quick migration script to create the users table via the Supabase REST API.
Run: python migrate_users.py
"""
import os

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

url = os.environ["SUPABASE_URL"]
key = os.environ["SUPABASE_KEY"]

supabase = create_client(url, key)

# Create the users table by inserting a dummy record and catching the error,
# OR use the PostgREST RPC approach.
# Since we need raw DDL, we use the postgres function feature of supabase.

SQL = """
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'users'
          AND policyname = 'Allow all operations for anon on users'
    ) THEN
        CREATE POLICY "Allow all operations for anon on users"
            ON public.users FOR ALL USING (true);
    END IF;
END $$;
"""

print("Attempting to create users table via Supabase...")
try:
    result = supabase.rpc("exec_sql", {"sql": SQL}).execute()
    print("✅ Success!")
except Exception as e:
    print(f"Note: rpc exec_sql not available. Error: {e}")
    print()
    print("Please run this SQL manually in your Supabase SQL editor:")
    print("https://supabase.com/dashboard/project/_/sql")
    print()
    print(SQL)
