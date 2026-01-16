import { useEffect, useCallback } from 'react';
import { useTour, TourStep } from '@/hooks/useTour';
import { TourSpotlight } from './TourSpotlight';
import { TourTooltip } from './TourTooltip';
import { toast } from 'sonner';

interface InteractiveTourProps {
  onSwitchToREPL?: () => void;
  onSwitchToDemoApp?: () => void;
  onOpenSamples?: () => void;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    target: '[data-tour="repl-banner"]',
    title: 'Welcome to the SQL REPL!',
    content: 'This is your command center for database operations. Type SQL commands here and watch them execute in real-time.',
    position: 'bottom',
  },
  {
    id: 'repl-input',
    target: '[data-tour="repl-input"]',
    title: 'Write Your First Query',
    content: 'Type SQL commands in this input area. Try: CREATE TABLE demo (id INTEGER PRIMARY KEY, name TEXT)',
    position: 'top',
  },
  {
    id: 'repl-shortcuts',
    target: '[data-tour="repl-shortcuts"]',
    title: 'Keyboard Shortcuts',
    content: 'Press Enter to execute, use ↑↓ arrows for history, and Tab for autocomplete. Ctrl+L clears the screen.',
    position: 'top',
  },
  {
    id: 'demo-tab',
    target: '[data-tour="demo-tab"]',
    title: 'Demo App Tab',
    content: 'Click here to switch to the visual Demo App - a GUI for managing data without writing SQL.',
    position: 'bottom',
  },
  {
    id: 'table-selector',
    target: '[data-tour="table-selector"]',
    title: 'Choose a Table',
    content: 'Switch between different table types: Contacts, Users, Products, Orders, and Employees. Each has its own schema.',
    position: 'bottom',
  },
  {
    id: 'load-sample',
    target: '[data-tour="load-sample"]',
    title: 'Load Sample Data',
    content: 'Click this button to populate the table with sample records. Great for testing queries!',
    position: 'bottom',
  },
  {
    id: 'data-table',
    target: '[data-tour="data-table"]',
    title: 'Your Data Table',
    content: 'View, edit, and delete records here. Use checkboxes for batch operations, and keyboard navigation works too!',
    position: 'top',
  },
  {
    id: 'samples-panel',
    target: '[data-tour="samples-btn"]',
    title: 'Sample Queries',
    content: 'Access pre-built SQL queries organized by category. Click any query to load it into the REPL instantly.',
    position: 'bottom',
  },
  {
    id: 'xp-display',
    target: '[data-tour="xp-display"]',
    title: 'Earn XP & Level Up!',
    content: 'Every query earns you XP! Create tables (+50), insert data (+10), run queries (+5). Compete on the leaderboard!',
    position: 'bottom',
  },
  {
    id: 'achievements',
    target: '[data-tour="achievements-link"]',
    title: 'Achievements & Badges',
    content: 'Check your progress, unlock badges, and climb the ranks from Private to Commander in Chief!',
    position: 'bottom',
  },
];

export function InteractiveTour({ onSwitchToREPL, onSwitchToDemoApp, onOpenSamples }: InteractiveTourProps) {
  const tour = useTour({
    steps: TOUR_STEPS,
    onComplete: () => {
      toast.success('🎉 Tour complete! You\'re ready to master SQL!', { duration: 4000 });
    },
  });

  // Handle step-specific actions
  useEffect(() => {
    if (!tour.isActive || !tour.currentStep) return;

    const stepId = tour.currentStep.id;
    
    // Auto-switch tabs based on current step
    if (stepId === 'welcome' || stepId === 'repl-input' || stepId === 'repl-shortcuts') {
      onSwitchToREPL?.();
    } else if (stepId === 'table-selector' || stepId === 'load-sample' || stepId === 'data-table') {
      onSwitchToDemoApp?.();
    } else if (stepId === 'demo-tab') {
      onSwitchToREPL?.(); // Show REPL so they can see the Demo tab
    }
  }, [tour.isActive, tour.currentStep, onSwitchToREPL, onSwitchToDemoApp]);

  // Keyboard navigation
  useEffect(() => {
    if (!tour.isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        tour.skip();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        tour.next();
      } else if (e.key === 'ArrowLeft') {
        tour.prev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tour.isActive, tour.next, tour.prev, tour.skip]);

  if (!tour.isActive || !tour.currentStep) {
    return null;
  }

  return (
    <>
      <TourSpotlight
        targetSelector={tour.currentStep.target}
        padding={tour.currentStep.highlightPadding ?? 8}
      />
      <TourTooltip
        targetSelector={tour.currentStep.target}
        title={tour.currentStep.title}
        content={tour.currentStep.content}
        position={tour.currentStep.position}
        currentStep={tour.currentStepIndex}
        totalSteps={tour.totalSteps}
        isFirstStep={tour.isFirstStep}
        isLastStep={tour.isLastStep}
        onNext={tour.next}
        onPrev={tour.prev}
        onSkip={tour.skip}
      />
    </>
  );
}

// Export tour control functions
export { useTour };
export type { TourStep };
