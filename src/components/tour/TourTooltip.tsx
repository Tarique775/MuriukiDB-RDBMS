import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Position = 'top' | 'bottom' | 'left' | 'right';

interface TourTooltipProps {
  targetSelector: string;
  title: string;
  content: string;
  position?: Position;
  currentStep: number;
  totalSteps: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

interface TooltipPosition {
  top: number;
  left: number;
  arrowPosition: Position;
}

export function TourTooltip({
  targetSelector,
  title,
  content,
  position = 'bottom',
  currentStep,
  totalSteps,
  isFirstStep,
  isLastStep,
  onNext,
  onPrev,
  onSkip,
}: TourTooltipProps) {
  const [tooltipPos, setTooltipPos] = useState<TooltipPosition | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const gap = 16;

  useEffect(() => {
    const updatePosition = () => {
      const target = document.querySelector(targetSelector);
      const tooltip = tooltipRef.current;
      if (!target || !tooltip) return;

      const targetRect = target.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let top = 0;
      let left = 0;
      let actualPosition = position;

      // Calculate position based on preferred direction
      switch (position) {
        case 'bottom':
          top = targetRect.bottom + gap;
          left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
          // Flip to top if not enough space
          if (top + tooltipRect.height > viewportHeight - 20) {
            top = targetRect.top - tooltipRect.height - gap;
            actualPosition = 'top';
          }
          break;
        case 'top':
          top = targetRect.top - tooltipRect.height - gap;
          left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
          // Flip to bottom if not enough space
          if (top < 20) {
            top = targetRect.bottom + gap;
            actualPosition = 'bottom';
          }
          break;
        case 'right':
          top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
          left = targetRect.right + gap;
          // Flip to left if not enough space
          if (left + tooltipRect.width > viewportWidth - 20) {
            left = targetRect.left - tooltipRect.width - gap;
            actualPosition = 'left';
          }
          break;
        case 'left':
          top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
          left = targetRect.left - tooltipRect.width - gap;
          // Flip to right if not enough space
          if (left < 20) {
            left = targetRect.right + gap;
            actualPosition = 'right';
          }
          break;
      }

      // Clamp to viewport
      left = Math.max(20, Math.min(left, viewportWidth - tooltipRect.width - 20));
      top = Math.max(20, Math.min(top, viewportHeight - tooltipRect.height - 20));

      setTooltipPos({ top, left, arrowPosition: actualPosition });
    };

    // Initial position after render
    const timer = setTimeout(updatePosition, 50);
    
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [targetSelector, position]);

  return (
    <div
      ref={tooltipRef}
      className="fixed z-[10000] w-80 max-w-[calc(100vw-40px)]"
      style={{
        top: tooltipPos?.top ?? -9999,
        left: tooltipPos?.left ?? -9999,
        visibility: tooltipPos ? 'visible' : 'hidden',
      }}
    >
      <Card className="glass-card border-primary/50 shadow-2xl animate-scale-in">
        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onSkip}
          className="absolute top-2 right-2 h-6 w-6 text-muted-foreground hover:text-foreground z-10"
        >
          <X className="w-4 h-4" />
        </Button>

        {/* Progress dots */}
        <div className="absolute top-3 left-3 flex gap-1">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-colors",
                i === currentStep
                  ? "bg-primary"
                  : i < currentStep
                  ? "bg-primary/50"
                  : "bg-muted"
              )}
            />
          ))}
        </div>

        <CardHeader className="pt-8 pb-2">
          <CardTitle className="font-mono text-base text-primary">
            {title}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4 pb-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {content}
          </p>

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={onPrev}
              disabled={isFirstStep}
              className="flex-1 font-mono text-xs gap-1"
            >
              <ChevronLeft className="w-3 h-3" />
              Back
            </Button>
            <Button
              size="sm"
              onClick={onNext}
              className="flex-1 font-mono text-xs gap-1"
            >
              {isLastStep ? 'Finish' : 'Next'}
              {!isLastStep && <ChevronRight className="w-3 h-3" />}
            </Button>
          </div>

          <p className="text-[10px] text-center text-muted-foreground">
            Step {currentStep + 1} of {totalSteps} • Press Esc to skip
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
