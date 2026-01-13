import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award, Crown, RefreshCw, User, Zap, Loader2, LogIn, LogOut } from 'lucide-react';
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
  const { stats, currentRank } = useGameStats();
  const { userInfo } = useUserFingerprint();
  const { user, signOut } = useAuth();

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      // Exclude browser_fingerprint from select for privacy
      const { data, error } = await supabase
        .from('leaderboard')
        .select('id, nickname, xp, level, queries_executed, badges, user_id')
        .order('xp', { ascending: false })
        .limit(100);
      
      if (!error && data) {
        setEntries(data);
        
        // Find my rank by user_id (authenticated) or check local registration
        if (user) {
          const myEntry = data.findIndex(e => e.user_id === user.id);
          if (myEntry !== -1) {
            setMyRank(myEntry + 1);
            setIsRegistered(true);
            setNickname(data[myEntry].nickname);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [user]);

  const syncStats = async () => {
    if (!user) {
      setShowAuth(true);
      return;
    }

    setSyncing(true);
    try {
      const { error } = await supabase
        .from('leaderboard')
        .update({
          xp: stats.xp,
          level: currentRank.level,
          queries_executed: stats.queriesExecuted,
          tables_created: stats.tablesCreated,
          rows_inserted: stats.rowsInserted,
          badges: stats.badges,
          current_streak: stats.streak,
          highest_streak: stats.highestStreak,
          last_seen: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) throw error;
      toast.success('Stats synced to leaderboard!');
      await fetchLeaderboard();
    } catch (error: any) {
      console.error('Error syncing stats:', error);
      toast.error(error.message || 'Failed to sync stats');
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
          <Button variant="ghost" size="icon" onClick={fetchLeaderboard} className="h-7 w-7">
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
        <ScrollArea className="flex-1 min-h-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="font-mono text-sm">Loading rankings...</span>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground font-mono text-sm">
              No players yet. Be the first!
            </div>
          ) : (
            <div className="space-y-2 pr-2">
              {entries.map((entry, index) => (
                <FadeContent key={entry.id} delay={index * 50} duration={300}>
                  <div
                    className={`flex items-center gap-3 p-3 rounded-lg transition-all hover:bg-primary/10 ${
                      user && entry.user_id === user.id
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
