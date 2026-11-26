'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

type Theme = 'light' | 'dark';

// Applies the theme by toggling the `.dark` class (matches globals.css tokens)
// and the native color-scheme (so form controls / scrollbars match). The initial
// class is set by an inline pre-paint script in layout.tsx to avoid a flash, so
// this only has to keep React state in sync and react to clicks.
function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
  try { localStorage.setItem('theme', theme); } catch { /* ignore */ }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  // Read the theme the pre-paint script already committed, so the icon matches
  // what's on screen on first render.
  useEffect(() => {
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    setMounted(true);
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    apply(next);
  };

  return (
    <button
      onClick={toggle}
      title={mounted ? `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode` : 'Toggle theme'}
      aria-label="Toggle color theme"
      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
    >
      {/* Render both until mounted to avoid a hydration mismatch, then show the
          one that flips to the *other* mode. */}
      {mounted && theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
