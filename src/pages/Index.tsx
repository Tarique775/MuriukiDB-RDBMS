import { useState, useEffect } from 'react';
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
import { Terminal, Users, Github, History, Code, Trophy, Award, User, Keyboard } from 'lucide-react';
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

type Tab = 'repl' | 'contacts';
type SidePanel = 'history' | 'samples' | 'leaderboard' | 'profile';

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
  const { userInfo } = useUserFingerprint();
  const { user } = useAuth();
  const { migrateAnonymousStats } = useGameStats();
  const { isOpen: shortcutsOpen, setIsOpen: setShortcutsOpen } = useKeyboardShortcuts();

  // Global auth sync: claim session data + migrate stats when user logs in
  useEffect(() => {
    if (user) {
      // Run migration which handles claiming tables and merging stats
      migrateAnonymousStats();
    }
  }, [user, migrateAnonymousStats]);

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
      <WelcomeTutorial onComplete={() => setShowTutorial(false)} />
      <KeyboardShortcutsModal open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
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
              >
                Demo App
              </TabButton>
            </nav>

            <div className="flex items-center gap-1 sm:gap-2">
              <GameStats />
              <Link to="/achievements">
                <button className="p-1.5 sm:p-2 rounded-lg hover:bg-primary/20 transition-colors" title="Achievements">
                  <Award className="w-4 sm:w-5 h-4 sm:h-5 text-yellow-400" />
                </button>
              </Link>
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
        <div className="flex gap-2 p-3 overflow-x-auto scrollbar-thin scrollbar-thumb-primary/30 scrollbar-track-transparent">
          <Sheet open={sampleSheetOpen} onOpenChange={setSampleSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="font-mono text-xs gap-1.5 glass-button flex-shrink-0 whitespace-nowrap">
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
              <div className="mt-4 h-[calc(100%-4rem)] overflow-auto scrollbar-thin">
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
              <div className="flex gap-1 flex-shrink-0 overflow-x-auto scrollbar-thin scrollbar-thumb-primary/30 scrollbar-track-transparent pb-2 min-w-0">
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
    </>
  );
};

export default Index;
