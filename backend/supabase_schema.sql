-- Create keys table
CREATE TABLE IF NOT EXISTS public.keys (
    key TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create jobs table
CREATE TABLE IF NOT EXISTS public.jobs (
    job_id UUID PRIMARY KEY,
    status TEXT NOT NULL,
    url TEXT NOT NULL,
    error TEXT,
    clips JSONB,
    transcription JSONB,
    social_content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Set up Row Level Security (RLS)
-- For a simple backend integration using the service_role key, 
-- or if the API key used has full access, RLS can be optional.
-- Here we enable it but allow all operations for authenticated users (or anon if needed).
ALTER TABLE public.keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Creating basic policies to allow everything for now (you can restrict this in production)
CREATE POLICY "Allow all operations for anon on keys" ON public.keys FOR ALL USING (true);
CREATE POLICY "Allow all operations for anon on jobs" ON public.jobs FOR ALL USING (true);
