import os
import psycopg2
from dotenv import load_dotenv

def main():
    print("Loading environment variables...")
    load_dotenv()

    # The PostgreSQL connection string should be in the .env file
    # Example: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
    database_url = os.environ.get("DATABASE_URL")
    
    if not database_url:
        print("❌ Error: DATABASE_URL not found in .env file.")
        print("To fix this:")
        print("1. Go to your Supabase Dashboard -> Project Settings -> Database")
        print("2. Scroll down to 'Connection string' -> 'URI'")
        print("3. Copy the string and add it to your backend/.env file as DATABASE_URL=...")
        print("4. Replace [YOUR-PASSWORD] with your actual database password.")
        return

    # Automatically URL-encode the password portion of the URL if it contains special characters
    import urllib.parse
    import re
    
    # Simple regex to extract the password part: postgresql://user:password@host...
    match = re.match(r"(postgresql://[^:]+:)([^@]+)(@.*)", database_url)
    if match:
        prefix, password, suffix = match.groups()
        # Only encode if it contains characters that need encoding (like $ or %)
        encoded_password = urllib.parse.quote(password)
        database_url = f"{prefix}{encoded_password}{suffix}"

    schema_file = "supabase_schema.sql"
    if not os.path.exists(schema_file):
        print(f"❌ Error: {schema_file} not found in the current directory.")
        return

    print("Reading SQL schema file...")
    with open(schema_file, "r", encoding="utf-8") as file:
        sql_script = file.read()

    print("Connecting to Supabase Database...")
    try:
        # Connect to the PostgreSQL database
        conn = psycopg2.connect(database_url)
        conn.autocommit = True
        cursor = conn.cursor()

        print("Executing SQL script...")
        cursor.execute(sql_script)

        print("✅ Success! Database tables created in Supabase.")
        
    except psycopg2.Error as e:
        print(f"❌ Database error occurred: {e}")
    except Exception as e:
        print(f"❌ An unexpected error occurred: {e}")
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()
            print("Database connection closed.")

if __name__ == "__main__":
    main()
