import { useEffect, useState, useRef, useCallback } from 'react';

interface DecryptedTextProps {
  text: string;
  speed?: number;
  maxIterations?: number;
  sequential?: boolean;
  revealDirection?: 'start' | 'end' | 'center';
  characters?: string;
  className?: string;
  parentClassName?: string;
  encryptedClassName?: string;
  animateOn?: 'view' | 'hover';
  onAnimationComplete?: () => void;
}

const DEFAULT_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*()';

export function DecryptedText({
  text,
  speed = 50,
  maxIterations = 10,
  sequential = false,
  revealDirection = 'start',
  characters = DEFAULT_CHARS,
  className = '',
  parentClassName = '',
  encryptedClassName = 'text-muted-foreground',
  animateOn = 'view',
  onAnimationComplete,
}: DecryptedTextProps) {
  const [displayText, setDisplayText] = useState(text);
  const [isAnimating, setIsAnimating] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  const getRandomChar = useCallback(() => {
    return characters[Math.floor(Math.random() * characters.length)];
  }, [characters]);

  const animate = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);

    let iterations = 0;
    const totalLength = text.length;
    const revealedIndices = new Set<number>();

    const interval = setInterval(() => {
      if (sequential) {
        const revealIndex = revealDirection === 'start'
          ? revealedIndices.size
          : revealDirection === 'end'
            ? totalLength - 1 - revealedIndices.size
            : Math.floor(totalLength / 2) + (revealedIndices.size % 2 === 0 ? revealedIndices.size / 2 : -(revealedIndices.size + 1) / 2);

        if (revealIndex >= 0 && revealIndex < totalLength) {
          revealedIndices.add(revealIndex);
        }
      }

      setDisplayText(
        text.split('').map((char, index) => {
          if (char === ' ') return ' ';
          if (sequential && revealedIndices.has(index)) return char;
          if (!sequential && iterations >= maxIterations) return char;
          return getRandomChar();
        }).join('')
      );

      iterations++;
      const shouldStop = sequential
        ? revealedIndices.size >= totalLength
        : iterations >= maxIterations;

      if (shouldStop) {
        clearInterval(interval);
        setDisplayText(text);
        setIsAnimating(false);
        setHasAnimated(true);
        onAnimationComplete?.();
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, maxIterations, sequential, revealDirection, getRandomChar, isAnimating, onAnimationComplete]);

  useEffect(() => {
    if (animateOn !== 'view' || hasAnimated) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          animate();
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [animate, animateOn, hasAnimated]);

  const handleMouseEnter = () => {
    if (animateOn === 'hover' && !isAnimating) {
      animate();
    }
  };

  return (
    <span
      ref={containerRef}
      className={`inline-block ${parentClassName}`}
      onMouseEnter={handleMouseEnter}
    >
      {displayText.split('').map((char, index) => (
        <span
          key={index}
          className={char !== text[index] ? encryptedClassName : className}
        >
          {char}
        </span>
      ))}
    </span>
  );
}
