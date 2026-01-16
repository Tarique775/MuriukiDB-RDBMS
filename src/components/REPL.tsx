import { useState, useRef, useEffect, useCallback } from 'react';
import { QueryExecutor, highlightSQL, QueryResult } from '@/lib/rdbms';
import { splitSqlStatements } from '@/lib/rdbms/utils';
import { useGameStats } from '@/hooks/useGameStats';
import { useFeedbackOptional } from '@/contexts/FeedbackContext';
import { toast } from 'sonner';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';

interface HistoryEntry {
  query: string;
  result: QueryResult;
  timestamp: Date;
}

interface REPLProps {
  initialQuery?: string;
  onQueryChange?: (query: string) => void;
  onQueryError?: (errorMessage: string, attemptedQuery: string) => void;
}

// Tables that have special significance in the app
const PROTECTED_TABLES = ['contacts'];

// SQL keywords for autocomplete
const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET',
  'DELETE', 'CREATE', 'TABLE', 'DROP', 'ALTER', 'JOIN', 'LEFT', 'RIGHT',
  'INNER', 'OUTER', 'ON', 'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT', 'OFFSET',
  'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'AND', 'OR', 'NOT', 'NULL',
  'AS', 'LIKE', 'IN', 'BETWEEN', 'IS', 'ASC', 'DESC', 'PRIMARY', 'KEY',
  'INTEGER', 'TEXT', 'REAL', 'DATE', 'SHOW', 'TABLES', 'IF', 'EXISTS',
  'AUTO_INCREMENT', 'DEFAULT', 'UNIQUE', 'DESCRIBE'
];

