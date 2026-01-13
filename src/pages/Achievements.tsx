import { useGameStats, BADGES } from '@/hooks/useGameStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { 
  Trophy, Star, Zap, Target, Database, 
  Table2, ArrowLeft, Lock, CheckCircle2, Flame
} from 'lucide-react';
import { FadeContent } from '@/components/animations/FadeContent';
import { DecryptedText } from '@/components/animations/DecryptedText';
import { ThemeToggle } from '@/components/ThemeToggle';

const ACHIEVEMENT_TIERS = [
  { name: 'Novice', minLevel: 1, color: 'text-gray-400' },
  { name: 'Apprentice', minLevel: 5, color: 'text-green-400' },
  { name: 'Journeyman', minLevel: 10, color: 'text-blue-400' },
  { name: 'Expert', minLevel: 20, color: 'text-purple-400' },
  { name: 'Master', minLevel: 50, color: 'text-yellow-400' },
];

export default function Achievements() {
  const { stats, checkBadge } = useGameStats();

  const getTier = (level: number) => {
    return ACHIEVEMENT_TIERS.reduce((acc, tier) => 
      level >= tier.minLevel ? tier : acc
    , ACHIEVEMENT_TIERS[0]);
  };

  const tier = getTier(stats.level);
  const allBadges = Object.entries(BADGES);
  const earnedCount = stats.badges.length;
  const totalCount = allBadges.length;

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
                  {earnedCount}/{totalCount} unlocked
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
                {/* Level Circle */}
                <div className="relative">
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center border-4 border-primary/50 glow-border">
                    <div className="text-center">
                      <span className="text-4xl font-bold text-primary glow-text">{stats.level}</span>
                      <p className="text-xs text-muted-foreground">LEVEL</p>
                    </div>
                  </div>
                  <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-secondary text-xs font-bold ${tier.color}`}>
                    {tier.name}
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
                  </div>
                </div>
              </div>

              {/* XP Progress */}
              <div className="mt-6">
                <div className="flex justify-between text-xs font-mono mb-2">
                  <span>Level {stats.level}</span>
                  <span>{stats.xp} / {stats.xp + stats.xpToNextLevel} XP</span>
                  <span>Level {stats.level + 1}</span>
                </div>
                <Progress 
                  value={((stats.xp % (stats.xp + stats.xpToNextLevel)) / (stats.xp + stats.xpToNextLevel)) * 100} 
                  className="h-3"
                />
              </div>
            </CardContent>
          </Card>
        </FadeContent>

        {/* Badges Grid */}
        <FadeContent blur duration={600} delay={200}>
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
                  const earned = checkBadge(id);
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
                          {earned ? badge.icon : <Lock className="w-8 h-8 mx-auto text-muted-foreground" />}
                        </div>
                        <h4 className={`font-mono text-sm font-bold ${earned ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {badge.name}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1">{badge.desc}</p>
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

        {/* Tier Progress */}
        <FadeContent blur duration={600} delay={400}>
          <Card className="glass-card border-primary/30">
            <CardHeader>
              <CardTitle className="text-lg font-mono flex items-center gap-2">
                <Star className="w-5 h-5 text-primary" />
                Tier Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-2">
                {ACHIEVEMENT_TIERS.map((t, index) => (
                  <div key={t.name} className="flex-1 text-center">
                    <div 
                      className={`h-2 rounded-full mb-2 transition-all duration-500 ${
                        stats.level >= t.minLevel 
                          ? 'bg-primary' 
                          : 'bg-secondary'
                      }`}
                    />
                    <div className={`text-xs font-mono ${stats.level >= t.minLevel ? t.color : 'text-muted-foreground'}`}>
                      {t.name}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Lvl {t.minLevel}+
                    </div>
                  </div>
                ))}
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
                Keep earning XP and unlocking badges to show your SQL mastery!
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
      <footer className="border-t border-border/30 py-4 mt-auto">
        <div className="container mx-auto px-4">
          <p className="text-center text-xs font-mono text-muted-foreground">
            Built by Samuel-Muriuki in collaboration with ❤️{' '}
            <a href="https://lovable.dev/invite/A5KC0U8" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Lovable
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
