import { useState, useRef, useEffect, useCallback } from 'react';
import { QueryExecutor, highlightSQL, QueryResult } from '@/lib/rdbms';
import { useGameStats } from '@/hooks/useGameStats';
import { toast } from 'sonner';

interface HistoryEntry {
  query: string;
  result: QueryResult;
  timestamp: Date;
}

interface REPLProps {
  initialQuery?: string;
  onQueryChange?: (query: string) => void;
}

export function REPL({ initialQuery, onQueryChange }: REPLProps) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isExecuting, setIsExecuting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const executor = useRef(new QueryExecutor());
  const { addXP, incrementQueries, incrementTablesCreated, incrementRowsInserted } = useGameStats();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [history]);

  useEffect(() => {
    if (initialQuery && initialQuery !== input) {
      setInput(initialQuery);
      inputRef.current?.focus();
    }
  }, [initialQuery]);

  const executeQuery = useCallback(async () => {
    const query = input.trim();
    if (!query || isExecuting) return;

    setIsExecuting(true);
    setCommandHistory(prev => [query, ...prev.slice(0, 99)]);
    setHistoryIndex(-1);

    try {
      const result = await executor.current.execute(query);
      setHistory(prev => [...prev, { query, result, timestamp: new Date() }]);
      
      // Gamification
      incrementQueries(result.success);
      
      if (result.success) {
        const upperQuery = query.toUpperCase();
        
        if (upperQuery.startsWith('CREATE TABLE')) {
          incrementTablesCreated();
          addXP(50, 'create_table');
          toast.success('+50 XP - Table created!', { duration: 2000 });
        } else if (upperQuery.startsWith('INSERT')) {
          const rowCount = result.rowCount || 1;
          incrementRowsInserted(rowCount);
          addXP(10 * rowCount, 'insert');
          toast.success(`+${10 * rowCount} XP - Data inserted!`, { duration: 2000 });
        } else if (upperQuery.startsWith('SELECT')) {
          addXP(5, 'select');
        } else if (upperQuery.startsWith('UPDATE') || upperQuery.startsWith('DELETE')) {
          addXP(15, 'modify');
        } else {
          addXP(5, 'query');
        }
      }
    } catch (error) {
      setHistory(prev => [...prev, {
        query,
        result: { success: false, message: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: new Date(),
      }]);
      incrementQueries(false);
    }

    setInput('');
    onQueryChange?.('');
    setIsExecuting(false);
  }, [input, isExecuting, addXP, incrementQueries, incrementTablesCreated, incrementRowsInserted, onQueryChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      executeQuery();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput('');
      }
    }
  };

  const renderResult = (result: QueryResult) => {
    if (!result.success) {
      return <span className="text-destructive">Error: {result.message || result.error}</span>;
    }

    if (result.rows && result.rows.length > 0 && result.columns) {
      return (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr>
                {result.columns.map((col, i) => (
                  <th key={i} className="border border-border px-3 py-1 text-left text-[hsl(var(--terminal-cyan))]">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, i) => (
                <tr key={i}>
                  {result.columns!.map((col, j) => (
                    <td key={j} className="border border-border px-3 py-1">
                      {row[col] === null ? <span className="text-muted-foreground">NULL</span> : String(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 text-muted-foreground text-xs">
            {result.rowCount} row(s) returned in {result.executionTime}ms
          </div>
        </div>
      );
    }

    return (
      <div className="text-[hsl(var(--terminal-bright-green))]">
        {result.message}
        {result.executionTime && <span className="text-muted-foreground ml-2">({result.executionTime}ms)</span>}
      </div>
    );
  };

  return (
    <div className="terminal-window h-full flex flex-col">
      <div className="terminal-header">
        <div className="terminal-dot terminal-dot-red" />
        <div className="terminal-dot terminal-dot-yellow" />
        <div className="terminal-dot terminal-dot-green" />
        <span className="ml-4 text-sm text-muted-foreground font-medium">RDBMS REPL — SQL Interface</span>
      </div>
      
      <div ref={outputRef} className="terminal-body flex-1 overflow-auto scanline">
        {/* Welcome message */}
        <div className="mb-4 text-muted-foreground">
          <pre className="text-[hsl(var(--terminal-green))] text-xs leading-tight">{`
╔═══════════════════════════════════════════════════════════╗
║  ██████╗ ██████╗ ██████╗ ███╗   ███╗███████╗              ║
║  ██╔══██╗██╔══██╗██╔══██╗████╗ ████║██╔════╝              ║
║  ██████╔╝██║  ██║██████╔╝██╔████╔██║███████╗              ║
║  ██╔══██╗██║  ██║██╔══██╗██║╚██╔╝██║╚════██║              ║
║  ██║  ██║██████╔╝██████╔╝██║ ╚═╝ ██║███████║              ║
║  ╚═╝  ╚═╝╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚══════╝              ║
╚═══════════════════════════════════════════════════════════╝`}</pre>
          <p className="mt-2">Welcome to the Relational Database Management System</p>
          <p className="text-xs">Type SQL commands and press Enter to execute. Use ↑/↓ to navigate history.</p>
          <p className="text-xs mt-1 text-[hsl(var(--terminal-yellow))]">💡 Earn XP and unlock badges by executing queries!</p>
        </div>

        {/* Query history */}
        {history.map((entry, i) => (
          <div key={i} className="mb-4 animate-fade-in">
            <div className="flex items-start gap-2">
              <span className="text-[hsl(var(--terminal-cyan))]">❯</span>
              <pre className="flex-1 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: highlightSQL(entry.query) }} />
            </div>
            <div className="ml-4 mt-1">{renderResult(entry.result)}</div>
          </div>
        ))}

        {/* Current input */}
        <div className="flex items-start gap-2">
          <span className="text-[hsl(var(--terminal-cyan))]">❯</span>
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                onQueryChange?.(e.target.value);
              }}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent border-none outline-none resize-none text-foreground font-mono"
              rows={Math.max(1, input.split('\n').length)}
              placeholder="Enter SQL command..."
              disabled={isExecuting}
              spellCheck={false}
            />
            {isExecuting && <span className="text-muted-foreground ml-2">Executing...</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
