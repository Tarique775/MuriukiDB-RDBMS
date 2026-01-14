-- Update compute_user_streak to verify the caller is the authenticated user or has service role
-- This prevents users from computing streaks for other users
CREATE OR REPLACE FUNCTION public.compute_user_streak(p_user_id uuid)
 RETURNS TABLE(current_streak integer, highest_streak integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_current_streak INTEGER := 0;
  v_check_date DATE := CURRENT_DATE;
  v_has_today BOOLEAN;
  v_has_date BOOLEAN;
  v_caller_id uuid;
BEGIN
  -- Security check: Only allow users to compute their own streak
  -- or service role (for edge functions)
  v_caller_id := auth.uid();
  IF v_caller_id IS NOT NULL AND v_caller_id != p_user_id THEN
    RAISE EXCEPTION 'Access denied: Cannot compute streak for another user';
  END IF;

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
$function$;

-- Update record_query_activity to verify the caller is the authenticated user
CREATE OR REPLACE FUNCTION public.record_query_activity(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_streak RECORD;
  v_caller_id uuid;
BEGIN
  -- Security check: Only allow users to record their own activity
  -- or service role (for edge functions)
  v_caller_id := auth.uid();
  IF v_caller_id IS NOT NULL AND v_caller_id != p_user_id THEN
    RAISE EXCEPTION 'Access denied: Cannot record activity for another user';
  END IF;

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
$function$;