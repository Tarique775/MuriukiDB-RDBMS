import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('muriukidb-theme') as Theme;
      return stored || 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    // Add transitioning class to prevent glitch
    root.classList.add('transitioning');
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('muriukidb-theme', theme);
    // Remove transitioning class after a brief delay
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.remove('transitioning');
      });
    });
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
