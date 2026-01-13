import { useState, useEffect, createContext, useContext, ReactNode } from 'react';

interface GameStats {
  queriesExecuted: number;
  successfulQueries: number;
  tablesCreated: number;
  rowsInserted: number;
  level: number;
  xp: number;
  xpToNextLevel: number;
  badges: string[];
  streak: number;
  lastQueryDate: string | null;
}

interface GameStatsContextType {
  stats: GameStats;
  addXP: (amount: number, action: string) => void;
  incrementQueries: (success: boolean) => void;
  incrementTablesCreated: () => void;
  incrementRowsInserted: (count: number) => void;
  checkBadge: (badgeId: string) => boolean;
}

const defaultStats: GameStats = {
  queriesExecuted: 0,
  successfulQueries: 0,
  tablesCreated: 0,
  rowsInserted: 0,
  level: 1,
  xp: 0,
  xpToNextLevel: 100,
  badges: [],
  streak: 0,
  lastQueryDate: null,
};

const BADGES = {
  first_query: { name: 'First Query', icon: '🚀', desc: 'Execute your first SQL query' },
  table_creator: { name: 'Table Creator', icon: '📊', desc: 'Create your first table' },
  data_wizard: { name: 'Data Wizard', icon: '✨', desc: 'Insert 10 rows' },
  query_master: { name: 'Query Master', icon: '👑', desc: 'Execute 50 queries' },
  perfectionist: { name: 'Perfectionist', icon: '💯', desc: '10 successful queries in a row' },
  streak_starter: { name: 'Streak Starter', icon: '🔥', desc: 'Use the app 3 days in a row' },
  level_5: { name: 'Rising Star', icon: '⭐', desc: 'Reach level 5' },
  level_10: { name: 'SQL Expert', icon: '🏆', desc: 'Reach level 10' },
};

const GameStatsContext = createContext<GameStatsContextType | undefined>(undefined);

export const GameStatsProvider = ({ children }: { children: ReactNode }) => {
  const [stats, setStats] = useState<GameStats>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('muriukidb-stats');
      if (stored) {
        return JSON.parse(stored);
      }
    }
    return defaultStats;
  });

  useEffect(() => {
    localStorage.setItem('muriukidb-stats', JSON.stringify(stats));
  }, [stats]);

  const calculateLevel = (xp: number): { level: number; xpToNextLevel: number } => {
    let level = 1;
    let xpNeeded = 100;
    let totalXp = xp;

    while (totalXp >= xpNeeded) {
      totalXp -= xpNeeded;
      level++;
      xpNeeded = Math.floor(xpNeeded * 1.5);
    }

    return { level, xpToNextLevel: xpNeeded - totalXp };
  };

  const addXP = (amount: number, _action: string) => {
    setStats(prev => {
      const newXp = prev.xp + amount;
      const { level, xpToNextLevel } = calculateLevel(newXp);
      
      const newBadges = [...prev.badges];
      if (level >= 5 && !newBadges.includes('level_5')) {
        newBadges.push('level_5');
      }
      if (level >= 10 && !newBadges.includes('level_10')) {
        newBadges.push('level_10');
      }

      return { ...prev, xp: newXp, level, xpToNextLevel, badges: newBadges };
    });
  };

  const incrementQueries = (success: boolean) => {
    setStats(prev => {
      const newBadges = [...prev.badges];
      const queriesExecuted = prev.queriesExecuted + 1;
      const successfulQueries = success ? prev.successfulQueries + 1 : prev.successfulQueries;

      // Check streak
      const today = new Date().toDateString();
      let streak = prev.streak;
      if (prev.lastQueryDate !== today) {
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        streak = prev.lastQueryDate === yesterday ? prev.streak + 1 : 1;
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
        lastQueryDate: today,
      };
    });
  };

  const incrementTablesCreated = () => {
    setStats(prev => {
      const newBadges = [...prev.badges];
      if (!newBadges.includes('table_creator')) {
        newBadges.push('table_creator');
      }
      return { ...prev, tablesCreated: prev.tablesCreated + 1, badges: newBadges };
    });
  };

  const incrementRowsInserted = (count: number) => {
    setStats(prev => {
      const newBadges = [...prev.badges];
      const newTotal = prev.rowsInserted + count;
      if (newTotal >= 10 && !newBadges.includes('data_wizard')) {
        newBadges.push('data_wizard');
      }
      return { ...prev, rowsInserted: newTotal, badges: newBadges };
    });
  };

  const checkBadge = (badgeId: string) => stats.badges.includes(badgeId);

  return (
    <GameStatsContext.Provider value={{ stats, addXP, incrementQueries, incrementTablesCreated, incrementRowsInserted, checkBadge }}>
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

export { BADGES };
