import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award, Crown, RefreshCw, User, Zap, Loader2, LogIn, LogOut, AlertCircle } from 'lucide-react';
import { useGameStats, BADGES, getRankInfo } from '@/hooks/useGameStats';
import { useUserFingerprint } from '@/hooks/useUserFingerprint';
import { useAuth } from '@/hooks/useAuth';
import { TerminalAuth } from './TerminalAuth';
import { toast } from 'sonner';
import { FadeContent } from './animations/FadeContent';

interface LeaderboardEntry {
  id: string;
  nickname: string;
  xp: number;
  level: number;
  queries_executed: number;
  badges: string[];
  browser_fingerprint?: string;
  user_id?: string;
}

export function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [nickname, setNickname] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const { stats, currentRank, migrateAnonymousStats, syncStatsToServer } = useGameStats();
  const { userInfo } = useUserFingerprint();
  const { user, signOut } = useAuth();

  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchLeaderboard = async (retryCount = 0) => {
    setLoading(true);
    setFetchError(null);
    try {
      // Use RPC function to bypass RLS and get public leaderboard data
      const { data, error } = await supabase.rpc('get_leaderboard_public');
      
      if (error) {
        console.error('Leaderboard fetch error:', error);
        // Retry on transient errors (406, network issues)
        if (retryCount < 3 && (error.code === '406' || error.message?.includes('network') || error.code === 'PGRST301')) {
          console.log(`[Leaderboard] Retrying fetch (attempt ${retryCount + 1})...`);
          setTimeout(() => fetchLeaderboard(retryCount + 1), 1000 * (retryCount + 1));
          return;
        }
        setFetchError(`Unable to load leaderboard (${error.code || 'unknown error'}). Try refreshing.`);
        setEntries([]);
      } else if (data) {
        setEntries(data as LeaderboardEntry[]);
        setFetchError(null);
        
        // Find my rank by fetching separately for current user (using main table with auth)
        if (user) {
          const { data: myData } = await supabase
            .from('leaderboard')
            .select('id, nickname')
            .eq('user_id', user.id)
            .single();
            
          if (myData) {
            const myEntry = (data as LeaderboardEntry[]).findIndex(e => e.id === myData.id);
            if (myEntry !== -1) {
              setMyRank(myEntry + 1);
              setIsRegistered(true);
              setNickname(myData.nickname);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      if (retryCount < 3) {
        setTimeout(() => fetchLeaderboard(retryCount + 1), 1000 * (retryCount + 1));
        return;
      }
      setFetchError('Unable to load leaderboard. Try refreshing.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard(0);
    // Migrate anonymous stats when user logs in
    if (user) {
      migrateAnonymousStats();
    }
  }, [user, migrateAnonymousStats]);

  // Server-side validation limits to prevent stats tampering
  const STATS_LIMITS = {
    MAX_XP: 10000000, // 10 million XP max (well above Commander in Chief)
    MAX_LEVEL: 23, // Max rank level
    MAX_QUERIES: 1000000, // 1 million queries max
    MAX_TABLES: 10000, // 10k tables max
    MAX_ROWS: 10000000, // 10 million rows max
    MAX_STREAK: 3650, // 10 years of daily streak max
    MAX_XP_PER_DAY: 50000, // Reasonable daily XP gain limit
  };

  const validateStats = (statsToSync: typeof stats): boolean => {
    // Check for impossibly high values that indicate tampering
    if (statsToSync.xp < 0 || statsToSync.xp > STATS_LIMITS.MAX_XP) {
      toast.error('Invalid XP value detected. Stats not synced.');
      return false;
    }
    if (statsToSync.queriesExecuted < 0 || statsToSync.queriesExecuted > STATS_LIMITS.MAX_QUERIES) {
      toast.error('Invalid query count detected. Stats not synced.');
      return false;
    }
    if (statsToSync.tablesCreated < 0 || statsToSync.tablesCreated > STATS_LIMITS.MAX_TABLES) {
      toast.error('Invalid table count detected. Stats not synced.');
      return false;
    }
    if (statsToSync.rowsInserted < 0 || statsToSync.rowsInserted > STATS_LIMITS.MAX_ROWS) {
      toast.error('Invalid row count detected. Stats not synced.');
      return false;
    }
    if (statsToSync.streak < 0 || statsToSync.streak > STATS_LIMITS.MAX_STREAK) {
      toast.error('Invalid streak value detected. Stats not synced.');
      return false;
    }
    if (statsToSync.highestStreak < 0 || statsToSync.highestStreak > STATS_LIMITS.MAX_STREAK) {
      toast.error('Invalid highest streak value detected. Stats not synced.');
      return false;
    }
    // highestStreak should never be less than current streak
    if (statsToSync.highestStreak < statsToSync.streak) {
      toast.error('Invalid streak values detected. Stats not synced.');
      return false;
    }
    return true;
  };

  const syncStats = async () => {
    if (!user) {
      setShowAuth(true);
      return;
    }

    // Prevent double-click
    if (syncing) return;

    // Validate stats before syncing to prevent tampering
    if (!validateStats(stats)) {
      console.warn('Stats validation failed - possible tampering detected');
      return;
    }

    setSyncing(true);
    try {
      await syncStatsToServer();
      toast.success('Stats synced to leaderboard!');
      await fetchLeaderboard();
    } catch (error: any) {
      console.error('Error syncing stats:', error);
      if (error.message?.includes('401') || error.message?.includes('403')) {
        toast.error('Session expired. Please login again.');
      } else {
        toast.error(error.message || 'Failed to sync stats');
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    setIsRegistered(false);
    setMyRank(null);
    setNickname('');
    toast.success('Logged out');
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-300" />;
    if (rank === 3) return <Award className="w-5 h-5 text-amber-600" />;
    return <span className="w-5 text-center text-sm font-mono text-muted-foreground">{rank}</span>;
  };

  // Show terminal auth if requested
  if (showAuth) {
    return (
      <div className="h-full">
        <TerminalAuth 
          onComplete={() => {
            setShowAuth(false);
            fetchLeaderboard();
          }} 
          onCancel={() => setShowAuth(false)} 
        />
      </div>
    );
  }

  return (
    <Card className="glass-card border-primary/30 h-full flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-mono flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-400" />
            Global Leaderboard
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={() => fetchLeaderboard(0)} className="h-7 w-7">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden">
        {/* Auth/Sync Section */}
        <FadeContent blur duration={500}>
          {user ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-primary truncate">✓ {nickname || user.email}</span>
                <Button variant="ghost" size="sm" onClick={handleLogout} className="h-6 text-xs gap-1">
                  <LogOut className="w-3 h-3" />
                  Logout
                </Button>
              </div>
              <Button onClick={syncStats} size="sm" className="w-full font-mono" disabled={syncing}>
                {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sync Stats'}
              </Button>
              {myRank && (
                <p className="text-xs text-primary font-mono text-center animate-pulse">
                  🏆 Your rank: #{myRank}
                </p>
              )}
            </div>
          ) : (
            <Button onClick={() => setShowAuth(true)} size="sm" className="w-full font-mono gap-2">
              <LogIn className="w-4 h-4" />
              Join Leaderboard
            </Button>
          )}
        </FadeContent>

        {/* Leaderboard List */}
        <ScrollArea className="flex-1 min-h-0 scrollbar-thin">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="font-mono text-sm">Loading rankings...</span>
            </div>
          ) : fetchError ? (
            <div className="text-center py-8 space-y-3">
              <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
              <p className="text-destructive font-mono text-sm">{fetchError}</p>
              <Button variant="outline" size="sm" onClick={() => fetchLeaderboard(0)} className="font-mono text-xs">
                <RefreshCw className="w-3 h-3 mr-1" />
                Retry
              </Button>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground font-mono text-sm">
              No players yet. Be the first!
            </div>
          ) : (
            <div className="space-y-2 pr-2">
              {!user && (
                <div className="mb-3 p-2 rounded-lg bg-destructive/10 border border-destructive/30">
                  <p className="text-xs font-mono text-destructive">
                    ⚠️ Sign up to save your progress! Unregistered data is deleted after 7 days of inactivity.
                  </p>
                </div>
              )}
              {entries.map((entry, index) => (
                <FadeContent key={entry.id} delay={index * 50} duration={300}>
                  <div
                    className={`flex items-center gap-3 p-3 rounded-lg transition-all hover:bg-primary/10 ${
                      myRank === index + 1
                        ? 'bg-primary/20 border border-primary/50'
                        : 'bg-secondary/30'
                    }`}
                  >
                    <div className="flex items-center justify-center w-8">
                      {getRankIcon(index + 1)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <User className="w-3 h-3 text-muted-foreground" />
                        <span className="font-mono text-sm font-bold truncate">
                          {entry.nickname}
                        </span>
                        <Badge variant="secondary" className="text-[10px] px-1.5">
                          LVL {getRankInfo(entry.xp).level}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Zap className="w-3 h-3 text-[hsl(var(--terminal-yellow))]" />
                          {entry.xp.toLocaleString()} XP
                        </span>
                        <div className="flex">
                          {entry.badges?.slice(0, 3).map((badgeId) => {
                            const badge = BADGES[badgeId as keyof typeof BADGES];
                            return badge ? (
                              <span key={badgeId} className="text-xs" title={badge.name}>
                                {badge.icon}
                              </span>
                            ) : null;
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </FadeContent>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
