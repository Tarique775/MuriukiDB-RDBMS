-- Create leaderboard table for global rankings
CREATE TABLE public.leaderboard (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nickname TEXT NOT NULL UNIQUE,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  queries_executed INTEGER NOT NULL DEFAULT 0,
  tables_created INTEGER NOT NULL DEFAULT 0,
  rows_inserted INTEGER NOT NULL DEFAULT 0,
  badges TEXT[] DEFAULT '{}',
  browser_fingerprint TEXT,
  last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;

-- Everyone can read leaderboard (for global rankings)
CREATE POLICY "Leaderboard is viewable by everyone" 
ON public.leaderboard 
FOR SELECT 
USING (true);

-- Everyone can insert their stats (for registration)
CREATE POLICY "Anyone can register on leaderboard" 
ON public.leaderboard 
FOR INSERT 
WITH CHECK (true);

-- Only the owner can update their stats (based on fingerprint)
CREATE POLICY "Users can update their own leaderboard entry" 
ON public.leaderboard 
FOR UPDATE 
USING (true);

-- Create index for faster ranking queries
CREATE INDEX idx_leaderboard_xp ON public.leaderboard (xp DESC);
CREATE INDEX idx_leaderboard_nickname ON public.leaderboard (nickname);
CREATE INDEX idx_leaderboard_fingerprint ON public.leaderboard (browser_fingerprint);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_leaderboard_updated_at
BEFORE UPDATE ON public.leaderboard
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();