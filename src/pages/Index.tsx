import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { REPL } from '@/components/REPL';
import { DemoAppManager } from '@/components/DemoAppManager';
import { QueryHistory } from '@/components/QueryHistory';
import { SampleQueries, findPrerequisiteQuery } from '@/components/SampleQueries';
import { GameStats } from '@/components/GameStats';
import { ThemeToggle } from '@/components/ThemeToggle';
import { TabButton } from '@/components/TabButton';
import { Leaderboard } from '@/components/Leaderboard';
import { ProfilePanel } from '@/components/ProfilePanel';
import { AppFooter } from '@/components/AppFooter';
import { FadeContent } from '@/components/animations/FadeContent';
import { DecryptedText } from '@/components/animations/DecryptedText';
import { KeyboardShortcutsModal, useKeyboardShortcuts } from '@/components/KeyboardShortcutsModal';
import { WelcomeTutorial } from '@/components/WelcomeTutorial';
import { TourSpotlight, TourTooltip } from '@/components/tour';
import { useTour } from '@/hooks/useTour';
import { TerminalAuth } from '@/components/TerminalAuth';
import { Terminal, Users, Github, History, Code, Trophy, Award, User, Keyboard, Play } from 'lucide-react';
import { useUserFingerprint } from '@/hooks/useUserFingerprint';
import { useAuth } from '@/hooks/useAuth';
import { useGameStats } from '@/hooks/useGameStats';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type Tab = 'repl' | 'contacts';
type SidePanel = 'history' | 'samples' | 'leaderboard' | 'profile';

