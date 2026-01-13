-- Add user_id column to leaderboard for optional authentication
ALTER TABLE public.leaderboard 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add highest_streak column to leaderboard
ALTER TABLE public.leaderboard
ADD COLUMN IF NOT EXISTS highest_streak INTEGER NOT NULL DEFAULT 0;

-- Add current_streak column to leaderboard
ALTER TABLE public.leaderboard
ADD COLUMN IF NOT EXISTS current_streak INTEGER NOT NULL DEFAULT 0;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_leaderboard_user_id ON public.leaderboard(user_id);

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can register on leaderboard" ON public.leaderboard;
DROP POLICY IF EXISTS "Leaderboard is viewable by everyone" ON public.leaderboard;
DROP POLICY IF EXISTS "Users can update their own leaderboard entry" ON public.leaderboard;

-- Anyone can read the leaderboard (but browser_fingerprint should be excluded in SELECT)
CREATE POLICY "Anyone can read leaderboard"
ON public.leaderboard FOR SELECT
USING (true);

-- Authenticated users can insert their own entries (linking to user_id)
-- Or unauthenticated users can insert with fingerprint only
CREATE POLICY "Users can insert leaderboard entries"
ON public.leaderboard FOR INSERT
WITH CHECK (
  (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR 
  (auth.uid() IS NULL AND user_id IS NULL)
);

-- Authenticated users can update their own entries by user_id
-- Or unauthenticated users can update by fingerprint
CREATE POLICY "Users can update own leaderboard entries"
ON public.leaderboard FOR UPDATE
USING (
  (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
  (auth.uid() IS NULL AND browser_fingerprint IS NOT NULL)
);

-- Authenticated users can delete their own entries
CREATE POLICY "Authenticated users can delete own entries"
ON public.leaderboard FOR DELETE
USING (auth.uid() IS NOT NULL AND user_id = auth.uid());