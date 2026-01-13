-- Create table for tracking daily query activity (for server-side streaks)
CREATE TABLE public.daily_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  queries_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, activity_date)
);

-- Enable RLS
ALTER TABLE public.daily_activity ENABLE ROW LEVEL SECURITY;

-- RLS policies for daily_activity
CREATE POLICY "Users can view their own activity"
ON public.daily_activity FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity"
ON public.daily_activity FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own activity"
ON public.daily_activity FOR UPDATE
USING (auth.uid() = user_id);

-- Create table for rate limiting
CREATE TABLE public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL, -- IP address or user_id
  endpoint TEXT NOT NULL DEFAULT 'sql-execute',
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_request TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  backoff_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX idx_rate_limits_identifier_endpoint ON public.rate_limits(identifier, endpoint);
CREATE INDEX idx_rate_limits_window ON public.rate_limits(window_start);

-- Enable RLS (but allow edge function access via service role)
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- No public access - only service role can access this table
CREATE POLICY "Service role only"
ON public.rate_limits FOR ALL
USING (false)
WITH CHECK (false);

-- Function to compute current streak for a user
CREATE OR REPLACE FUNCTION public.compute_user_streak(p_user_id UUID)
RETURNS TABLE(current_streak INTEGER, highest_streak INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_streak INTEGER := 0;
  v_check_date DATE := CURRENT_DATE;
  v_has_today BOOLEAN;
  v_has_date BOOLEAN;
BEGIN
  -- Check if user has activity today
  SELECT EXISTS(
    SELECT 1 FROM daily_activity 
    WHERE user_id = p_user_id AND activity_date = CURRENT_DATE
  ) INTO v_has_today;
  
  -- If no activity today, start checking from yesterday
  IF NOT v_has_today THEN
    v_check_date := CURRENT_DATE - 1;
  END IF;
  
  -- Count consecutive days backwards
  LOOP
    SELECT EXISTS(
      SELECT 1 FROM daily_activity 
      WHERE user_id = p_user_id AND activity_date = v_check_date
    ) INTO v_has_date;
    
    EXIT WHEN NOT v_has_date;
    
    v_current_streak := v_current_streak + 1;
    v_check_date := v_check_date - 1;
  END LOOP;
  
  -- Get highest streak from leaderboard (or use current if higher)
  RETURN QUERY
  SELECT 
    v_current_streak,
    GREATEST(v_current_streak, COALESCE(l.highest_streak, 0))
  FROM leaderboard l
  WHERE l.user_id = p_user_id;
  
  -- If no leaderboard entry, just return current values
  IF NOT FOUND THEN
    current_streak := v_current_streak;
    highest_streak := v_current_streak;
    RETURN NEXT;
  END IF;
END;
$$;

-- Function to record daily activity and update streaks
CREATE OR REPLACE FUNCTION public.record_query_activity(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_streak RECORD;
BEGIN
  -- Upsert daily activity
  INSERT INTO daily_activity (user_id, activity_date, queries_count)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, activity_date) 
  DO UPDATE SET 
    queries_count = daily_activity.queries_count + 1,
    updated_at = now();
  
  -- Compute and update streaks in leaderboard
  SELECT * INTO v_streak FROM compute_user_streak(p_user_id);
  
  IF v_streak IS NOT NULL THEN
    UPDATE leaderboard
    SET 
      current_streak = v_streak.current_streak,
      highest_streak = GREATEST(highest_streak, v_streak.highest_streak),
      last_seen = now()
    WHERE user_id = p_user_id;
  END IF;
END;
$$;

-- Trigger to update updated_at on daily_activity
CREATE TRIGGER update_daily_activity_updated_at
BEFORE UPDATE ON public.daily_activity
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();