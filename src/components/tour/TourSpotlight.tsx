import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface TourSpotlightProps {
  targetSelector: string;
  padding?: number;
  className?: string;
  onClick?: () => void;
}

export function TourSpotlight({ 
  targetSelector, 
  padding = 8, 
  className,
  onClick 
}: TourSpotlightProps) {
  const [rect, setRect] = useState<SpotlightRect | null>(null);

  const updatePosition = useCallback(() => {
    const target = document.querySelector(targetSelector);
    if (target) {
      const boundingRect = target.getBoundingClientRect();
      setRect({
        top: boundingRect.top - padding,
        left: boundingRect.left - padding,
        width: boundingRect.width + padding * 2,
        height: boundingRect.height + padding * 2,
      });
    } else {
      setRect(null);
    }
  }, [targetSelector, padding]);

  useEffect(() => {
    updatePosition();

    // Update on scroll and resize
    const handleUpdate = () => updatePosition();
    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    // Also update periodically in case of dynamic content
    const interval = setInterval(handleUpdate, 500);

    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
      clearInterval(interval);
    };
  }, [updatePosition]);

  if (!rect) return null;

  return (
    <>
      {/* Dark overlay with cutout */}
      <div 
        className={cn(
          "fixed inset-0 z-[9998] pointer-events-auto",
          className
        )}
        onClick={onClick}
        style={{
          background: 'rgba(0, 0, 0, 0.75)',
          clipPath: `polygon(
            0% 0%, 
            0% 100%, 
            ${rect.left}px 100%, 
            ${rect.left}px ${rect.top}px, 
            ${rect.left + rect.width}px ${rect.top}px, 
            ${rect.left + rect.width}px ${rect.top + rect.height}px, 
            ${rect.left}px ${rect.top + rect.height}px, 
            ${rect.left}px 100%, 
            100% 100%, 
            100% 0%
          )`,
        }}
      />
      
      {/* Spotlight border glow */}
      <div 
        className="fixed z-[9999] pointer-events-none rounded-lg border-2 border-primary shadow-[0_0_20px_rgba(var(--primary),0.5)]"
        style={{
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          boxShadow: '0 0 0 2px hsl(var(--primary)), 0 0 20px hsl(var(--primary) / 0.5)',
        }}
      />
    </>
  );
}
