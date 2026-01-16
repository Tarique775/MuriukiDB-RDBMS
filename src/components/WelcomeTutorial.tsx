import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Terminal, Users, Code, Trophy, Keyboard, ChevronRight, ChevronLeft, X, Sun, Moon } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

interface TutorialStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  tip?: string;
  hasThemePicker?: boolean;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: 'Welcome to MuriukiDB!',
    description: 'A custom-built Relational Database Management System playground. Learn SQL, build tables, and track your progress!',
    icon: <Terminal className="w-8 h-8" />,
    tip: 'This is a fully functional SQL engine built from scratch.',
  },
  {
    title: 'Choose Your Theme',
    description: 'Select your preferred appearance. You can always change this later using the theme toggle in the header.',
    icon: <Sun className="w-8 h-8" />,
    hasThemePicker: true,
  },
  {
    title: 'SQL REPL',
    description: 'Write and execute SQL commands in real-time. Create tables, insert data, and run complex queries with JOINs, aggregates, and more.',
    icon: <Code className="w-8 h-8" />,
    tip: 'Try: SELECT * FROM contacts or CREATE TABLE users (...)',
  },
  {
    title: 'Demo App',
    description: 'A visual interface to manage data without writing SQL. Perfect for learning how CRUD operations work behind the scenes.',
    icon: <Users className="w-8 h-8" />,
    tip: 'Switch between Contacts, Users, Products, Orders, and Employees tables.',
  },
  {
    title: 'Sample Queries',
    description: 'Explore pre-built SQL examples organized by category. Click any query to load it into the REPL and execute it instantly.',
    icon: <Code className="w-8 h-8" />,
    tip: 'Start with Schema Setup to create tables, then Insert Data.',
  },
  {
    title: 'Earn XP & Badges',
    description: 'Every query you run earns XP! Level up, unlock achievements, and compete on the global leaderboard.',
    icon: <Trophy className="w-8 h-8" />,
    tip: 'Create tables (+50 XP), Insert data (+10 XP), Run queries (+5 XP)',
  },
  {
    title: 'Keyboard Shortcuts',
    description: 'Speed up your workflow with keyboard shortcuts. Press ? anytime to see all available shortcuts.',
    icon: <Keyboard className="w-8 h-8" />,
    tip: 'Ctrl+Enter to execute, ↑↓ for history, Tab to autocomplete.',
  },
];

const STORAGE_KEY = 'muriukidb-tutorial-completed';

interface WelcomeTutorialProps {
  onComplete: () => void;
}

export const WelcomeTutorial = ({ onComplete }: WelcomeTutorialProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    // Check if tutorial was already completed
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      setIsVisible(true);
    }
  }, []);

  const handleNext = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsVisible(false);
    onComplete();
  };

  const handleSkip = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsVisible(false);
    onComplete();
  };

  if (!isVisible) return null;

  const step = TUTORIAL_STEPS[currentStep];
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;
  const isFirstStep = currentStep === 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
      <Card className="glass-card border-primary/30 max-w-md mx-4 relative overflow-hidden">
        {/* Progress dots */}
        <div className="absolute top-4 right-4 flex gap-1.5">
          {TUTORIAL_STEPS.map((_, idx) => (
            <div
              key={idx}
              className={`w-2 h-2 rounded-full transition-colors ${
                idx === currentStep 
                  ? 'bg-primary' 
                  : idx < currentStep 
                    ? 'bg-primary/50' 
                    : 'bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Skip button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSkip}
          className="absolute top-3 left-3 h-7 w-7 text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </Button>

        <CardHeader className="pt-10 pb-4 text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary glow-border">
            {step.icon}
          </div>
          <CardTitle className="font-mono text-xl text-primary glow-text">
            {step.title}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4 pb-6">
          <p className="text-sm text-foreground text-center leading-relaxed">
            {step.description}
          </p>

          {step.hasThemePicker && (
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setTheme('light')}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  theme === 'light' 
                    ? 'border-primary bg-primary/10' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="w-16 h-12 rounded-lg bg-[hsl(60,10%,96%)] border border-[hsl(220,15%,80%)] flex items-center justify-center">
                  <Sun className="w-6 h-6 text-[hsl(45,90%,40%)]" />
                </div>
                <span className="text-sm font-medium">Light</span>
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  theme === 'dark' 
                    ? 'border-primary bg-primary/10' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="w-16 h-12 rounded-lg bg-[hsl(220,20%,8%)] border border-[hsl(142,30%,20%)] flex items-center justify-center">
                  <Moon className="w-6 h-6 text-[hsl(142,70%,45%)]" />
                </div>
                <span className="text-sm font-medium">Dark</span>
              </button>
            </div>
          )}

          {step.tip && (
            <div className="bg-secondary/30 rounded-lg p-3 border border-border/50">
              <p className="text-xs font-mono text-muted-foreground">
                💡 <span className="text-[hsl(var(--terminal-yellow))]">Tip:</span> {step.tip}
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handlePrev}
              disabled={isFirstStep}
              className="flex-1 font-mono text-sm gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>
            <Button
              onClick={handleNext}
              className="flex-1 font-mono text-sm gap-1"
            >
              {isLastStep ? 'Get Started' : 'Next'}
              {!isLastStep && <ChevronRight className="w-4 h-4" />}
            </Button>
          </div>

          <p className="text-[10px] text-center text-muted-foreground">
            Step {currentStep + 1} of {TUTORIAL_STEPS.length}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

// Hook to check if tutorial should be shown
export const useShouldShowTutorial = () => {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY);
    setShouldShow(!completed);
  }, []);

  return shouldShow;
};

// Function to reset tutorial (for testing)
export const resetTutorial = () => {
  localStorage.removeItem(STORAGE_KEY);
};
