import { useState } from 'react';
import { REPL } from '@/components/REPL';
import { ContactManager } from '@/components/ContactManager';
import { QueryHistory } from '@/components/QueryHistory';
import { SampleQueries } from '@/components/SampleQueries';
import { GameStats } from '@/components/GameStats';
import { ThemeToggle } from '@/components/ThemeToggle';
import { TabButton } from '@/components/TabButton';
import { Terminal, Users, Github, History, Code, Heart } from 'lucide-react';

type Tab = 'repl' | 'contacts';
type SidePanel = 'history' | 'samples' | null;

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>('repl');
  const [sidePanel, setSidePanel] = useState<SidePanel>('samples');
  const [selectedQuery, setSelectedQuery] = useState('');

  const handleSelectQuery = (query: string) => {
    setSelectedQuery(query);
    setActiveTab('repl');
  };

  return (
    <div className="min-h-screen bg-background text-foreground matrix-bg">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-primary/20 border border-primary/50 flex items-center justify-center glow-border">
                <Terminal className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h1 className="font-mono font-bold text-sm text-foreground glow-text">MuriukiDB</h1>
                <p className="font-mono text-[10px] text-muted-foreground">Custom RDBMS Engine</p>
              </div>
            </div>
            
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
      <div className="sm:hidden border-b border-border/50 bg-card/30">
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
            {activeTab === 'repl' ? (
              <REPL initialQuery={selectedQuery} onQueryChange={setSelectedQuery} />
            ) : (
              <ContactManager />
            )}
          </div>

          {/* Side Panel */}
          <div className="hidden lg:block w-80 flex-shrink-0 space-y-4">
            <div className="flex gap-2 mb-4">
              <TabButton 
                active={sidePanel === 'samples'} 
                onClick={() => setSidePanel(sidePanel === 'samples' ? null : 'samples')}
                icon={<Code className="w-3 h-3" />}
              >
                Samples
              </TabButton>
              <TabButton 
                active={sidePanel === 'history'} 
                onClick={() => setSidePanel(sidePanel === 'history' ? null : 'history')}
                icon={<History className="w-3 h-3" />}
              >
                History
              </TabButton>
            </div>
            
            {sidePanel === 'samples' && <SampleQueries onSelectQuery={handleSelectQuery} />}
            {sidePanel === 'history' && <QueryHistory onSelectQuery={handleSelectQuery} />}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 py-4 mt-auto">
        <div className="container mx-auto px-4">
          <p className="text-center text-xs font-mono text-muted-foreground flex items-center justify-center gap-1">
            Pesapal Junior Dev Challenge '26 • Built by Samuel-Muriuki in collaboration with 
            <Heart className="w-3 h-3 text-destructive inline" />
            <a href="https://lovable.dev" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Lovable</a>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
