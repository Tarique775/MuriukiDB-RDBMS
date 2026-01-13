import { useState } from 'react';
import { Link } from 'react-router-dom';
import { REPL } from '@/components/REPL';
import { ContactManager } from '@/components/ContactManager';
import { QueryHistory } from '@/components/QueryHistory';
import { SampleQueries } from '@/components/SampleQueries';
import { GameStats } from '@/components/GameStats';
import { ThemeToggle } from '@/components/ThemeToggle';
import { TabButton } from '@/components/TabButton';
import { Leaderboard } from '@/components/Leaderboard';
import { FadeContent } from '@/components/animations/FadeContent';
import { DecryptedText } from '@/components/animations/DecryptedText';
import { Terminal, Users, Github, History, Code, Heart, Trophy, Award } from 'lucide-react';
import { useUserFingerprint } from '@/hooks/useUserFingerprint';

type Tab = 'repl' | 'contacts';
type SidePanel = 'history' | 'samples' | 'leaderboard';

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>('repl');
  const [sidePanel, setSidePanel] = useState<SidePanel>('samples');
  const [selectedQuery, setSelectedQuery] = useState('');
  const { userInfo } = useUserFingerprint();

  const handleSelectQuery = (query: string) => {
    setSelectedQuery(query);
    setActiveTab('repl');
  };

  return (
    <div className="min-h-screen bg-background text-foreground matrix-bg">
      {/* Header */}
      <header className="border-b border-border/50 glass-card sticky top-0 z-50">
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

            <div className="flex items-center gap-2">
              <GameStats />
              <Link to="/achievements">
                <button className="p-2 rounded-lg hover:bg-primary/20 transition-colors" title="Achievements">
                  <Award className="w-5 h-5 text-yellow-400" />
                </button>
              </Link>
              <ThemeToggle />
              <a 
                href="https://github.com/Samuel-Muriuki" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                <Github className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Tab Nav */}
      <div className="sm:hidden border-b border-border/50 glass-card">
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

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Main Panel */}
          <div className="flex-1 min-w-0">
            <FadeContent blur duration={500}>
              {activeTab === 'repl' ? (
                <REPL initialQuery={selectedQuery} onQueryChange={setSelectedQuery} />
              ) : (
                <ContactManager />
              )}
            </FadeContent>
          </div>

          {/* Side Panel */}
          <div className="hidden lg:flex lg:flex-col w-80 flex-shrink-0 gap-4">
            <div className="flex gap-2">
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
            </div>
            
            <div className="flex-1 min-h-[500px]">
              {sidePanel === 'samples' && <SampleQueries onSelectQuery={handleSelectQuery} />}
              {sidePanel === 'history' && <QueryHistory onSelectQuery={handleSelectQuery} />}
              {sidePanel === 'leaderboard' && <Leaderboard />}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 py-4 mt-auto glass-card">
        <div className="container mx-auto px-4">
          <p className="text-center text-xs font-mono text-muted-foreground flex items-center justify-center gap-1 flex-wrap">
            <span className="text-primary font-bold">Pesapal Junior Dev Challenge '26</span> 
            <span>•</span> 
            Built by Samuel-Muriuki in collaboration with 
            <Heart className="w-3 h-3 text-destructive inline animate-pulse" />
            <a href="https://lovable.dev/invite/A5KC0U8" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Lovable
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;