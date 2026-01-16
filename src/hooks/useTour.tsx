import { useState, useCallback, useEffect } from 'react';

export interface TourStep {
  id: string;
  target: string;
  title: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  action?: 'click' | 'type' | 'observe';
  actionTarget?: string;
  waitForSelector?: string;
  autoAdvance?: boolean;
  highlightPadding?: number;
  onEnter?: () => void;
}

interface UseTourOptions {
  steps: TourStep[];
  onComplete?: () => void;
  storageKey?: string;
}

const DEFAULT_STORAGE_KEY = 'muriukidb-interactive-tour-completed';

export function useTour({ steps, onComplete, storageKey = DEFAULT_STORAGE_KEY }: UseTourOptions) {
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const currentStep = steps[currentStepIndex] || null;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;
  const progress = steps.length > 0 ? ((currentStepIndex + 1) / steps.length) * 100 : 0;

  // Check if tour was completed before
  const isCompleted = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(storageKey) === 'true';
  }, [storageKey]);

  const markCompleted = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, 'true');
    }
  }, [storageKey]);

  const start = useCallback(() => {
    setCurrentStepIndex(0);
    setIsActive(true);
  }, []);

  const stop = useCallback(() => {
    setIsActive(false);
    setCurrentStepIndex(0);
  }, []);

  const next = useCallback(() => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      markCompleted();
      setIsActive(false);
      onComplete?.();
    }
  }, [currentStepIndex, steps.length, markCompleted, onComplete]);

  const prev = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  }, [currentStepIndex]);

  const skip = useCallback(() => {
    markCompleted();
    setIsActive(false);
    onComplete?.();
  }, [markCompleted, onComplete]);

  const goToStep = useCallback((index: number) => {
    if (index >= 0 && index < steps.length) {
      setCurrentStepIndex(index);
    }
  }, [steps.length]);

  // Call onEnter when step changes
  useEffect(() => {
    if (isActive && currentStep?.onEnter) {
      currentStep.onEnter();
    }
  }, [isActive, currentStepIndex, currentStep]);

  return {
    isActive,
    currentStep,
    currentStepIndex,
    isFirstStep,
    isLastStep,
    progress,
    totalSteps: steps.length,
    isCompleted,
    start,
    stop,
    next,
    prev,
    skip,
    goToStep,
  };
}

// Reset function for testing
export function resetInteractiveTour(storageKey = DEFAULT_STORAGE_KEY) {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(storageKey);
  }
}
