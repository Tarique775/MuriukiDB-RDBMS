import { useGameStats, BADGES } from '@/hooks/useGameStats';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Zap, Trophy, Target, Flame, AlertTriangle } from 'lucide-react';

export const GameStats = () => {
  const { stats, currentRank, isCoolingDown, cooldownMultiplier } = useGameStats();

  return (
    <div className="flex items-center gap-1 sm:gap-2 md:gap-3">
      {/* Rank & XP */}
      <div className="flex items-center gap-1 sm:gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <div 
              data-tour="xp-display"
              className="flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded bg-primary/20 border border-primary/30 cursor-default"
            >
              <Trophy className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-primary" />
              <span className="text-[10px] sm:text-xs font-mono font-bold text-primary">LVL {currentRank.level}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-bold">{currentRank.icon} {currentRank.name}</p>
            <p className="text-xs text-muted-foreground">
              {stats.xp.toLocaleString()} XP
              {currentRank.nextRankXp && ` / ${currentRank.nextRankXp.toLocaleString()} XP`}
            </p>
          </TooltipContent>
        </Tooltip>
        <div className="w-12 sm:w-16 md:w-20 hidden md:block">
          <Progress value={currentRank.progress} className="h-1.5" />
        </div>
      </div>

      {/* Cooldown Indicator */}
      {isCoolingDown && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-0.5 sm:gap-1 px-1 sm:px-1.5 py-0.5 rounded bg-destructive/20 border border-destructive/30">
              <AlertTriangle className="w-2.5 sm:w-3 h-2.5 sm:h-3 text-destructive" />
              <span className="text-[8px] sm:text-[10px] font-mono text-destructive">{Math.round(cooldownMultiplier * 100)}%</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-bold">⚠️ Fast Collector Cooldown</p>
            <p className="text-xs text-muted-foreground">You've earned 1000+ XP in 24hrs. Rewards reduced until cooldown ends.</p>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Stats - hide on small/tablet screens */}
      <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-muted-foreground">
        <div className="flex items-center gap-1" title="Queries executed">
          <Zap className="w-3 h-3 text-[hsl(var(--terminal-yellow))]" />
          <span>{stats.queriesExecuted}</span>
        </div>
        <div className="flex items-center gap-1" title="Success rate">
          <Target className="w-3 h-3 text-[hsl(var(--terminal-cyan))]" />
          <span>{stats.queriesExecuted > 0 ? Math.round((stats.successfulQueries / stats.queriesExecuted) * 100) : 0}%</span>
        </div>
        {stats.streak > 0 && (
          <div className="flex items-center gap-1" title={`${stats.streak} day streak`}>
            <Flame className="w-3 h-3 text-[hsl(var(--terminal-orange))]" />
            <span>{stats.streak}</span>
          </div>
        )}
      </div>

      {/* Badges - show fewer on smaller screens */}
      <div className="flex items-center gap-0.5 sm:gap-1">
        {stats.badges.slice(-3).map((badgeId) => {
          const badge = BADGES[badgeId as keyof typeof BADGES];
          if (!badge) return null;
          return (
            <Tooltip key={badgeId}>
              <TooltipTrigger asChild>
                <span className="text-xs sm:text-sm cursor-default animate-fade-in">{badge.icon}</span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-bold">{badge.name}</p>
                <p className="text-xs text-muted-foreground">{badge.desc}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
};