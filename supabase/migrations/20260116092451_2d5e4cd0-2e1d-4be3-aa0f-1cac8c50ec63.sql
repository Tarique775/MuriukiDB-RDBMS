-- Create a security definer function to fetch public leaderboard
CREATE OR REPLACE FUNCTION public.get_leaderboard_public()
RETURNS TABLE (
  id uuid,
  nickname text,
  xp integer,
  level integer,
  queries_executed integer,
  badges text[],
  tables_created integer,
  rows_inserted integer,
  current_streak integer,
  highest_streak integer,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, nickname, xp, level, queries_executed, badges, tables_created, rows_inserted, current_streak, highest_streak, created_at
  FROM public.leaderboard
  ORDER BY xp DESC
  LIMIT 100;
$$;

-- Grant execute permissions to both anon and authenticated
GRANT EXECUTE ON FUNCTION public.get_leaderboard_public() TO anon, authenticated;

-- Function to claim anonymous session data for authenticated user
CREATE OR REPLACE FUNCTION public.claim_session_data(p_session_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated to claim session data';
  END IF;
  
  -- Update tables: transfer ownership from session to user
  UPDATE public.rdbms_tables
  SET user_id = auth.uid(), session_id = NULL
  WHERE session_id = p_session_id AND user_id IS NULL;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.claim_session_data(text) TO authenticated;