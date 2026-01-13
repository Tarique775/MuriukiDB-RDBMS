import React, { useState, useEffect, createContext, useContext, ReactNode, useCallback, useRef } from 'react';

interface PointEvent {
  amount: number;
  timestamp: number;
  reason: string;
}

interface GameStats {
  queriesExecuted: number;
  successfulQueries: number;
  tablesCreated: number;
  rowsInserted: number;
  xp: number;
  badges: string[];
  streak: number;
  highestStreak: number; // Tracks the best streak ever achieved
  lastQueryDate: string | null;
  pointEvents: PointEvent[]; // For cooldown tracking
}

interface GameStatsContextType {
  stats: GameStats;
  currentRank: RankInfo;
  addXP: (amount: number, action: string) => number; // Returns actual XP awarded
  incrementQueries: (success: boolean) => void;
  incrementTablesCreated: () => void;
  incrementRowsInserted: (count: number) => void;
  checkBadge: (badgeId: string) => boolean;
  isCoolingDown: boolean;
  cooldownMultiplier: number;
}

interface RankInfo {
  id: number;
  name: string;
  icon: string;
  minXp: number;
  nextRankXp: number | null;
  progress: number;
  level: number;
}

// 23 Military Ranks from Private (0) to Commander in Chief (1,000,000)
const RANKS: Array<{ id: number; name: string; icon: string; minXp: number }> = [
  { id: 1, name: 'Private', icon: '👨‍🏭', minXp: 0 },
  { id: 2, name: 'Private First Class', icon: '🎖️', minXp: 50 },
  { id: 3, name: 'Corporal', icon: '🎖️', minXp: 150 },
  { id: 4, name: 'Sergeant', icon: '🎖️', minXp: 350 },
  { id: 5, name: 'Staff Sergeant', icon: '⚔️', minXp: 700 },
  { id: 6, name: 'Sergeant First Class', icon: '⚔️', minXp: 1200 },
  { id: 7, name: 'Master Sergeant', icon: '⚔️', minXp: 2000 },
  { id: 8, name: 'First Sergeant', icon: '🏅', minXp: 3500 },
  { id: 9, name: 'Sergeant Major', icon: '🏅', minXp: 5500 },
  { id: 10, name: 'Warrant Officer', icon: '🎯', minXp: 8500 },
  { id: 11, name: 'Chief Warrant Officer', icon: '🎯', minXp: 13000 },
  { id: 12, name: '2nd Lieutenant', icon: '⭐', minXp: 20000 },
  { id: 13, name: '1st Lieutenant', icon: '⭐', minXp: 30000 },
  { id: 14, name: 'Captain', icon: '⭐⭐', minXp: 45000 },
  { id: 15, name: 'Major', icon: '🌟', minXp: 65000 },
  { id: 16, name: 'Lieutenant Colonel', icon: '🌟', minXp: 95000 },
  { id: 17, name: 'Colonel', icon: '🦅', minXp: 135000 },
  { id: 18, name: 'Brigadier General', icon: '⚜️', minXp: 190000 },
  { id: 19, name: 'Major General', icon: '⚜️⚜️', minXp: 270000 },
  { id: 20, name: 'Lieutenant General', icon: '🎖️⚜️', minXp: 380000 },
  { id: 21, name: 'General', icon: '🎖️🎖️', minXp: 540000 },
  { id: 22, name: 'General of the Army', icon: '🎖️🎖️🎖️', minXp: 750000 },
  { id: 23, name: 'Commander in Chief', icon: '👑', minXp: 1000000 },
];

// Cooldown settings
const FAST_GAIN_LIMIT = 1000; // Max points in 24 hours before cooldown
const COOLDOWN_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const COOLDOWN_REDUCTION_FACTOR = 0.2; // Reduce rewards to 20% when cooling down

const defaultStats: GameStats = {
  queriesExecuted: 0,
  successfulQueries: 0,
  tablesCreated: 0,
  rowsInserted: 0,
  xp: 0,
  badges: [],
  streak: 0,
  highestStreak: 0,
  lastQueryDate: null,
  pointEvents: [],
};

