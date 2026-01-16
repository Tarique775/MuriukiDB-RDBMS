import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGameStats, getRankInfo } from '@/hooks/useGameStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  User, Edit2, Save, X, Loader2, Trophy, Zap, 
  Calendar, Flame, Target, Award, LogOut, AlertTriangle 
} from 'lucide-react';
import { toast } from 'sonner';
import { FadeContent } from './animations/FadeContent';
import { TerminalAuth } from './TerminalAuth';

interface LeaderboardEntry {
  id: string;
  nickname: string;
  xp: number;
  level: number;
  queries_executed: number;
  tables_created: number;
  rows_inserted: number;
  current_streak: number;
  highest_streak: number;
  badges: string[];
  created_at: string;
}

export function ProfilePanel() {
  const { user, signOut } = useAuth();
  const { stats, currentRank, isCoolingDown, cooldownMultiplier } = useGameStats();
  const [profile, setProfile] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  const [globalRank, setGlobalRank] = useState<number | null>(null);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    setLoading(true);
    
    try {
      // Fetch user's leaderboard entry
      const { data: profileData, error: profileError } = await supabase
        .from('leaderboard')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      
      if (profileData) {
        setProfile(profileData);
        setNewNickname(profileData.nickname);

        // Get global rank
        const { data: rankData } = await supabase
          .from('leaderboard')
          .select('id')
          .gte('xp', profileData.xp)
          .order('xp', { ascending: false });

        if (rankData) {
          const rank = rankData.findIndex(e => e.id === profileData.id) + 1;
          setGlobalRank(rank > 0 ? rank : null);
        }
      } else {
        // No profile exists - create one
        const nickname = user.user_metadata?.nickname || user.email?.split('@')[0] || 'Player';
        const { error: insertError } = await supabase.from('leaderboard').insert({
          nickname,
          user_id: user.id,
          xp: 0,
          level: 1,
          queries_executed: 0,
          tables_created: 0,
          rows_inserted: 0,
          badges: [],
          current_streak: 0,
          highest_streak: 0,
        });
        
        if (!insertError) {
          // Re-fetch the newly created profile
          const { data: newProfile } = await supabase
            .from('leaderboard')
            .select('*')
            .eq('user_id', user.id)
            .single();
          
          if (newProfile) {
            setProfile(newProfile);
            setNewNickname(newProfile.nickname);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNickname = async () => {
    if (!user || !newNickname.trim()) return;
    
    const trimmed = newNickname.trim().replace(/\s+/g, ' ');
    if (trimmed.length < 2 || trimmed.length > 20) {
      toast.error('Nickname must be 2-20 characters');
      return;
    }

    setSaving(true);
    try {
      // Check if nickname is taken by another user
      const { data: existing } = await supabase
        .from('leaderboard')
        .select('id')
        .eq('nickname', trimmed)
        .neq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        toast.error('Nickname already taken');
        return;
      }

      const { error } = await supabase
        .from('leaderboard')
        .update({ nickname: trimmed })
        .eq('user_id', user.id);

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, nickname: trimmed } : null);
      setEditing(false);
      toast.success('Nickname updated!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update nickname');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    toast.success('Logged out');
  };

  if (showAuth) {
    return (
      <div className="h-full">
        <TerminalAuth 
          onComplete={() => {
            setShowAuth(false);
            fetchProfile();
          }} 
          onCancel={() => setShowAuth(false)} 
        />
      </div>
    );
  }

  if (!user) {
    return (
      <Card className="glass-card border-primary/30">
        <CardContent className="py-6 space-y-4">
          <div className="text-center">
            <User className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-mono font-semibold mb-1">Not signed in</p>
            <p className="text-xs text-muted-foreground">Sign in to save your progress</p>
          </div>
          
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-xs font-mono text-destructive">
                Your local data will be lost after 7 days of inactivity if you don't sign up!
              </p>
            </div>
          </div>

          <Button 
            onClick={() => setShowAuth(true)} 
            className="w-full font-mono"
          >
            Sign In / Sign Up
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="glass-card border-primary/30">
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  // MERGED STATS: Always show max of local and server for consistency with navbar/achievements
  const mergedXp = Math.max(profile?.xp || 0, stats.xp);
  const mergedQueries = Math.max(profile?.queries_executed || 0, stats.queriesExecuted);
  const mergedTables = Math.max(profile?.tables_created || 0, stats.tablesCreated);
  const mergedStreak = Math.max(profile?.current_streak || 0, stats.streak);
  const mergedHighestStreak = Math.max(profile?.highest_streak || 0, stats.highestStreak);
  const mergedBadges = Array.from(new Set([...(profile?.badges || []), ...stats.badges]));

  // Use merged XP for rank calculation
  const rankInfo = getRankInfo(mergedXp);

  return (
    <Card className="glass-card border-primary/30 h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-mono flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            Your Profile
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="h-7 text-xs gap-1">
            <LogOut className="w-3 h-3" />
            Logout
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 overflow-auto scrollbar-thin">
        <FadeContent blur duration={300} className="space-y-4">
          {/* Nickname Section */}
          <div className="space-y-2">
            <Label className="text-xs font-mono text-muted-foreground">Nickname</Label>
            {editing ? (
              <div className="flex gap-2">
                <Input
                  value={newNickname}
                  onChange={(e) => setNewNickname(e.target.value)}
                  className="font-mono text-sm"
                  maxLength={20}
                  disabled={saving}
                />
                <Button 
                  size="icon" 
                  variant="ghost"
                  onClick={handleSaveNickname}
                  disabled={saving}
                  className="shrink-0"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                </Button>
                <Button 
                  size="icon" 
                  variant="ghost"
                  onClick={() => {
                    setEditing(false);
                    setNewNickname(profile?.nickname || '');
                  }}
                  disabled={saving}
                  className="shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-lg">
                  {profile?.nickname || user?.user_metadata?.nickname || user?.email?.split('@')[0] || 'Unknown'}
                </span>
                <Button 
                  size="icon" 
                  variant="ghost"
                  onClick={() => setEditing(true)}
                  className="h-7 w-7"
                >
                  <Edit2 className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>

          {/* Rank & XP - Using merged stats */}
          <div className="bg-secondary/30 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{rankInfo.icon}</span>
                <div>
                  <p className="font-mono font-bold text-sm">{rankInfo.name}</p>
                  <p className="text-xs text-muted-foreground">Level {rankInfo.level}</p>
                </div>
              </div>
              {globalRank && (
                <Badge variant="secondary" className="font-mono">
                  <Trophy className="w-3 h-3 mr-1" />
                  #{globalRank}
                </Badge>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="flex items-center gap-1">
                  <Zap className="w-3 h-3 text-yellow-400" />
                  {mergedXp.toLocaleString()} XP
                </span>
                {rankInfo.nextRankXp && (
                  <span className="text-muted-foreground">
                    Next: {rankInfo.nextRankXp.toLocaleString()} XP
                  </span>
                )}
              </div>
              <Progress value={rankInfo.progress} className="h-2" />
            </div>
            {isCoolingDown && (
              <p className="text-xs text-yellow-500 font-mono flex items-center gap-1">
                ⚡ Cooldown active ({Math.round(cooldownMultiplier * 100)}% XP)
              </p>
            )}
          </div>

          {/* Stats Grid - Using merged stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-secondary/20 rounded-lg p-2 text-center">
              <Target className="w-4 h-4 mx-auto mb-1 text-primary" />
              <p className="font-mono font-bold">{mergedQueries}</p>
              <p className="text-[10px] text-muted-foreground">Queries</p>
            </div>
            <div className="bg-secondary/20 rounded-lg p-2 text-center">
              <Calendar className="w-4 h-4 mx-auto mb-1 text-green-400" />
              <p className="font-mono font-bold">{mergedTables}</p>
              <p className="text-[10px] text-muted-foreground">Tables</p>
            </div>
            <div className="bg-secondary/20 rounded-lg p-2 text-center">
              <Flame className="w-4 h-4 mx-auto mb-1 text-orange-400" />
              <p className="font-mono font-bold">{mergedStreak}</p>
              <p className="text-[10px] text-muted-foreground">Day Streak</p>
            </div>
            <div className="bg-secondary/20 rounded-lg p-2 text-center">
              <Award className="w-4 h-4 mx-auto mb-1 text-purple-400" />
              <p className="font-mono font-bold">{mergedHighestStreak}</p>
              <p className="text-[10px] text-muted-foreground">Best Streak</p>
            </div>
          </div>

          {/* Badges - Using merged badges */}
          {mergedBadges.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-mono text-muted-foreground">Badges</Label>
              <div className="flex flex-wrap gap-1">
                {mergedBadges.map((badge) => (
                  <Badge key={badge} variant="outline" className="text-xs font-mono">
                    {badge}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Member Since */}
          {profile?.created_at && (
            <p className="text-xs text-muted-foreground font-mono text-center pt-2 border-t border-border/30">
              Member since {new Date(profile.created_at).toLocaleDateString()}
            </p>
          )}
        </FadeContent>
      </CardContent>
    </Card>
  );
}
