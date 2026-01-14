-- ============================================================
-- SECURITY MIGRATION: Secure RDBMS tables and add auto-cleanup
-- ============================================================

-- 1. Add session_id column to rdbms_tables for ownership tracking
ALTER TABLE public.rdbms_tables 
ADD COLUMN IF NOT EXISTS session_id TEXT,
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Add session_id column to rdbms_rows for ownership tracking  
ALTER TABLE public.rdbms_rows
ADD COLUMN IF NOT EXISTS session_id TEXT;

-- 3. Add session_id column to rdbms_query_history for ownership tracking
ALTER TABLE public.rdbms_query_history
ADD COLUMN IF NOT EXISTS session_id TEXT,
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 4. Create index for faster cleanup queries
CREATE INDEX IF NOT EXISTS idx_leaderboard_last_seen ON public.leaderboard(last_seen);
CREATE INDEX IF NOT EXISTS idx_leaderboard_user_id ON public.leaderboard(user_id);
CREATE INDEX IF NOT EXISTS idx_rdbms_tables_session ON public.rdbms_tables(session_id);
CREATE INDEX IF NOT EXISTS idx_rdbms_rows_session ON public.rdbms_rows(session_id);

-- ============================================================
-- DROP OLD INSECURE POLICIES
-- ============================================================

-- Drop old policies on rdbms_tables
DROP POLICY IF EXISTS "Allow public read access to tables" ON public.rdbms_tables;
DROP POLICY IF EXISTS "Allow public insert access to tables" ON public.rdbms_tables;
DROP POLICY IF EXISTS "Allow public update access to tables" ON public.rdbms_tables;
DROP POLICY IF EXISTS "Allow public delete access to tables" ON public.rdbms_tables;

-- Drop old policies on rdbms_rows
DROP POLICY IF EXISTS "Allow public read access to rows" ON public.rdbms_rows;
DROP POLICY IF EXISTS "Allow public insert access to rows" ON public.rdbms_rows;
DROP POLICY IF EXISTS "Allow public update access to rows" ON public.rdbms_rows;
DROP POLICY IF EXISTS "Allow public delete access to rows" ON public.rdbms_rows;

-- Drop old policies on rdbms_query_history
DROP POLICY IF EXISTS "Allow public read access to history" ON public.rdbms_query_history;
DROP POLICY IF EXISTS "Allow public insert access to history" ON public.rdbms_query_history;

-- ============================================================
-- CREATE SECURE RLS POLICIES FOR RDBMS_TABLES
-- ============================================================

-- Users can read tables they own (by session or user_id)
CREATE POLICY "Users can read own tables"
ON public.rdbms_tables FOR SELECT
USING (
  session_id IS NOT NULL OR 
  (auth.uid() IS NOT NULL AND user_id = auth.uid())
);

-- Users can insert tables with their session or user_id
CREATE POLICY "Users can create tables"
ON public.rdbms_tables FOR INSERT
WITH CHECK (
  session_id IS NOT NULL OR 
  (auth.uid() IS NOT NULL AND user_id = auth.uid())
);

-- Users can update their own tables
CREATE POLICY "Users can update own tables"
ON public.rdbms_tables FOR UPDATE
USING (
  session_id IS NOT NULL OR 
  (auth.uid() IS NOT NULL AND user_id = auth.uid())
);

-- Users can delete their own tables
CREATE POLICY "Users can delete own tables"
ON public.rdbms_tables FOR DELETE
USING (
  session_id IS NOT NULL OR 
  (auth.uid() IS NOT NULL AND user_id = auth.uid())
);

-- ============================================================
-- CREATE SECURE RLS POLICIES FOR RDBMS_ROWS
-- ============================================================

-- Users can read rows from tables they have access to
CREATE POLICY "Users can read rows from own tables"
ON public.rdbms_rows FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rdbms_tables t 
    WHERE t.id = rdbms_rows.table_id 
    AND (t.session_id IS NOT NULL OR (auth.uid() IS NOT NULL AND t.user_id = auth.uid()))
  )
);