const BADGES: Record<string, { name: string; icon: string; desc: string }> = {
  first_query: { name: 'First Query', icon: '🚀', desc: 'Execute your first SQL query' },
  table_creator: { name: 'Table Creator', icon: '📊', desc: 'Create your first table' },
  data_wizard: { name: 'Data Wizard', icon: '✨', desc: 'Insert 10 rows' },
  query_master: { name: 'Query Master', icon: '👑', desc: 'Execute 50 queries' },
  perfectionist: { name: 'Perfectionist', icon: '💯', desc: '10 successful queries in a row' },
  streak_starter: { name: 'Streak Starter', icon: '🔥', desc: 'Use the app 3 days in a row' },
  rank_sergeant: { name: 'Sergeant', icon: '🎖️', desc: 'Reach Sergeant rank' },
  rank_captain: { name: 'Captain', icon: '⭐⭐', desc: 'Reach Captain rank' },
  rank_colonel: { name: 'Colonel', icon: '🦅', desc: 'Reach Colonel rank' },
  rank_general: { name: 'General', icon: '🎖️🎖️', desc: 'Reach General rank' },
  god_mode: { name: 'GOD Mode', icon: '👑✨', desc: 'Reach Commander in Chief (1M XP)' },
};

const GameStatsContext = createContext<GameStatsContextType | undefined>(undefined);

const getRankInfo = (xp: number): RankInfo => {
  let currentRank = RANKS[0];
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (xp >= RANKS[i].minXp) {
      currentRank = RANKS[i];
      break;
    }
  }
  
  const nextRank = RANKS.find(r => r.minXp > xp);
  const nextRankXp = nextRank?.minXp || null;
  
  let progress = 100;
  if (nextRankXp) {
    const currentMin = currentRank.minXp;
    const range = nextRankXp - currentMin;
    progress = Math.min(100, ((xp - currentMin) / range) * 100);
  }
  
  return {
    id: currentRank.id,
    name: currentRank.name,
    icon: currentRank.icon,
    minXp: currentRank.minXp,
    nextRankXp,
    progress,
    level: currentRank.id,
  };
};

