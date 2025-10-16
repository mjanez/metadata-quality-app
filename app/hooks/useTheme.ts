'use client';

import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark';

/**
 * Hook for managing dark/light theme
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);
  
  // Load theme from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('theme') as Theme | null;
    
    if (saved) {
      setTheme(saved);
      applyTheme(saved);
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const initialTheme = prefersDark ? 'dark' : 'light';
      setTheme(initialTheme);
      applyTheme(initialTheme);
    }
  }, []);
  
  /**
   * Apply theme to document
   */
  const applyTheme = (newTheme: Theme) => {
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };
  
  /**
   * Toggle between light and dark theme
   */
  const toggleTheme = () => {
    const newTheme: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
  };
  
  /**
   * Set specific theme
   */
  const setThemeValue = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
  };
  
  // Prevent flash of wrong theme
  if (!mounted) {
    return { theme: 'light', toggleTheme: () => {}, setTheme: () => {} };
  }
  
  return {
    theme,
    toggleTheme,
    setTheme: setThemeValue,
  };
}
