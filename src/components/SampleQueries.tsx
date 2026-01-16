import { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Code, Play, Search, X, AlertTriangle, Sparkles } from 'lucide-react';
import { highlightSQL } from '@/lib/rdbms';
import { cn } from '@/lib/utils';

// Sample query with dependency metadata
interface SampleQuery {
  id: string;
  name: string;
  sql: string;
  provides?: string[];  // e.g., ['table:users', 'table:products']
  requires?: string[];  // e.g., ['table:orders']
}

interface SampleCategory {
  category: string;
  queries: SampleQuery[];
}

const SAMPLE_QUERIES: SampleCategory[] = [
  {
    category: '📦 Schema Setup',
    queries: [
      {
        id: 'create_users',
        name: 'Create users table',
        sql: `CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  age INTEGER DEFAULT 0,
  city TEXT,
  created_at DATE DEFAULT '2025-01-01'
)`,
        provides: ['table:users'],
      },
      {
        id: 'create_products',
        name: 'Create products table',
        sql: `CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  name TEXT NOT NULL,
  category TEXT,
  price REAL NOT NULL,
  stock INTEGER DEFAULT 0
)`,
        provides: ['table:products'],
      },
      {
        id: 'create_orders',
        name: 'Create orders table',
        sql: `CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  user_id INTEGER NOT NULL,
  product_id INTEGER,
  amount REAL NOT NULL,
  quantity INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending',
  order_date DATE DEFAULT '2025-01-15'
)`,
        provides: ['table:orders'],
      },
      {
        id: 'create_employees',
        name: 'Create employees table',
        sql: `CREATE TABLE employees (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  name TEXT NOT NULL,
  department TEXT,
  salary REAL,
  hire_date DATE
)`,
        provides: ['table:employees'],
      },
    ],
  },
  {
    category: '📥 Insert Data',
    queries: [
      {
        id: 'insert_users',
        name: 'Insert sample users',
        sql: `INSERT INTO users (name, email, age, city) VALUES
  ('Alice Johnson', 'alice@example.com', 28, 'Nairobi'),
  ('Bob Smith', 'bob@example.com', 35, 'Mombasa'),
  ('Charlie Brown', 'charlie@example.com', 22, 'Kisumu'),
  ('Diana Ross', 'diana@example.com', 31, 'Nakuru'),
  ('Eve Wilson', 'eve@example.com', 27, 'Nairobi')`,
        requires: ['table:users'],
        provides: ['data:users'],
      },
      {
        id: 'insert_products',
        name: 'Insert sample products',
        sql: `INSERT INTO products (name, category, price, stock) VALUES
  ('Laptop Pro', 'Electronics', 89999.99, 15),
  ('Wireless Mouse', 'Electronics', 2499.50, 50),
  ('Office Chair', 'Furniture', 15000.00, 25),
  ('Notebook Pack', 'Stationery', 350.00, 200),
  ('USB Cable', 'Electronics', 499.00, 100),
  ('Standing Desk', 'Furniture', 45000.00, 10)`,
        requires: ['table:products'],
        provides: ['data:products'],
      },
      {
        id: 'insert_orders',
        name: 'Insert sample orders',
        sql: `INSERT INTO orders (user_id, product_id, amount, quantity, status) VALUES
  (1, 1, 89999.99, 1, 'completed'),
  (1, 2, 4999.00, 2, 'completed'),
  (2, 3, 15000.00, 1, 'pending'),
  (3, 4, 1050.00, 3, 'completed'),
  (4, 1, 89999.99, 1, 'shipped'),
  (5, 5, 998.00, 2, 'completed'),
  (2, 6, 45000.00, 1, 'pending')`,
        requires: ['table:orders'],
        provides: ['data:orders'],
      },
      {
        id: 'insert_employees',
        name: 'Insert sample employees',
        sql: `INSERT INTO employees (name, department, salary, hire_date) VALUES
  ('John Doe', 'Engineering', 120000.00, '2022-03-15'),
  ('Jane Smith', 'Marketing', 85000.00, '2021-07-01'),
  ('Mike Johnson', 'Engineering', 110000.00, '2023-01-10'),
  ('Sarah Williams', 'Sales', 75000.00, '2020-11-20'),
  ('Tom Brown', 'Engineering', 95000.00, '2022-08-05')`,
        requires: ['table:employees'],
        provides: ['data:employees'],
      },
    ],
  },
  {
    category: '🔍 Basic Queries',
    queries: [
      {
        id: 'select_all_users',
        name: 'Select all users',
        sql: 'SELECT * FROM users',
        requires: ['table:users'],
      },
      {
        id: 'select_all_products',
        name: 'Select all products',
        sql: 'SELECT * FROM products',
        requires: ['table:products'],
      },
      {
        id: 'select_all_orders',
        name: 'Select all orders',
        sql: 'SELECT * FROM orders',
        requires: ['table:orders'],
      },
      {
        id: 'select_users_nairobi',
        name: 'Filter users by city',
        sql: `SELECT name, email, age FROM users WHERE city = 'Nairobi'`,
        requires: ['table:users', 'data:users'],
      },
      {
        id: 'select_expensive_products',
        name: 'Products over 10,000 KES',
        sql: 'SELECT name, price FROM products WHERE price > 10000',
        requires: ['table:products', 'data:products'],
      },
      {
        id: 'select_completed_orders',
        name: 'Completed orders',
        sql: `SELECT * FROM orders WHERE status = 'completed'`,
        requires: ['table:orders', 'data:orders'],
      },
    ],
  },
  {
    category: '📊 Aggregates & Grouping',
    queries: [
      {
        id: 'count_users',
        name: 'Count all users',
        sql: 'SELECT COUNT(*) AS total_users FROM users',
        requires: ['table:users'],
      },
      {
        id: 'sum_order_amounts',
        name: 'Total order value',
        sql: 'SELECT SUM(amount) AS total_revenue FROM orders',
        requires: ['table:orders', 'data:orders'],
      },
      {
        id: 'avg_product_price',
        name: 'Average product price',
        sql: 'SELECT AVG(price) AS avg_price FROM products',
        requires: ['table:products', 'data:products'],
      },
      {
        id: 'min_max_age',
        name: 'Min and max user age',
        sql: 'SELECT MIN(age) AS youngest, MAX(age) AS oldest FROM users',
        requires: ['table:users', 'data:users'],
      },
      {
        id: 'orders_by_status',
        name: 'Orders grouped by status',
        sql: `SELECT status, COUNT(*) AS count, SUM(amount) AS total
FROM orders
GROUP BY status`,
        requires: ['table:orders', 'data:orders'],
      },
      {
        id: 'products_by_category',
        name: 'Products by category',
        sql: `SELECT category, COUNT(*) AS count, AVG(price) AS avg_price
FROM products
GROUP BY category`,
        requires: ['table:products', 'data:products'],
      },
      {
        id: 'employees_by_dept',
        name: 'Salary stats by department',
        sql: `SELECT department, 
       COUNT(*) AS headcount,
       AVG(salary) AS avg_salary,
       MIN(salary) AS min_salary,
       MAX(salary) AS max_salary
FROM employees
GROUP BY department`,
        requires: ['table:employees', 'data:employees'],
      },
      {
        id: 'having_example',
        name: 'Categories with expensive products',
        sql: `SELECT category, AVG(price) AS avg_price
FROM products
GROUP BY category
HAVING AVG(price) > 5000`,
        requires: ['table:products', 'data:products'],
      },
    ],
  },
  {
    category: '🔗 Joins',
    queries: [
      {
        id: 'join_orders_users',
        name: 'Orders with user names',
        sql: `SELECT o.id, u.name AS customer, o.amount, o.status
FROM orders o
JOIN users u ON o.user_id = u.id`,
        requires: ['table:orders', 'table:users', 'data:orders', 'data:users'],
      },
      {
        id: 'left_join_example',
        name: 'All users with their orders',
        sql: `SELECT u.name, o.id AS order_id, o.amount
FROM users u
LEFT JOIN orders o ON u.id = o.user_id`,
        requires: ['table:users', 'table:orders', 'data:users'],
      },
    ],
  },
  {
    category: '📝 Update & Delete',
    queries: [
      {
        id: 'update_user_age',
        name: 'Update user age',
        sql: `UPDATE users SET age = 29 WHERE name = 'Alice Johnson'`,
        requires: ['table:users', 'data:users'],
      },
      {
        id: 'update_product_stock',
        name: 'Increase product stock',
        sql: `UPDATE products SET stock = stock + 10 WHERE category = 'Electronics'`,
        requires: ['table:products', 'data:products'],
      },
      {
        id: 'update_order_status',
        name: 'Mark orders as shipped',
        sql: `UPDATE orders SET status = 'shipped' WHERE status = 'pending'`,
        requires: ['table:orders', 'data:orders'],
      },
      {
        id: 'delete_low_stock',
        name: 'Delete out-of-stock products',
        sql: 'DELETE FROM products WHERE stock = 0',
        requires: ['table:products'],
      },
    ],
  },
  {
    category: '⚡ Advanced',
    queries: [
      {
        id: 'distinct_cities',
        name: 'Distinct cities',
        sql: 'SELECT DISTINCT city FROM users',
        requires: ['table:users', 'data:users'],
      },
      {
        id: 'order_by_price',
        name: 'Products sorted by price',
        sql: 'SELECT name, price FROM products ORDER BY price DESC',
        requires: ['table:products', 'data:products'],
      },
      {
        id: 'limit_offset',
        name: 'Paginated results',
        sql: 'SELECT * FROM users ORDER BY id LIMIT 3 OFFSET 1',
        requires: ['table:users', 'data:users'],
      },
      {
        id: 'like_search',
        name: 'Search with LIKE',
        sql: `SELECT * FROM products WHERE name LIKE '%Pro%'`,
        requires: ['table:products', 'data:products'],
      },
      {
        id: 'complex_query',
        name: 'Complex multi-table query',
        sql: `SELECT u.name, COUNT(o.id) AS order_count, SUM(o.amount) AS total_spent
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
GROUP BY u.id, u.name
ORDER BY total_spent DESC
LIMIT 5`,
        requires: ['table:users', 'table:orders', 'data:users', 'data:orders'],
      },
    ],
  },
  {
    category: '🗃️ Utility',
    queries: [
      {
        id: 'show_tables',
        name: 'Show all tables',
        sql: 'SHOW TABLES',
      },
      {
        id: 'describe_users',
        name: 'Describe users table',
        sql: 'DESCRIBE users',
        requires: ['table:users'],
      },
      {
        id: 'describe_products',
        name: 'Describe products table',
        sql: 'DESCRIBE products',
        requires: ['table:products'],
      },
      {
        id: 'drop_orders',
        name: 'Drop orders table',
        sql: 'DROP TABLE IF EXISTS orders',
      },
    ],
  },
];

