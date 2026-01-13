import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Code, Play } from 'lucide-react';
import { highlightSQL } from '@/lib/rdbms';

const SAMPLE_QUERIES = [
  {
    category: '📊 Schema',
    queries: [
      { name: 'Show all tables', sql: 'SHOW TABLES' },
      { name: 'Create users table', sql: 'CREATE TABLE users (name TEXT NOT NULL, email TEXT UNIQUE, age INTEGER)' },
      { name: 'Describe table', sql: 'DESCRIBE contacts' },
    ],
  },
  {
    category: '📝 Data',
    queries: [
      { name: 'Insert a user', sql: "INSERT INTO users (name, email, age) VALUES ('John Doe', 'john@example.com', 25)" },
      { name: 'Select all', sql: 'SELECT * FROM users' },
      { name: 'Select with filter', sql: "SELECT name, email FROM users WHERE age > 20" },
    ],
  },
  {
    category: '🔧 Advanced',
    queries: [
      { name: 'Update record', sql: "UPDATE users SET age = 26 WHERE name = 'John Doe'" },
      { name: 'Delete record', sql: "DELETE FROM users WHERE age < 18" },
      { name: 'Create index', sql: 'CREATE INDEX idx_users_email ON users (email)' },
    ],
  },
];

interface SampleQueriesProps {
  onSelectQuery: (query: string) => void;
}

export const SampleQueries = ({ onSelectQuery }: SampleQueriesProps) => {
  return (
    <Card className="border-primary/30 bg-card/50 backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-mono flex items-center gap-2">
          <Code className="w-4 h-4" />
          Sample Queries
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {SAMPLE_QUERIES.map((category) => (
          <div key={category.category}>
            <h4 className="text-xs font-mono text-muted-foreground mb-2">{category.category}</h4>
            <div className="space-y-1.5">
              {category.queries.map((query) => (
                <Button
                  key={query.name}
                  variant="ghost"
                  className="w-full justify-start h-auto py-2 px-3 text-left hover:bg-primary/10 group"
                  onClick={() => onSelectQuery(query.sql)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium mb-1">{query.name}</div>
                    <pre 
                      className="text-[10px] text-muted-foreground truncate"
                      dangerouslySetInnerHTML={{ __html: highlightSQL(query.sql.slice(0, 50) + (query.sql.length > 50 ? '...' : '')) }}
                    />
                  </div>
                  <Play className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary ml-2 flex-shrink-0" />
                </Button>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
