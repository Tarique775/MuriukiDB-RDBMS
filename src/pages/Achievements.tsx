import { useGameStats, BADGES, RANKS } from '@/hooks/useGameStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { 
  Trophy, Star, Zap, Target, Database, 
  Table2, ArrowLeft, Lock, CheckCircle2, Flame, Crown
} from 'lucide-react';
import { FadeContent } from '@/components/animations/FadeContent';
import { DecryptedText } from '@/components/animations/DecryptedText';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AppFooter } from '@/components/AppFooter';

export default function Achievements() {
  const { stats, currentRank, isCoolingDown, cooldownMultiplier } = useGameStats();

  const allBadges = Object.entries(BADGES);
  const earnedCount = stats.badges.length;
  const totalCount = allBadges.length;

  // Find next major milestones
  const milestoneRanks = RANKS.filter(r => [4, 14, 17, 21, 23].includes(r.id)); // Sergeant, Captain, Colonel, General, CiC

  return (
    <div className="min-h-screen bg-background text-foreground matrix-bg">
      {/* Header */}
      <header className="border-b border-border/50 glass-card sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <Link to="/">
                <Button variant="ghost" size="icon" className="hover:bg-primary/20">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <div>
                <h1 className="font-mono font-bold text-sm text-foreground glow-text">
                  <DecryptedText text="Achievements" speed={30} />
                </h1>
                <p className="font-mono text-[10px] text-muted-foreground">
                  {earnedCount}/{totalCount} badges unlocked
                </p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Player Stats Card */}
        <FadeContent blur duration={600}>
          <Card className="glass-card border-primary/30 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
            <CardContent className="relative p-6">
              <div className="flex flex-col md:flex-row items-center gap-6">
                {/* Rank Circle */}
                <div className="relative">
                  <div className={`w-32 h-32 rounded-full flex items-center justify-center border-4 glow-border ${
                    currentRank.id >= 23 
                      ? 'bg-gradient-to-br from-yellow-500/30 to-amber-500/30 border-yellow-500/50' 
                      : 'bg-gradient-to-br from-primary/30 to-accent/30 border-primary/50'
                  }`}>
                    <div className="text-center">
                      <span className="text-3xl">{currentRank.icon}</span>
                      <p className="text-xs text-foreground/80 font-semibold mt-1">RANK {currentRank.level}</p>
                    </div>
                  </div>
                  <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full border text-xs font-bold shadow-lg ${
                    currentRank.id >= 23 
                      ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300' 
                      : 'bg-primary/20 border-primary/50 text-primary'
                  }`}>
                    {currentRank.name}
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
                  <div className="glass-card p-4 rounded-lg text-center">
                    <Zap className="w-6 h-6 mx-auto mb-2 text-[hsl(var(--terminal-yellow))]" />
                    <p className="text-2xl font-bold font-mono">{stats.xp.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Total XP</p>
                  </div>
                  <div className="glass-card p-4 rounded-lg text-center">
                    <Database className="w-6 h-6 mx-auto mb-2 text-[hsl(var(--terminal-cyan))]" />
                    <p className="text-2xl font-bold font-mono">{stats.queriesExecuted}</p>
                    <p className="text-xs text-muted-foreground">Queries</p>
                  </div>
                  <div className="glass-card p-4 rounded-lg text-center">
                    <Table2 className="w-6 h-6 mx-auto mb-2 text-[hsl(var(--terminal-purple))]" />
                    <p className="text-2xl font-bold font-mono">{stats.tablesCreated}</p>
                    <p className="text-xs text-muted-foreground">Tables</p>
                  </div>
                  <div className="glass-card p-4 rounded-lg text-center">
                    <Flame className="w-6 h-6 mx-auto mb-2 text-[hsl(var(--terminal-orange))]" />
                    <p className="text-2xl font-bold font-mono">{stats.streak}</p>
                    <p className="text-xs text-muted-foreground">Day Streak</p>
                    {stats.highestStreak > 0 && (
                      <p className="text-[10px] text-[hsl(var(--terminal-yellow))] mt-1">
                        Best: {stats.highestStreak} 🏆
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Cooldown Warning */}
              {isCoolingDown && (
                <div className="mt-4 p-3 rounded-lg bg-destructive/20 border border-destructive/30 text-center">
                  <p className="text-sm font-mono text-destructive">
                    ⚠️ Fast Collector Cooldown Active — Rewards reduced to {Math.round(cooldownMultiplier * 100)}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    You've earned 1000+ XP in the last 24 hours. Wait for cooldown to reset.
                  </p>
                </div>
              )}

              {/* XP Progress to Next Rank */}
              <div className="mt-6">
                <div className="flex justify-between text-xs font-mono mb-2">
                  <span>{currentRank.icon} {currentRank.name}</span>
                  <span>{stats.xp.toLocaleString()} XP</span>
                  {currentRank.nextRankXp && (
                    <span>{RANKS.find(r => r.minXp === currentRank.nextRankXp)?.name || 'Next Rank'}</span>
                  )}
                </div>
                <Progress value={currentRank.progress} className="h-3" />
                {currentRank.nextRankXp && (
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    {(currentRank.nextRankXp - stats.xp).toLocaleString()} XP to next rank
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </FadeContent>

        {/* Rank Progress */}
        <FadeContent blur duration={600} delay={200}>
          <Card className="glass-card border-primary/30">
            <CardHeader>
            <CardTitle className="text-lg font-mono flex items-center gap-2">
              <Crown className="w-5 h-5 text-yellow-400" />
              SQL Command Ladder (0 → 1,000,000 XP)
            </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {RANKS.map((rank) => {
                  const achieved = stats.xp >= rank.minXp;
                  return (
                    <div
                      key={rank.id}
                      className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                        achieved 
                          ? 'glass-card border border-primary/30' 
                          : 'bg-secondary/20 opacity-60'
                      }`}
                    >
                      <span className="text-xl">{rank.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`font-mono text-sm font-bold truncate ${achieved ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {rank.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {rank.minXp.toLocaleString()} XP
                        </p>
                      </div>
                      {achieved && <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </FadeContent>

        {/* Badges Grid */}
        <FadeContent blur duration={600} delay={400}>
          <Card className="glass-card border-primary/30">
            <CardHeader>
              <CardTitle className="text-lg font-mono flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-400" />
                Badges
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {allBadges.map(([id, badge], index) => {
                  const earned = stats.badges.includes(id);
                  return (
                    <FadeContent key={id} delay={index * 100} duration={400}>
                      <div
                        className={`relative p-4 rounded-xl text-center transition-all duration-300 ${
                          earned 
                            ? 'glass-card border border-primary/50 hover:scale-105 hover:shadow-lg hover:shadow-primary/20' 
                            : 'bg-secondary/20 opacity-50'
                        }`}
                      >
                        <div className="text-4xl mb-2 transition-transform hover:scale-110">
                          {earned ? badge.icon : <Lock className="w-8 h-8 mx-auto text-muted-foreground/60" />}
                        </div>
                        <h4 className={`font-mono text-sm font-bold ${earned ? 'text-foreground' : 'text-foreground/60'}`}>
                          {badge.name}
                        </h4>
                        <p className={`text-xs mt-1 ${earned ? 'text-muted-foreground' : 'text-muted-foreground/70'}`}>{badge.desc}</p>
                        {earned && (
                          <CheckCircle2 className="absolute top-2 right-2 w-4 h-4 text-primary" />
                        )}
                      </div>
                    </FadeContent>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </FadeContent>

        {/* Challenge Banner */}
        <FadeContent blur duration={600} delay={600}>
          <Card className="glass-card border-accent/30 bg-gradient-to-r from-accent/10 via-primary/10 to-accent/10">
            <CardContent className="p-6 text-center">
              <h3 className="text-xl font-bold font-mono mb-2">
                <DecryptedText text="Pesapal Junior Dev Challenge '26" speed={40} sequential />
              </h3>
              <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
                This RDBMS was built as an entry for the Pesapal Junior Developer Challenge. 
                Keep earning XP and unlocking badges to reach Commander in Chief!
              </p>
              <p className="text-xs text-primary mt-2">
                🎯 Goal: Reach 1,000,000 XP to unlock GOD Mode and the Commander in Chief avatar!
              </p>
              <div className="mt-4">
                <Link to="/">
                  <Button className="font-mono gap-2">
                    <Target className="w-4 h-4" />
                    Back to REPL
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </FadeContent>
      </main>

      {/* Footer */}
      <AppFooter />
    </div>
  );
}