// Build a dependency resolution map
function buildDependencyMap(): Map<string, SampleQuery> {
  const map = new Map<string, SampleQuery>();
  for (const category of SAMPLE_QUERIES) {
    for (const query of category.queries) {
      if (query.provides) {
        for (const provided of query.provides) {
          if (!map.has(provided)) {
            map.set(provided, query);
          }
        }
      }
    }
  }
  return map;
}

const DEPENDENCY_MAP = buildDependencyMap();

// Given an error message and query, find which prerequisite query is needed
export function findPrerequisiteQuery(errorMessage: string, attemptedQuery: string): { hint: string; queryId?: string } | null {
  const lowerError = errorMessage.toLowerCase();
  const lowerQuery = attemptedQuery.toLowerCase();
  
  // Extract table name from error messages
  const tableNotFoundMatch = lowerError.match(/table ['"]?(\w+)['"]? (?:does not exist|not found)/i) 
    || lowerError.match(/no such table[:\s]+['"]?(\w+)['"]?/i)
    || lowerError.match(/unknown table[:\s]+['"]?(\w+)['"]?/i)
    || lowerError.match(/table "(\w+)" not found/i);
  
  if (tableNotFoundMatch) {
    const tableName = tableNotFoundMatch[1].toLowerCase();
    const tableKey = `table:${tableName}`;
    const prerequisite = DEPENDENCY_MAP.get(tableKey);
    
    if (prerequisite) {
      return {
        hint: `Table "${tableName}" doesn't exist. Create it first!`,
        queryId: prerequisite.id,
      };
    }
    
    return {
      hint: `Table "${tableName}" doesn't exist. Create it with CREATE TABLE ${tableName} (...);`,
    };
  }
  
  // Check for empty result that might need data
  if (lowerError.includes('no rows') || lowerError.includes('empty result')) {
    // Try to find the table being queried
    const fromMatch = lowerQuery.match(/from\s+(\w+)/i);
    if (fromMatch) {
      const tableName = fromMatch[1].toLowerCase();
      const dataKey = `data:${tableName}`;
      const prerequisite = DEPENDENCY_MAP.get(dataKey);
      
      if (prerequisite) {
        return {
          hint: `The ${tableName} table is empty. Insert some data first!`,
          queryId: prerequisite.id,
        };
      }
    }
  }
  
  return null;
}

// Quick templates generator based on active table
const getQuickTemplates = (tableId: string): { name: string; sql: string }[] => {
  const templates: Record<string, { name: string; sql: string }[]> = {
    contacts: [
      { name: 'View all', sql: 'SELECT * FROM contacts' },
      { name: 'Search name', sql: "SELECT * FROM contacts WHERE name LIKE '%John%'" },
      { name: 'Count', sql: 'SELECT COUNT(*) as total FROM contacts' },
    ],
    users: [
      { name: 'View all', sql: 'SELECT * FROM users' },
      { name: 'By city', sql: 'SELECT city, COUNT(*) as count FROM users GROUP BY city' },
      { name: 'Avg age', sql: 'SELECT AVG(age) as avg_age FROM users' },
    ],
    products: [
      { name: 'View all', sql: 'SELECT * FROM products' },
      { name: 'Low stock', sql: 'SELECT * FROM products WHERE stock < 10' },
      { name: 'By category', sql: 'SELECT category, COUNT(*) as count FROM products GROUP BY category' },
    ],
    orders: [
      { name: 'View all', sql: 'SELECT * FROM orders' },
      { name: 'By status', sql: 'SELECT status, COUNT(*) as count FROM orders GROUP BY status' },
      { name: 'Revenue', sql: 'SELECT SUM(amount * quantity) as revenue FROM orders' },
    ],
    employees: [
      { name: 'View all', sql: 'SELECT * FROM employees' },
      { name: 'By dept', sql: 'SELECT department, COUNT(*) as count FROM employees GROUP BY department' },
      { name: 'Salary stats', sql: 'SELECT AVG(salary) as avg, MIN(salary) as min, MAX(salary) as max FROM employees' },
    ],
  };
  return templates[tableId] || [];
};

interface SampleQueriesProps {
  onSelectQuery: (query: string) => void;
  highlightQueryId?: string | null;
  onHighlightComplete?: () => void;
  activeTable?: string;
}

export const SampleQueries = ({ onSelectQuery, highlightQueryId, onHighlightComplete, activeTable }: SampleQueriesProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [blinkingId, setBlinkingId] = useState<string | null>(null);
  const queryRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Handle highlighting and blinking
  useEffect(() => {
    if (highlightQueryId) {
      const ref = queryRefs.current.get(highlightQueryId);
      if (ref) {
        // Scroll into view
        ref.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Start blinking animation
        setBlinkingId(highlightQueryId);
        
        // Stop blinking after 3 blinks (1.5 seconds)
        const timeout = setTimeout(() => {
          setBlinkingId(null);
          onHighlightComplete?.();
        }, 1500);
        
        return () => clearTimeout(timeout);
      }
    }
  }, [highlightQueryId, onHighlightComplete]);

  const filteredQueries = useMemo(() => {
    if (!searchTerm.trim()) return SAMPLE_QUERIES;
    
    const term = searchTerm.toLowerCase();
    return SAMPLE_QUERIES.map(category => ({
      ...category,
      queries: category.queries.filter(
        q => q.name.toLowerCase().includes(term) || q.sql.toLowerCase().includes(term)
      ),
    })).filter(category => category.queries.length > 0);
  }, [searchTerm]);

  const clearSearch = () => setSearchTerm('');

  const setQueryRef = (id: string, ref: HTMLButtonElement | null) => {
    if (ref) {
      queryRefs.current.set(id, ref);
    } else {
      queryRefs.current.delete(id);
    }
  };

  return (
    <Card className="glass-card border-primary/30 h-full flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <CardTitle className="text-sm font-mono flex items-center gap-2">
          <Code className="w-4 h-4" />
          Sample Queries
        </CardTitle>
        {/* Search input */}
        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search samples..."
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
      <CardContent className="flex-1 min-h-0 overflow-hidden p-0">
        <ScrollArea className="h-full px-4 pb-4 scrollbar-thin">
          {/* Quick Templates Section */}
          {activeTable && getQuickTemplates(activeTable).length > 0 && !searchTerm && (
            <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <h4 className="text-xs font-mono text-primary mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                Quick: {activeTable}
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {getQuickTemplates(activeTable).map((template, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    className="text-[10px] font-mono h-6 px-2 hover:bg-primary/10"
                    onClick={() => onSelectQuery(template.sql)}
                  >
                    {template.name}
                  </Button>
                ))}
              </div>
            </div>
          )}
          
          {filteredQueries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground font-mono text-sm">
              No matching queries found
            </div>
          ) : (
            <div className="space-y-4">
              {filteredQueries.map((category) => (
                <div key={category.category}>
                  <h4 className="text-xs font-mono text-muted-foreground mb-2">{category.category}</h4>
                  <div className="space-y-1.5">
                    {category.queries.map((query) => (
                      <Button
                        key={query.id}
                        ref={(ref) => setQueryRef(query.id, ref)}
                        variant="ghost"
                        className={cn(
                          "w-full justify-start h-auto py-2 px-3 text-left hover:bg-primary/10 group transition-all duration-200",
                          blinkingId === query.id && "animate-query-blink"
                        )}
                        onClick={() => onSelectQuery(query.sql)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-xs font-medium group-hover:text-primary transition-colors">{query.name}</span>
                            {query.requires && query.requires.length > 0 && (
                              <AlertTriangle className="w-3 h-3 text-amber-500/70" />
                            )}
                          </div>
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
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

// Export sample queries for external use
export { SAMPLE_QUERIES };
