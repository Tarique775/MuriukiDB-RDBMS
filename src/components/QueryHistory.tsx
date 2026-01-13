import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { History, CheckCircle, XCircle, RefreshCw, Clock } from 'lucide-react';
import { highlightSQL } from '@/lib/rdbms';
import { formatDistanceToNow } from 'date-fns';

interface QueryHistoryItem {
  id: string;
  query: string;
  success: boolean;
  execution_time_ms: number | null;
  created_at: string;
}

interface QueryHistoryProps {
  onSelectQuery?: (query: string) => void;
}

export const QueryHistory = ({ onSelectQuery }: QueryHistoryProps) => {
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('rdbms_query_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
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

  return (
    <Card className="border-primary/30 bg-card/50 backdrop-blur h-full flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-mono flex items-center gap-2">
            <History className="w-4 h-4" />
            Query History
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={fetchHistory} className="h-7 w-7">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-[400px] px-4 pb-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground font-mono text-sm">
              Loading history...
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground font-mono text-sm">
              No queries yet. Start exploring!
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSelectQuery?.(item.query)}
                  className="w-full text-left p-3 rounded-lg bg-secondary/50 hover:bg-secondary/80 transition-colors border border-transparent hover:border-primary/30"
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
                    className="text-xs font-mono overflow-hidden text-ellipsis whitespace-nowrap"
                    dangerouslySetInnerHTML={{ __html: highlightSQL(item.query.slice(0, 100) + (item.query.length > 100 ? '...' : '')) }}
                  />
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