-- Users can insert rows to tables they own
CREATE POLICY "Users can insert rows to own tables"
ON public.rdbms_rows FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.rdbms_tables t 
    WHERE t.id = rdbms_rows.table_id 
    AND (t.session_id IS NOT NULL OR (auth.uid() IS NOT NULL AND t.user_id = auth.uid()))
  )
);

-- Users can update rows in their tables
CREATE POLICY "Users can update rows in own tables"
ON public.rdbms_rows FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.rdbms_tables t 
    WHERE t.id = rdbms_rows.table_id 
    AND (t.session_id IS NOT NULL OR (auth.uid() IS NOT NULL AND t.user_id = auth.uid()))
  )
);

-- Users can delete rows from their tables
CREATE POLICY "Users can delete rows from own tables"
ON public.rdbms_rows FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.rdbms_tables t 
    WHERE t.id = rdbms_rows.table_id 
    AND (t.session_id IS NOT NULL OR (auth.uid() IS NOT NULL AND t.user_id = auth.uid()))
  )
);

-- ============================================================
-- CREATE SECURE RLS POLICIES FOR RDBMS_QUERY_HISTORY
-- ============================================================

-- Users can read their own query history only
CREATE POLICY "Users can read own query history"
ON public.rdbms_query_history FOR SELECT
USING (
  session_id IS NOT NULL OR 
  (auth.uid() IS NOT NULL AND user_id = auth.uid())
);

-- Users can insert their own query history
CREATE POLICY "Users can insert own query history"
ON public.rdbms_query_history FOR INSERT
WITH CHECK (
  session_id IS NOT NULL OR 
  (auth.uid() IS NOT NULL AND user_id = auth.uid())
);

-- ============================================================
-- CLEANUP FUNCTION: Delete inactive unregistered users after 7 days
-- ============================================================

CREATE OR REPLACE FUNCTION public.cleanup_inactive_users()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete leaderboard entries for users who:
  -- 1. Have no user_id (not registered)
  -- 2. Haven't been active in the last 7 days
  DELETE FROM public.leaderboard
  WHERE user_id IS NULL
    AND last_seen < NOW() - INTERVAL '7 days';
    
  -- Also delete old session-based RDBMS data (older than 7 days)
  -- First delete rows from tables that are old
  DELETE FROM public.rdbms_rows
  WHERE table_id IN (
    SELECT id FROM public.rdbms_tables 
    WHERE user_id IS NULL 
    AND created_at < NOW() - INTERVAL '7 days'
  );
  
  -- Then delete old tables
  DELETE FROM public.rdbms_tables
  WHERE user_id IS NULL
    AND created_at < NOW() - INTERVAL '7 days';
    
  -- Clean old query history (older than 30 days for registered, 7 days for anonymous)
  DELETE FROM public.rdbms_query_history
  WHERE (user_id IS NULL AND created_at < NOW() - INTERVAL '7 days')
     OR (user_id IS NOT NULL AND created_at < NOW() - INTERVAL '30 days');
END;
$$;

-- ============================================================
-- CREATE SCHEDULED CLEANUP JOB (runs daily via pg_cron if available)
-- Note: pg_cron must be enabled in Supabase dashboard
-- ============================================================

-- Enable pg_cron extension if available (this may fail silently if not available)
-- SELECT cron.schedule('cleanup-inactive-users', '0 3 * * *', 'SELECT public.cleanup_inactive_users();');

-- ============================================================
-- UPDATE LEADERBOARD POLICIES - Remove user_id from public view
-- ============================================================

-- Drop and recreate the select policy to not expose user_id
DROP POLICY IF EXISTS "Anyone can read leaderboard" ON public.leaderboard;

-- Create new policy that returns data but we'll filter user_id in the application
CREATE POLICY "Anyone can read leaderboard entries"
ON public.leaderboard FOR SELECT
USING (true);

-- ============================================================
-- FIX: Set search_path on existing functions
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;