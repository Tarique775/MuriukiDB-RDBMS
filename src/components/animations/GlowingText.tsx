import { ReactNode } from 'react';

interface GlowingTextProps {
  children: ReactNode;
  className?: string;
  color?: string;
}

export function GlowingText({ children, className = '', color = 'var(--terminal-green)' }: GlowingTextProps) {
  return (
    <span
      className={`inline-block ${className}`}
      style={{
        textShadow: `0 0 10px hsl(${color} / 0.5), 0 0 20px hsl(${color} / 0.3), 0 0 30px hsl(${color} / 0.2)`,
      }}
    >
      {children}
    </span>
  );
}
