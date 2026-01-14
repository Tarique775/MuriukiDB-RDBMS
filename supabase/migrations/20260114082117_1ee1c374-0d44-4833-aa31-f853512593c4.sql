-- ============================================================
-- CREATE PUBLIC VIEW FOR LEADERBOARD (Hide sensitive data)
-- ============================================================

-- Create a view that excludes sensitive columns (user_id, browser_fingerprint)
CREATE OR REPLACE VIEW public.leaderboard_public
WITH (security_invoker=on) AS
SELECT 
  id,
  nickname,
  xp,
  level,
  queries_executed,
  tables_created,
  rows_inserted,
  current_streak,
  highest_streak,
  badges,
  last_seen,
  created_at
FROM public.leaderboard;

-- Grant access to the view
GRANT SELECT ON public.leaderboard_public TO anon, authenticated;

-- ============================================================
-- FIX DAILY ACTIVITY POLICIES - Add explicit auth check
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert their own activity" ON public.daily_activity;
DROP POLICY IF EXISTS "Users can update their own activity" ON public.daily_activity;
DROP POLICY IF EXISTS "Users can view their own activity" ON public.daily_activity;

-- Create new policies with explicit auth check
CREATE POLICY "Authenticated users can insert own activity"
ON public.daily_activity FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Authenticated users can update own activity"
ON public.daily_activity FOR UPDATE
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Authenticated users can view own activity"
ON public.daily_activity FOR SELECT
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);