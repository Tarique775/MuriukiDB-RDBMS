-- Create a function to get global rank for a given XP value
-- This bypasses RLS to count all users with more XP
CREATE OR REPLACE FUNCTION public.get_global_rank_for_xp(p_xp integer)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (COUNT(*) + 1)::integer
  FROM public.leaderboard
  WHERE xp > p_xp;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_global_rank_for_xp(integer) TO authenticated;

-- Add index for performance on XP lookups
CREATE INDEX IF NOT EXISTS idx_leaderboard_xp ON public.leaderboard(xp DESC);

-- Enable RLS on auth_email_otps if not already enabled
ALTER TABLE public.auth_email_otps ENABLE ROW LEVEL SECURITY;

-- Block all public access to OTPs - only service role can access
CREATE POLICY "Service role only for OTPs"
ON public.auth_email_otps FOR ALL
USING (false)
WITH CHECK (false);