// Tour steps definition
const TOUR_STEPS = [
  { id: 'welcome', target: '[data-tour="repl-banner"]', title: 'Welcome to the SQL REPL!', content: 'This is your command center for database operations. Type SQL commands here and watch them execute in real-time.', position: 'bottom' as const },
  { id: 'repl-input', target: '[data-tour="repl-input"]', title: 'Write Your First Query', content: 'Type SQL commands in this input area. Try: CREATE TABLE demo (id INTEGER PRIMARY KEY, name TEXT)', position: 'top' as const },
  { id: 'repl-shortcuts', target: '[data-tour="repl-shortcuts"]', title: 'Keyboard Shortcuts', content: 'Press Enter to execute, use ↑↓ arrows for history, and Tab for autocomplete. Ctrl+L clears the screen.', position: 'top' as const },
  { id: 'demo-tab', target: '[data-tour="demo-tab"]', title: 'Demo App Tab', content: 'Click here to switch to the visual Demo App - a GUI for managing data without writing SQL.', position: 'bottom' as const },
  { id: 'table-selector', target: '[data-tour="table-selector"]', title: 'Choose a Table', content: 'Switch between different table types: Contacts, Users, Products, Orders, and Employees.', position: 'bottom' as const },
  { id: 'load-sample', target: '[data-tour="load-sample"]', title: 'Load Sample Data', content: 'Click this button to populate the table with sample records. Great for testing queries!', position: 'bottom' as const },
  { id: 'samples-btn', target: '[data-tour="samples-btn"]', title: 'Sample Queries', content: 'Access pre-built SQL queries organized by category. Click any query to load it into the REPL instantly.', position: 'bottom' as const },
  { id: 'xp-display', target: '[data-tour="xp-display"]', title: 'Earn XP & Level Up!', content: 'Every query earns you XP! Create tables (+50), insert data (+10), run queries (+5).', position: 'bottom' as const },
  { id: 'achievements', target: '[data-tour="achievements-link"]', title: 'Achievements & Badges', content: 'Check your progress, unlock badges, and climb the ranks from Private to Commander in Chief!', position: 'bottom' as const },
];

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>('repl');
  const [sidePanel, setSidePanel] = useState<SidePanel>('samples');
  const [selectedQuery, setSelectedQuery] = useState('');
  const [mobilePanel, setMobilePanel] = useState<SidePanel | null>(null);
  const [highlightedQueryId, setHighlightedQueryId] = useState<string | null>(null);
  const [activeTableId, setActiveTableId] = useState('contacts');
  const [showTutorial, setShowTutorial] = useState(false);
  // Sheet states for mobile/tablet panels
  const [sampleSheetOpen, setSampleSheetOpen] = useState(false);
  const [historySheetOpen, setHistorySheetOpen] = useState(false);
  const [rankSheetOpen, setRankSheetOpen] = useState(false);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const { userInfo } = useUserFingerprint();
  const { user, isRecoveryMode, clearRecoveryMode } = useAuth();
  const { migrateAnonymousStats } = useGameStats();
  const { isOpen: shortcutsOpen, setIsOpen: setShortcutsOpen } = useKeyboardShortcuts();
  
  // Interactive tour
  const tour = useTour({
    steps: TOUR_STEPS,
    onComplete: () => {
      toast.success('🎉 Tour complete! You\'re ready to master SQL!', { duration: 4000 });
    },
    onSkip: () => {
      toast.info('Tour paused. Click the ▶ icon anytime to restart!', { duration: 3000 });
    },
  });

  // Handle auth errors from URL hash (e.g., expired email links)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('error=')) {
      const params = new URLSearchParams(hash.substring(1));
      const error = params.get('error');
      const errorCode = params.get('error_code');
      const errorDescription = params.get('error_description');
      
      if (error || errorCode) {
        const message = errorDescription?.replace(/\+/g, ' ') 
          || errorCode?.replace(/_/g, ' ') 
          || 'Authentication failed';
        
        toast.error(`Authentication Error: ${message}`, {
          description: 'Please try signing up again from the production site.',
          duration: 8000,
        });
        
        // Clear the hash from URL
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  }, []);

  // Handle tour step-based tab switching
  useEffect(() => {
    if (!tour.isActive || !tour.currentStep) return;
    const stepId = tour.currentStep.id;
    if (stepId === 'table-selector' || stepId === 'load-sample') {
      setActiveTab('contacts');
    } else if (stepId === 'welcome' || stepId === 'repl-input' || stepId === 'repl-shortcuts' || stepId === 'demo-tab') {
      setActiveTab('repl');
    }
  }, [tour.isActive, tour.currentStep]);

  // Keyboard navigation for tour
  useEffect(() => {
    if (!tour.isActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') tour.skip();
      else if (e.key === 'ArrowRight') tour.next();
      else if (e.key === 'ArrowLeft') tour.prev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tour.isActive, tour.next, tour.prev, tour.skip]);

  const handleTutorialComplete = useCallback(() => {
    setShowTutorial(false);
    // Optionally start interactive tour after tutorial
    // tour.start();
  }, []);

  // Global auth sync: claim session data + migrate stats when user logs in
  useEffect(() => {
    if (user) {
      // Run migration which handles claiming tables and merging stats
      migrateAnonymousStats();
    }
  }, [user, migrateAnonymousStats]);

  // Handle recovery mode - show password reset dialog when user clicks recovery link in email
  useEffect(() => {
    if (isRecoveryMode) {
      setShowPasswordReset(true);
    }
  }, [isRecoveryMode]);

  // Global keyboard shortcuts for tab switching
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      
      if (!isTyping && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === '1') {
          e.preventDefault();
          setActiveTab('repl');
        } else if (e.key === '2') {
          e.preventDefault();
          setActiveTab('contacts');
        }
      }
    };

    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, []);

  const handleSelectQuery = (query: string) => {
    setSelectedQuery(query);
    setActiveTab('repl');
    setMobilePanel(null);
    setHighlightedQueryId(null);
    // Close mobile/tablet sheets after query selection
    setSampleSheetOpen(false);
    setHistorySheetOpen(false);
  };

  const handleQueryError = (errorMessage: string, attemptedQuery: string) => {
    const hint = findPrerequisiteQuery(errorMessage, attemptedQuery);
    if (hint) {
      toast.error(hint.hint, { duration: 5000 });
      if (hint.queryId) {
        setSidePanel('samples');
        setHighlightedQueryId(hint.queryId);
      }
    }
  };

  const handleHighlightComplete = () => {
    setHighlightedQueryId(null);
  };

  return (
    <>
      <WelcomeTutorial 
        onComplete={() => setShowTutorial(false)} 
        onStartTour={() => {
          setShowTutorial(false);
          tour.start();
        }}
      />
      <KeyboardShortcutsModal open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      
      {/* Password Reset Dialog - shown when user clicks recovery link in email */}
      <Dialog open={showPasswordReset} onOpenChange={setShowPasswordReset}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden border-primary/30">
          <TerminalAuth 
            initialStep="recovery_new_password"
            onComplete={() => {
              setShowPasswordReset(false);
              clearRecoveryMode();
              toast.success('Password updated successfully!');
            }}
            onCancel={() => {
              setShowPasswordReset(false);
              clearRecoveryMode();
            }}
          />
        </DialogContent>
      </Dialog>
      <div className="h-screen flex flex-col bg-background text-foreground matrix-bg overflow-hidden">
        {/* Header */}
      <header className="border-b border-border/50 glass-card flex-shrink-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <FadeContent duration={500}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-primary/20 border border-primary/50 flex items-center justify-center glow-border glow-pulse">
                  <Terminal className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h1 className="font-mono font-bold text-sm text-foreground glow-text">
                    <DecryptedText text="MuriukiDB" speed={40} />
                  </h1>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {userInfo?.isReturning ? `Welcome back! Visit #${userInfo.visitCount}` : 'Custom RDBMS Engine'}
                  </p>
                </div>
              </div>
            </FadeContent>
            
            <nav className="hidden sm:flex items-center">
              <TabButton 
                active={activeTab === 'repl'} 
                onClick={() => setActiveTab('repl')}
                icon={<Terminal className="w-3.5 h-3.5" />}
              >
                SQL REPL
              </TabButton>
              <TabButton 
                active={activeTab === 'contacts'} 
                onClick={() => setActiveTab('contacts')}
                icon={<Users className="w-3.5 h-3.5" />}
                data-tour="demo-tab"
              >
                Demo App
              </TabButton>
            </nav>

            <div className="flex items-center gap-1 sm:gap-2">
              <GameStats />
              <Link to="/achievements" data-tour="achievements-link">
                <button className="p-1.5 sm:p-2 rounded-lg hover:bg-primary/20 transition-colors" title="Achievements">
                  <Award className="w-4 sm:w-5 h-4 sm:h-5 text-yellow-400" />
                </button>
              </Link>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    onClick={() => tour.start()}
                    className="p-1.5 sm:p-2 rounded-lg hover:bg-primary/20 transition-colors hidden sm:block" 
                    title="Start Tour"
                  >
                    <Play className="w-4 sm:w-5 h-4 sm:h-5 text-primary" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Start Interactive Tour</TooltipContent>
              </Tooltip>
              <button 
                onClick={() => setShortcutsOpen(true)}
                className="p-1.5 sm:p-2 rounded-lg hover:bg-primary/20 transition-colors hidden sm:block" 
                title="Keyboard Shortcuts (?)"
              >
                <Keyboard className="w-4 sm:w-5 h-4 sm:h-5 text-muted-foreground" />
              </button>
              <ThemeToggle />
              <a 
                href="https://github.com/Samuel-Muriuki" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors p-1.5"
                title="GitHub"
              >
                <Github className="w-4 sm:w-5 h-4 sm:h-5" />
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Tab Nav */}
      <div className="sm:hidden border-b border-border/50 glass-card flex-shrink-0">
        <div className="flex">
          <TabButton 
            active={activeTab === 'repl'} 
            onClick={() => setActiveTab('repl')}
            icon={<Terminal className="w-3.5 h-3.5" />}
          >
            SQL REPL
          </TabButton>
          <TabButton 
            active={activeTab === 'contacts'} 
            onClick={() => setActiveTab('contacts')}
            icon={<Users className="w-3.5 h-3.5" />}
          >
            Demo App
          </TabButton>
        </div>
      </div>

      {/* Mobile/Tablet Side Panel Tabs */}
      <div className="lg:hidden flex-shrink-0 border-b border-border/30">
        <div className="flex gap-2 p-3 overflow-x-auto scrollbar-thin">
          <Sheet open={sampleSheetOpen} onOpenChange={setSampleSheetOpen}>
            <SheetTrigger asChild>
              <Button data-tour="samples-btn" variant="outline" size="sm" className="font-mono text-xs gap-1.5 glass-button flex-shrink-0 whitespace-nowrap">
                <Code className="w-3.5 h-3.5" />
                Samples
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[70vh] glass-card">
              <SheetHeader>
                <SheetTitle className="font-mono text-primary">Sample Queries</SheetTitle>
                <SheetDescription>Select a query to run in the REPL</SheetDescription>
              </SheetHeader>
              <div className="mt-4 h-[calc(100%-4rem)]">
              <SampleQueries 
                  onSelectQuery={handleSelectQuery}
                  highlightQueryId={highlightedQueryId}
                  onHighlightComplete={handleHighlightComplete}
                  activeTable={activeTableId}
                />
              </div>
            </SheetContent>
          </Sheet>

          <Sheet open={historySheetOpen} onOpenChange={setHistorySheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="font-mono text-xs gap-1.5 glass-button flex-shrink-0 whitespace-nowrap">
                <History className="w-3.5 h-3.5" />
                History
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[70vh] glass-card">
              <SheetHeader>
                <SheetTitle className="font-mono text-primary">Query History</SheetTitle>
                <SheetDescription>Your recent SQL queries</SheetDescription>
              </SheetHeader>
              <div className="mt-4 h-[calc(100%-4rem)]">
                <QueryHistory onSelectQuery={handleSelectQuery} />
              </div>
            </SheetContent>
          </Sheet>

          <Sheet open={rankSheetOpen} onOpenChange={setRankSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="font-mono text-xs gap-1.5 glass-button flex-shrink-0 whitespace-nowrap">
                <Trophy className="w-3.5 h-3.5" />
                Rank
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[70vh] glass-card">
              <SheetHeader>
                <SheetTitle className="font-mono text-primary">Global Leaderboard</SheetTitle>
                <SheetDescription>Compete with other developers</SheetDescription>
              </SheetHeader>
              <div className="mt-4 h-[calc(100%-4rem)]">
                <Leaderboard />
              </div>
            </SheetContent>
          </Sheet>

          <Sheet open={profileSheetOpen} onOpenChange={setProfileSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="font-mono text-xs gap-1.5 glass-button flex-shrink-0 whitespace-nowrap">
                <User className="w-3.5 h-3.5" />
                Profile
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[70vh] glass-card">
              <SheetHeader>
                <SheetTitle className="font-mono text-primary">Your Profile</SheetTitle>
                <SheetDescription>Manage your account</SheetDescription>
              </SheetHeader>
              <div className="mt-4 h-[calc(100%-4rem)] overflow-hidden">
                <ProfilePanel />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 min-h-0 overflow-hidden">
        <div className="container mx-auto px-4 py-4 h-full">
          <div className="flex gap-6 h-full">
            {/* Main Panel */}
            <div className="flex-1 min-w-0 h-full overflow-auto">
              <FadeContent blur duration={500}>
                {activeTab === 'repl' ? (
                  <REPL 
                    initialQuery={selectedQuery} 
                    onQueryChange={setSelectedQuery}
                    onQueryError={handleQueryError}
                  />
                ) : (
                  <DemoAppManager onTableChange={setActiveTableId} />
                )}
              </FadeContent>
            </div>

            {/* Side Panel - Desktop */}
            <div className="hidden lg:flex lg:flex-col w-80 xl:w-96 flex-shrink-0 gap-4 h-full">
              <div className="flex gap-1 flex-shrink-0 pb-2 min-w-0">
                <TabButton 
                  active={sidePanel === 'samples'} 
                  onClick={() => setSidePanel('samples')}
                  icon={<Code className="w-3 h-3" />}
                >
                  Samples
                </TabButton>
                <TabButton 
                  active={sidePanel === 'history'} 
                  onClick={() => setSidePanel('history')}
                  icon={<History className="w-3 h-3" />}
                >
                  History
                </TabButton>
                <TabButton 
                  active={sidePanel === 'leaderboard'} 
                  onClick={() => setSidePanel('leaderboard')}
                  icon={<Trophy className="w-3 h-3" />}
                >
                  Rank
                </TabButton>
                <TabButton 
                  active={sidePanel === 'profile'} 
                  onClick={() => setSidePanel('profile')}
                  icon={<User className="w-3 h-3" />}
                >
                  Profile
                </TabButton>
              </div>
              
              <div className="flex-1 min-h-0 overflow-auto">
                {sidePanel === 'samples' && (
                  <SampleQueries 
                    onSelectQuery={handleSelectQuery}
                    highlightQueryId={highlightedQueryId}
                    onHighlightComplete={handleHighlightComplete}
                    activeTable={activeTableId}
                  />
                )}
                {sidePanel === 'history' && <QueryHistory onSelectQuery={handleSelectQuery} />}
                {sidePanel === 'leaderboard' && <Leaderboard />}
                {sidePanel === 'profile' && <ProfilePanel />}
              </div>
            </div>
          </div>
        </div>
      </main>

        {/* Footer */}
        <AppFooter />
      </div>
      
      {/* Interactive Tour Overlay */}
      {tour.isActive && tour.currentStep && (
        <>
          <TourSpotlight targetSelector={tour.currentStep.target} />
          <TourTooltip
            targetSelector={tour.currentStep.target}
            title={tour.currentStep.title}
            content={tour.currentStep.content}
            position={tour.currentStep.position}
            currentStep={tour.currentStepIndex}
            totalSteps={tour.totalSteps}
            onNext={tour.next}
            onPrev={tour.prev}
            onSkip={tour.skip}
            isFirstStep={tour.isFirstStep}
            isLastStep={tour.isLastStep}
          />
        </>
      )}
    </>
  );
};

export default Index;