export const GameStatsProvider = ({ children }: { children: ReactNode }) => {
  const [stats, setStats] = useState<GameStats>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('muriukidb-stats');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          // Ensure pointEvents and highestStreak exist for migration
          return { 
            ...defaultStats, 
            ...parsed, 
            pointEvents: parsed.pointEvents || [],
            highestStreak: parsed.highestStreak ?? parsed.streak ?? 0
          };
        } catch {
          return defaultStats;
        }
      }
    }
    return defaultStats;
  });

  const [currentRank, setCurrentRank] = useState<RankInfo>(() => getRankInfo(stats.xp));
  const previousRankRef = useRef(currentRank.id);

  // Calculate cooldown status
  const now = Date.now();
  const recentPoints = stats.pointEvents
    .filter(e => now - e.timestamp < COOLDOWN_WINDOW_MS)
    .reduce((sum, e) => sum + e.amount, 0);
  
  const isCoolingDown = recentPoints >= FAST_GAIN_LIMIT;
  const cooldownMultiplier = isCoolingDown ? COOLDOWN_REDUCTION_FACTOR : 1;

  useEffect(() => {
    localStorage.setItem('muriukidb-stats', JSON.stringify(stats));
    const newRank = getRankInfo(stats.xp);
    setCurrentRank(newRank);
    
    // Rank up notification handled elsewhere to avoid double state updates
    previousRankRef.current = newRank.id;
  }, [stats]);

  const addXP = useCallback((amount: number, reason: string): number => {
    if (amount <= 0) return 0;
    
    // Calculate actual amount with cooldown
    const now = Date.now();
    const recentPoints = stats.pointEvents
      .filter(e => now - e.timestamp < COOLDOWN_WINDOW_MS)
      .reduce((sum, e) => sum + e.amount, 0);
    
    const isUnderCooldown = recentPoints >= FAST_GAIN_LIMIT;
    const actualAmount = Math.floor(isUnderCooldown ? amount * COOLDOWN_REDUCTION_FACTOR : amount);
    
    if (actualAmount <= 0) return 0;
    
    setStats(prev => {
      const newXp = prev.xp + actualAmount;
      const newBadges = [...prev.badges];
      
      // Check rank-based badges
      const newRank = getRankInfo(newXp);
      if (newRank.id >= 4 && !newBadges.includes('rank_sergeant')) {
        newBadges.push('rank_sergeant');
      }
      if (newRank.id >= 14 && !newBadges.includes('rank_captain')) {
        newBadges.push('rank_captain');
      }
      if (newRank.id >= 17 && !newBadges.includes('rank_colonel')) {
        newBadges.push('rank_colonel');
      }
      if (newRank.id >= 21 && !newBadges.includes('rank_general')) {
        newBadges.push('rank_general');
      }
      if (newRank.id >= 23 && !newBadges.includes('god_mode')) {
        newBadges.push('god_mode');
      }
      
      // Add point event for cooldown tracking, keep only last 48 hours
      const newPointEvents = [
        ...prev.pointEvents.filter(e => now - e.timestamp < COOLDOWN_WINDOW_MS * 2),
        { amount: actualAmount, timestamp: now, reason }
      ];
      
      return { 
        ...prev, 
        xp: newXp, 
        badges: newBadges,
        pointEvents: newPointEvents 
      };
    });
    
    return actualAmount;
  }, [stats.pointEvents]);

  const incrementQueries = useCallback((success: boolean) => {
    setStats(prev => {
      const newBadges = [...prev.badges];
      const queriesExecuted = prev.queriesExecuted + 1;
      const successfulQueries = success ? prev.successfulQueries + 1 : prev.successfulQueries;

      // Check streak
      const today = new Date().toDateString();
      let streak = prev.streak;
      let highestStreak = prev.highestStreak;
      
      if (prev.lastQueryDate !== today) {
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        if (prev.lastQueryDate === yesterday) {
          // Continued streak
          streak = prev.streak + 1;
        } else if (prev.lastQueryDate && prev.lastQueryDate !== yesterday) {
          // Streak broken - reset to 1
          streak = 1;
        } else {
          // First day ever or no previous date
          streak = 1;
        }
        // Update highest streak if current is higher
        highestStreak = Math.max(highestStreak, streak);
      }

      // Badge checks
      if (queriesExecuted === 1 && !newBadges.includes('first_query')) {
        newBadges.push('first_query');
      }
      if (queriesExecuted >= 50 && !newBadges.includes('query_master')) {
        newBadges.push('query_master');
      }
      if (streak >= 3 && !newBadges.includes('streak_starter')) {
        newBadges.push('streak_starter');
      }

      return {
        ...prev,
        queriesExecuted,
        successfulQueries,
        badges: newBadges,
        streak,
        highestStreak,
        lastQueryDate: today,
      };
    });
  }, []);

  const incrementTablesCreated = useCallback(() => {
    setStats(prev => {
      const newBadges = [...prev.badges];
      if (!newBadges.includes('table_creator')) {
        newBadges.push('table_creator');
      }
      return { ...prev, tablesCreated: prev.tablesCreated + 1, badges: newBadges };
    });
  }, []);

  const incrementRowsInserted = useCallback((count: number) => {
    setStats(prev => {
      const newBadges = [...prev.badges];
      const newTotal = prev.rowsInserted + count;
      if (newTotal >= 10 && !newBadges.includes('data_wizard')) {
        newBadges.push('data_wizard');
      }
      return { ...prev, rowsInserted: newTotal, badges: newBadges };
    });
  }, []);

  const checkBadge = useCallback((badgeId: string) => stats.badges.includes(badgeId), [stats.badges]);

  return (
    <GameStatsContext.Provider value={{ 
      stats, 
      currentRank,
      addXP, 
      incrementQueries, 
      incrementTablesCreated, 
      incrementRowsInserted, 
      checkBadge,
      isCoolingDown,
      cooldownMultiplier
    }}>
      {children}
    </GameStatsContext.Provider>
  );
};

export const useGameStats = () => {
  const context = useContext(GameStatsContext);
  if (context === undefined) {
    throw new Error('useGameStats must be used within a GameStatsProvider');
  }
  return context;
};

export { BADGES, RANKS, getRankInfo };
