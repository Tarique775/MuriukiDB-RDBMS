import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award, Crown, RefreshCw, User, Zap } from 'lucide-react';
import { useGameStats, BADGES } from '@/hooks/useGameStats';
import { useUserFingerprint } from '@/hooks/useUserFingerprint';
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
}

export function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [nickname, setNickname] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [myRank, setMyRank] = useState<number | null>(null);
  const { stats } = useGameStats();
  const { userInfo } = useUserFingerprint();

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .order('xp', { ascending: false })
        .limit(100);
      
      if (!error && data) {
        setEntries(data);
        
        // Find my rank
        if (userInfo?.fingerprint) {
          const myEntry = data.findIndex(e => e.browser_fingerprint === userInfo.fingerprint);
          if (myEntry !== -1) {
            setMyRank(myEntry + 1);
            setIsRegistered(true);
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
    
    // Check for stored nickname
    const storedNickname = localStorage.getItem('muriukidb-nickname');
    if (storedNickname) {
      setNickname(storedNickname);
    }
  }, [userInfo]);

  const syncStats = async () => {
    if (!nickname.trim()) {
      toast.error('Please enter a nickname');
      return;
    }

    if (!userInfo?.fingerprint) {
      toast.error('Could not identify user');
      return;
    }

    try {
      // Check if already registered with this fingerprint
      const { data: existing } = await supabase
        .from('leaderboard')
        .select('id')
        .eq('browser_fingerprint', userInfo.fingerprint)
        .single();

      if (existing) {
        // Update existing entry
        const { error } = await supabase
          .from('leaderboard')
          .update({
            nickname: nickname.trim(),
            xp: stats.xp,
            level: stats.level,
            queries_executed: stats.queriesExecuted,
            tables_created: stats.tablesCreated,
            rows_inserted: stats.rowsInserted,
            badges: stats.badges,
            last_seen: new Date().toISOString(),
          })
          .eq('browser_fingerprint', userInfo.fingerprint);

        if (error) throw error;
        toast.success('Stats synced to leaderboard!');
      } else {
        // Check if nickname is taken
        const { data: nickCheck } = await supabase
          .from('leaderboard')
          .select('id')
          .eq('nickname', nickname.trim())
          .single();

        if (nickCheck) {
          toast.error('Nickname already taken!');
          return;
        }

        // Create new entry
        const { error } = await supabase
          .from('leaderboard')
          .insert({
            nickname: nickname.trim(),
            xp: stats.xp,
            level: stats.level,
            queries_executed: stats.queriesExecuted,
            tables_created: stats.tablesCreated,
            rows_inserted: stats.rowsInserted,
            badges: stats.badges,
            browser_fingerprint: userInfo.fingerprint,
          });

        if (error) throw error;
        toast.success('Registered on leaderboard!');
      }

      localStorage.setItem('muriukidb-nickname', nickname.trim());
      setIsRegistered(true);
      await fetchLeaderboard();
    } catch (error: any) {
      console.error('Error syncing stats:', error);
      toast.error(error.message || 'Failed to sync stats');
    }
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-300" />;
    if (rank === 3) return <Award className="w-5 h-5 text-amber-600" />;
    return <span className="w-5 text-center text-sm font-mono text-muted-foreground">{rank}</span>;
  };

  return (
    <Card className="glass-card border-primary/30">
      <CardHeader className="pb-3">
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
      <CardContent className="space-y-4">
        {/* Registration/Sync */}
        <FadeContent blur duration={500}>
          <div className="flex gap-2">
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Enter nickname..."
              className="font-mono text-sm glass-input"
              maxLength={20}
            />
            <Button onClick={syncStats} size="sm" className="font-mono">
              {isRegistered ? 'Sync' : 'Join'}
            </Button>
          </div>
          {myRank && (
            <p className="text-xs text-primary font-mono mt-2 animate-pulse">
              🏆 Your rank: #{myRank}
            </p>
          )}
        </FadeContent>

        {/* Leaderboard List */}
        <ScrollArea className="h-[300px]">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground font-mono text-sm">
              Loading rankings...
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground font-mono text-sm">
              No players yet. Be the first!
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry, index) => (
                <FadeContent key={entry.id} delay={index * 50} duration={300}>
                  <div
                    className={`flex items-center gap-3 p-3 rounded-lg transition-all hover:bg-primary/10 ${
                      userInfo?.fingerprint && entry.browser_fingerprint === userInfo.fingerprint
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
                          LVL {entry.level}
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
