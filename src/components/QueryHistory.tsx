import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { History, CheckCircle, XCircle, RefreshCw, Clock, Search, X, Loader2, User, Globe, Filter } from 'lucide-react';
import { highlightSQL } from '@/lib/rdbms';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface QueryHistoryItem {
  id: string;
  query: string;
  success: boolean;
  execution_time_ms: number | null;
  created_at: string;
  user_id: string | null;
  session_id: string | null;
}

interface QueryHistoryProps {
  onSelectQuery?: (query: string) => void;
}

type FilterMode = 'own' | 'global' | 'all';

export const QueryHistory = ({ onSelectQuery }: QueryHistoryProps) => {
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [hoveredQuery, setHoveredQuery] = useState<QueryHistoryItem | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>('own');
  const { user } = useAuth();

  const fetchHistory = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('rdbms_query_history')
        .select('id, query, success, execution_time_ms, created_at, user_id, session_id')
        .order('created_at', { ascending: false })
        .limit(200);

      const { data, error } = await query;
      
      if (!error && data) {
        setHistory(data);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Get session ID from sessionStorage for matching own queries
  const getSessionId = () => {
    try {
      // Use the same session ID as the executor
      return sessionStorage.getItem('muriukidb-session-id');
    } catch {
      return null;
    }
  };

  // Filter history based on filter mode and search term
  const filteredHistory = useMemo(() => {
    let filtered = history;
    const sessionId = getSessionId();
    const userId = user?.id;

    // Apply filter mode
    if (filterMode === 'own') {
      // Show only user's own queries (by user_id if logged in, or by session_id)
      filtered = history.filter(item => {
        if (userId && item.user_id === userId) return true;
        if (!userId && sessionId && item.session_id === sessionId) return true;
        return false;
      });
    } else if (filterMode === 'global') {
      // Show unique queries from all users (deduplicated by query text)
      const seen = new Set<string>();
      filtered = history.filter(item => {
        const normalizedQuery = item.query.trim().toLowerCase();
        if (seen.has(normalizedQuery)) return false;
        seen.add(normalizedQuery);
        return true;
      });
    }
    // 'all' mode shows everything

    // Apply search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.query.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [history, searchTerm, filterMode, user]);

  const clearSearch = () => setSearchTerm('');

  const getFilterLabel = () => {
    switch (filterMode) {
      case 'own': return 'My Queries';
      case 'global': return 'Global (Unique)';
      case 'all': return 'All Queries';
    }
  };

  const getFilterIcon = () => {
    switch (filterMode) {
      case 'own': return <User className="w-3 h-3" />;
      case 'global': return <Globe className="w-3 h-3" />;
      case 'all': return <Filter className="w-3 h-3" />;
    }
  };

  return (
    <Card className="glass-card border-primary/30 h-full flex flex-col relative overflow-hidden">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-mono flex items-center gap-2">
            <History className="w-4 h-4" />
            Query History
          </CardTitle>
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs font-mono gap-1">
                  {getFilterIcon()}
                  {getFilterLabel()}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass-card">
                <DropdownMenuItem 
                  onClick={() => setFilterMode('own')}
                  className={filterMode === 'own' ? 'bg-primary/20' : ''}
                >
                  <User className="w-3 h-3 mr-2" />
                  My Queries
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setFilterMode('global')}
                  className={filterMode === 'global' ? 'bg-primary/20' : ''}
                >
                  <Globe className="w-3 h-3 mr-2" />
                  Global (Unique)
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setFilterMode('all')}
                  className={filterMode === 'all' ? 'bg-primary/20' : ''}
                >
                  <Filter className="w-3 h-3 mr-2" />
                  All Queries
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon" onClick={fetchHistory} className="h-7 w-7">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        {/* Search input */}
        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search queries..."
            className="pl-8 pr-8 h-8 text-xs font-mono glass-input"
          />
          {searchTerm && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={clearSearch}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full max-h-[calc(100%-1rem)]">
          <div className="px-4 pb-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="font-mono text-sm">Loading history...</span>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground font-mono text-sm">
                {searchTerm ? 'No matching queries found' : (
                  filterMode === 'own' 
                    ? 'No queries yet. Start exploring!' 
                    : 'No queries in history'
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredHistory.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onSelectQuery?.(item.query)}
                    onMouseEnter={() => setHoveredQuery(item)}
                    onMouseLeave={() => setHoveredQuery(null)}
                    className="w-full text-left p-3 rounded-lg bg-secondary/30 hover:bg-secondary/60 transition-all duration-200 border border-transparent hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 group relative"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5">
                        {item.success ? (
                          <CheckCircle className="w-3.5 h-3.5 text-[hsl(var(--terminal-green))]" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-destructive" />
                        )}
                        <Badge variant={item.success ? 'default' : 'destructive'} className="text-[10px] px-1.5 py-0">
                          {item.success ? 'OK' : 'ERR'}
                        </Badge>
                        {filterMode !== 'own' && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {item.user_id ? <User className="w-2.5 h-2.5" /> : <Globe className="w-2.5 h-2.5" />}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        {item.execution_time_ms && (
                          <span className="flex items-center gap-0.5">
                            <Clock className="w-3 h-3" />
                            {item.execution_time_ms}ms
                          </span>
                        )}
                        <span>{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</span>
                      </div>
                    </div>
                    <pre 
                      className="text-xs font-mono overflow-hidden text-ellipsis whitespace-nowrap group-hover:text-primary transition-colors"
                      dangerouslySetInnerHTML={{ __html: highlightSQL(item.query.slice(0, 100) + (item.query.length > 100 ? '...' : '')) }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>

      {/* Hover tooltip for full query */}
      {hoveredQuery && hoveredQuery.query.length > 100 && (
        <div 
          className="absolute left-0 right-0 bottom-full mb-2 mx-4 p-4 rounded-xl glass-card border border-primary/40 backdrop-blur-xl shadow-2xl shadow-primary/20 z-50 animate-in fade-in-0 zoom-in-95 duration-200"
          style={{ 
            background: 'linear-gradient(135deg, hsl(var(--card) / 0.95), hsl(var(--background) / 0.9))',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            {hoveredQuery.success ? (
              <CheckCircle className="w-4 h-4 text-[hsl(var(--terminal-green))]" />
            ) : (
              <XCircle className="w-4 h-4 text-destructive" />
            )}
            <span className="text-xs font-mono text-muted-foreground">Full Query</span>
          </div>
          <pre 
            className="text-xs font-mono whitespace-pre-wrap break-words text-foreground max-h-40 overflow-auto"
            dangerouslySetInnerHTML={{ __html: highlightSQL(hoveredQuery.query) }}
          />
        </div>
      )}
    </Card>
  );
};
