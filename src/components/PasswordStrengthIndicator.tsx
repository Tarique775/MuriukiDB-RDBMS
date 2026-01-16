import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface PasswordStrengthIndicatorProps {
  password: string;
  className?: string;
}

interface StrengthResult {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  colorClass: string;
}

function calculateStrength(password: string): StrengthResult {
  if (!password) {
    return { score: 0, label: 'Too weak', colorClass: 'bg-destructive' };
  }

  let score = 0;

  // Length checks
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;

  // Character variety checks
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  // Cap at 4 and cast properly
  const finalScore = (score > 4 ? 4 : score) as 0 | 1 | 2 | 3 | 4;

  const labels: Record<number, string> = {
    0: 'Too weak',
    1: 'Weak',
    2: 'Fair',
    3: 'Good',
    4: 'Strong',
  };

  const colorClasses: Record<number, string> = {
    0: 'bg-destructive',
    1: 'bg-orange-500',
    2: 'bg-yellow-500',
    3: 'bg-lime-500',
    4: 'bg-[hsl(var(--terminal-green))]',
  };

  return {
    score: finalScore,
    label: labels[finalScore],
    colorClass: colorClasses[finalScore],
  };
}

export function PasswordStrengthIndicator({ password, className }: PasswordStrengthIndicatorProps) {
  const strength = useMemo(() => calculateStrength(password), [password]);

  return (
    <div className={cn('font-mono text-xs space-y-1.5', className)}>
      {/* Strength bars */}
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className={cn(
              'h-1 flex-1 rounded-full transition-all duration-200',
              index < strength.score
                ? strength.colorClass
                : 'bg-muted/50'
            )}
          />
        ))}
      </div>
      
      {/* Strength label */}
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Strength:</span>
        <span
          className={cn(
            'font-medium',
            strength.score === 0 && 'text-destructive',
            strength.score === 1 && 'text-orange-500',
            strength.score === 2 && 'text-yellow-500',
            strength.score === 3 && 'text-lime-500',
            strength.score === 4 && 'text-[hsl(var(--terminal-green))]'
          )}
        >
          {strength.label}
        </span>
      </div>
    </div>
  );
}