export function REPL({ initialQuery, onQueryChange, onQueryError }: REPLProps) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isExecuting, setIsExecuting] = useState(false);
  const [pendingQuery, setPendingQuery] = useState<string | null>(null);
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [deleteWarningInfo, setDeleteWarningInfo] = useState({ title: '', description: '', warning: '' });
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const executor = useRef(new QueryExecutor());
  const { addXP, incrementQueries, incrementTablesCreated, incrementRowsInserted } = useGameStats();
  const feedback = useFeedbackOptional();

  // Get current word at cursor for autocomplete
  const getCurrentWord = useCallback((text: string, cursorPos: number) => {
    const beforeCursor = text.slice(0, cursorPos);
    const match = beforeCursor.match(/[\w]+$/);
    return { word: match ? match[0] : '', start: match ? cursorPos - match[0].length : cursorPos };
  }, []);

  // Generate suggestions based on current word
  const getAutocompleteSuggestions = useCallback((word: string): string[] => {
    if (!word || word.length < 2) return [];
    const upperWord = word.toUpperCase();
    return SQL_KEYWORDS.filter(kw => kw.startsWith(upperWord) && kw !== upperWord).slice(0, 6);
  }, []);

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

  // Keyboard shortcuts listener
  useEffect(() => {
    const handleKeyboardShortcuts = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Enter to execute
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        executeQuery();
        return;
      }
      
      // Ctrl/Cmd + L to clear history
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        setHistory([]);
        toast.success('History cleared');
        return;
      }
      
      // Ctrl/Cmd + K to focus input
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }
      
      // Escape to clear input
      if (e.key === 'Escape') {
        setInput('');
        onQueryChange?.('');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyboardShortcuts);
    return () => window.removeEventListener('keydown', handleKeyboardShortcuts);
  }, [input, isExecuting]);

  // Check if query is destructive and needs a warning
  const checkDestructiveQuery = useCallback((query: string): { needsWarning: boolean; title: string; description: string; warning: string } => {
    const upperQuery = query.toUpperCase().trim();
    
    // Check for DROP TABLE
    if (upperQuery.startsWith('DROP TABLE')) {
      const tableMatch = query.match(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(\w+)/i);
      const tableName = tableMatch?.[1]?.toLowerCase();
      
      if (tableName && PROTECTED_TABLES.includes(tableName)) {
        return {
          needsWarning: true,
          title: `Drop "${tableName}" table?`,
          description: `You are about to permanently delete the "${tableName}" table and all its data.`,
          warning: `This will delete all data in the Contact Manager Demo app!`,
        };
      }
      return {
        needsWarning: true,
        title: `Drop "${tableName || 'table'}"?`,
        description: `You are about to permanently delete the "${tableName || 'table'}" table and all its data.`,
        warning: 'This action cannot be undone!',
      };
    }
    
    // Check for DELETE without WHERE (delete all)
    if (upperQuery.startsWith('DELETE') && !upperQuery.includes('WHERE')) {
      const tableMatch = query.match(/DELETE\s+FROM\s+(\w+)/i);
      const tableName = tableMatch?.[1]?.toLowerCase();
      
      return {
        needsWarning: true,
        title: `Delete all rows from "${tableName || 'table'}"?`,
        description: `This will delete ALL rows from the "${tableName || 'table'}" table.`,
        warning: tableName && PROTECTED_TABLES.includes(tableName) 
          ? 'This will clear all Contact Manager Demo data!' 
          : 'This action cannot be undone!',
      };
    }
    
    return { needsWarning: false, title: '', description: '', warning: '' };
  }, []);

  const executeQueryInternal = useCallback(async (query: string) => {
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
        
        // Play success/XP sounds
        feedback?.sounds.playSuccess();
        
        if (upperQuery.startsWith('CREATE TABLE')) {
          incrementTablesCreated();
          addXP(50, 'create_table');
          toast.success('+50 XP - Table created!', { duration: 2000 });
          feedback?.sounds.playXP();
        } else if (upperQuery.startsWith('INSERT')) {
          const rowCount = result.rowCount || 1;
          incrementRowsInserted(rowCount);
          addXP(10 * rowCount, 'insert');
          toast.success(`+${10 * rowCount} XP - Data inserted!`, { duration: 2000 });
          feedback?.sounds.playXP();
        } else if (upperQuery.startsWith('SELECT')) {
          addXP(5, 'select');
        } else if (upperQuery.startsWith('UPDATE') || upperQuery.startsWith('DELETE') || upperQuery.startsWith('DROP')) {
          addXP(15, 'modify');
        } else {
          addXP(5, 'query');
        }
      } else {
        // Play error sound and notify parent for hint display
        feedback?.sounds.playError();
        const errorMsg = result.message || result.error || 'Query failed';
        onQueryError?.(errorMsg, query);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setHistory(prev => [...prev, {
        query,
        result: { success: false, message: errorMsg },
        timestamp: new Date(),
      }]);
      feedback?.sounds.playError();
      incrementQueries(false);
      onQueryError?.(errorMsg, query);
    }

    setInput('');
    onQueryChange?.('');
    setIsExecuting(false);
  }, [addXP, incrementQueries, incrementTablesCreated, incrementRowsInserted, onQueryChange, onQueryError]);

  const executeQuery = useCallback(async () => {
    const rawInput = input.trim();
    if (!rawInput || isExecuting) return;

    // Split into individual statements while respecting quotes
    const statements = splitSqlStatements(rawInput);
    
    if (statements.length === 0) return;

    // For single statements, use existing logic with destructive check
    if (statements.length === 1) {
      const query = statements[0];
      const destructiveCheck = checkDestructiveQuery(query);
      if (destructiveCheck.needsWarning) {
        setPendingQuery(query);
        setDeleteWarningInfo({
          title: destructiveCheck.title,
          description: destructiveCheck.description,
          warning: destructiveCheck.warning,
        });
        setShowDeleteWarning(true);
        return;
      }
      await executeQueryInternal(query);
      return;
    }

    // For multiple statements, execute sequentially
    // Skip destructive statements in batch mode with a warning
    for (const stmt of statements) {
      const destructiveCheck = checkDestructiveQuery(stmt);
      if (destructiveCheck.needsWarning) {
        toast.warning(`Skipped destructive query in batch: ${stmt.slice(0, 40)}...`, { duration: 4000 });
        continue;
      }
      await executeQueryInternal(stmt);
    }
  }, [input, isExecuting, checkDestructiveQuery, executeQueryInternal]);

  const handleConfirmDestructiveQuery = useCallback(async () => {
    if (pendingQuery) {
      await executeQueryInternal(pendingQuery);
      setPendingQuery(null);
    }
    setShowDeleteWarning(false);
  }, [pendingQuery, executeQueryInternal]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Tab autocomplete
    if (e.key === 'Tab') {
      e.preventDefault();
      const cursorPos = inputRef.current?.selectionStart || 0;
      const { word, start } = getCurrentWord(input, cursorPos);
      const newSuggestions = getAutocompleteSuggestions(word);
      
      if (newSuggestions.length === 1) {
        // Single match: autocomplete immediately
        const newInput = input.slice(0, start) + newSuggestions[0] + ' ' + input.slice(cursorPos);
        setInput(newInput);
        setShowSuggestions(false);
        onQueryChange?.(newInput);
      } else if (newSuggestions.length > 1) {
        if (showSuggestions && suggestionIndex >= 0) {
          // Cycle through suggestions
          const nextIndex = (suggestionIndex + 1) % newSuggestions.length;
          setSuggestionIndex(nextIndex);
        } else {
          // Show suggestions dropdown
          setSuggestions(newSuggestions);
          setSuggestionIndex(0);
          setShowSuggestions(true);
        }
      }
      return;
    }
    
    // Enter with suggestions visible: select current suggestion
    if (e.key === 'Enter' && showSuggestions && suggestionIndex >= 0) {
      e.preventDefault();
      const cursorPos = inputRef.current?.selectionStart || 0;
      const { start } = getCurrentWord(input, cursorPos);
      const newInput = input.slice(0, start) + suggestions[suggestionIndex] + ' ' + input.slice(cursorPos);
      setInput(newInput);
      setShowSuggestions(false);
      setSuggestionIndex(-1);
      onQueryChange?.(newInput);
      return;
    }
    
    // Escape: hide suggestions
    if (e.key === 'Escape') {
      if (showSuggestions) {
        e.preventDefault();
        setShowSuggestions(false);
        setSuggestionIndex(-1);
        return;
      }
      setInput('');
      onQueryChange?.('');
      return;
    }
    
    // Hide suggestions on other keys
    if (showSuggestions && !['ArrowUp', 'ArrowDown'].includes(e.key)) {
      setShowSuggestions(false);
      setSuggestionIndex(-1);
    }
    
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
        <div className="overflow-x-auto scrollbar-thin">
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
        <div className="mb-4 text-muted-foreground" data-tour="repl-banner">
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
          <div className="text-xs mt-2 text-muted-foreground/70 border-t border-border/30 pt-2" data-tour="repl-shortcuts">
            <span className="text-[hsl(var(--terminal-cyan))]">Shortcuts:</span>{' '}
            <kbd className="px-1.5 py-0.5 rounded bg-secondary text-[10px]">Ctrl+Enter</kbd> Execute •{' '}
            <kbd className="px-1.5 py-0.5 rounded bg-secondary text-[10px]">Ctrl+L</kbd> Clear •{' '}
            <kbd className="px-1.5 py-0.5 rounded bg-secondary text-[10px]">Ctrl+K</kbd> Focus •{' '}
            <kbd className="px-1.5 py-0.5 rounded bg-secondary text-[10px]">Esc</kbd> Clear input
          </div>
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
              data-tour="repl-input"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                onQueryChange?.(e.target.value);
                // Update suggestions as user types
                const cursorPos = e.target.selectionStart || 0;
                const { word } = getCurrentWord(e.target.value, cursorPos);
                const newSuggestions = getAutocompleteSuggestions(word);
                if (newSuggestions.length > 0 && word.length >= 2) {
                  setSuggestions(newSuggestions);
                } else {
                  setShowSuggestions(false);
                }
              }}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent border-none outline-none resize-none text-foreground font-mono"
              rows={Math.max(1, input.split('\n').length)}
              placeholder="Enter SQL command... (Tab to autocomplete)"
              disabled={isExecuting}
              spellCheck={false}
            />
            {/* Autocomplete dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 bottom-full mb-1 bg-secondary/95 backdrop-blur border border-border rounded-lg shadow-lg z-50 overflow-hidden min-w-[140px]">
                {suggestions.map((suggestion, idx) => (
                  <div
                    key={suggestion}
                    className={`px-3 py-1.5 text-xs font-mono cursor-pointer transition-colors ${
                      idx === suggestionIndex ? 'bg-primary/20 text-primary' : 'hover:bg-primary/10'
                    }`}
                    onClick={() => {
                      const cursorPos = inputRef.current?.selectionStart || 0;
                      const { start } = getCurrentWord(input, cursorPos);
                      const newInput = input.slice(0, start) + suggestion + ' ' + input.slice(cursorPos);
                      setInput(newInput);
                      setShowSuggestions(false);
                      inputRef.current?.focus();
                      onQueryChange?.(newInput);
                    }}
                  >
                    {suggestion}
                  </div>
                ))}
                <div className="px-3 py-1 text-[10px] text-muted-foreground border-t border-border/50 bg-secondary/50">
                  Tab to cycle • Enter to select
                </div>
              </div>
            )}
            {isExecuting && <span className="text-muted-foreground ml-2">Executing...</span>}
          </div>
        </div>
      </div>

      {/* Destructive Query Warning Dialog */}
      <DeleteConfirmDialog
        open={showDeleteWarning}
        onOpenChange={(open) => {
          setShowDeleteWarning(open);
          if (!open) setPendingQuery(null);
        }}
        title={deleteWarningInfo.title}
        description={deleteWarningInfo.description}
        warningMessage={deleteWarningInfo.warning}
        onConfirm={handleConfirmDestructiveQuery}
        confirmText="Execute Query"
        cancelText="Cancel"
      />
    </div>
  );
}