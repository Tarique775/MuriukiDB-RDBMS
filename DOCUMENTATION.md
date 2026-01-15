# MuriukiDB - Custom RDBMS for Pesapal Junior Dev Challenge '26

## 📋 Overview

MuriukiDB is a custom Relational Database Management System (RDBMS) built as a submission for the **Pesapal Junior Dev Challenge '26**. It features a complete SQL parser, query execution engine with in-memory B-Tree indexing, and an interactive REPL interface, demonstrated through a Contact Manager web application.

**Live Demo**: [https://rdbms.lovable.app](https://rdbms.lovable.app)

---

## 🎯 Challenge Requirements Met

| Requirement | Implementation |
|-------------|----------------|
| Declare tables with column types | ✅ CREATE TABLE with INTEGER, TEXT, REAL, BOOLEAN, DATE types |
| CRUD operations | ✅ Full INSERT, SELECT, UPDATE, DELETE support |
| Basic indexing | ✅ In-memory B-Tree indexes with CREATE INDEX |
| Primary and unique keys | ✅ PRIMARY KEY, UNIQUE, NOT NULL, AUTO_INCREMENT |
| JOIN operations | ✅ INNER JOIN and LEFT JOIN with ON clause |
| Interactive REPL | ✅ Terminal-style interface with syntax highlighting |
| Demo application | ✅ Contact Manager with full CRUD, pagination, import/export |

---

## 🏗️ Architecture

### Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS with custom terminal theme
- **Backend**: Lovable Cloud (Supabase) for data persistence & authentication
- **State Management**: React Context + sessionStorage for session tracking

### SQL Engine Components

```
┌─────────────────────────────────────────────────────────┐
│                     SQL Query Input                      │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                       LEXER                              │
│  - Tokenizes SQL input                                   │
│  - XSS protection via HTML entity escaping               │
│  - Handles strings, numbers, keywords, identifiers       │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                       PARSER                             │
│  - Builds Abstract Syntax Tree (AST)                     │
│  - Supports: CREATE, INSERT, SELECT, UPDATE, DELETE      │
│  - Handles JOINs, WHERE, ORDER BY, GROUP BY, LIMIT       │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                      EXECUTOR                            │
│  - Executes queries against Supabase storage             │
│  - Rate limiting (client + server-side)                  │
│  - Resource limits (tables, rows, timeout)               │
│  - B-Tree index utilization                              │
│  - User/Session context for RLS compliance               │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   QUERY RESULT                           │
│  - Formatted output with execution time                  │
│  - Error messages with suggestions                       │
│  - Gamification rewards (XP, badges)                     │
└─────────────────────────────────────────────────────────┘
```

### Data Isolation & Multi-Tenancy

Each user operates in an isolated environment:
- **Anonymous users**: Session-based isolation using sessionStorage
- **Authenticated users**: User ID-based isolation with persistent storage
- **RLS policies**: Row-level security enforces strict data access control
- **Automatic cleanup**: Anonymous data purged after 7 days of inactivity

---

## 🔒 Security Features

### Implemented Security Measures

1. **XSS Protection**: SQL lexer escapes HTML entities in string values
2. **Rate Limiting**: Server-side enforcement via Edge Functions + client fallback
3. **Input Validation**: Stats validation before leaderboard sync with defined limits
4. **RLS Policies**: Row-level security on all tables (rdbms_tables, rdbms_rows, rdbms_query_history)
5. **SECURITY DEFINER Functions**: Protected with auth.uid() checks to prevent abuse
6. **Resource Limits**: Max 50 tables, 10k rows/table, 5s query timeout, 30 queries/min
7. **Destructive Operation Warnings**: Confirmation dialogs for DROP TABLE and DELETE operations
8. **Session Context**: All operations include user_id or session_id for RLS compliance

### Security Fixes Applied

| Issue | Fix |
|-------|-----|
| Client-side rate limit bypass | Added server-side rate limiting via Edge Function |
| SECURITY DEFINER abuse | Added auth.uid() verification in DB functions |
| Leaderboard stats tampering | Client-side validation + capped values on sync |
| localStorage data exposure | Server-side validation before persisting |
| Missing RLS context | Executor now includes user_id/session_id in all operations |

---

## 🎮 Gamification System

### SQL Command Ladder (23 Military-Style Ranks)

Progress from **Private (0 XP)** to **Commander in Chief (1,000,000 XP)**:

| Rank | XP Required | Icon |
|------|-------------|------|
| Private | 0 | 🔰 |
| Private First Class | 50 | 🎖️ |
| Corporal | 150 | ⭐ |
| Sergeant | 350 | ⭐⭐ |
| Staff Sergeant | 650 | 🌟 |
| Sergeant First Class | 1,200 | 🌟⭐ |
| Master Sergeant | 2,000 | 🎯 |
| First Sergeant | 3,500 | 🎯⭐ |
| Sergeant Major | 6,000 | 🏅 |
| ... | ... | ... |
| General | 540,000 | ⭐⭐⭐⭐ |
| Commander in Chief | 1,000,000 | 🎖️👑 |

### XP Rewards

| Action | XP |
|--------|-----|
| CREATE TABLE | +50 |
| INSERT (per row) | +10 |
| SELECT | +5 |
| UPDATE/DELETE | +15 |
| CREATE INDEX | +30 |

### Anti-Abuse Mechanics

- **Cooldown**: XP gains over 1,000/day reduced to 20% effectiveness
- **Validation**: Stats limits prevent impossibly high values
- **Rate Limiting**: 30 queries/minute max with exponential backoff
- **Streak Tracking**: Server-side streak computation prevents manipulation

---

## 💻 Supported SQL Commands

### DDL (Data Definition Language)

```sql
-- Create table with constraints
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  age INTEGER,
  created_at DATE
);

-- Create with IF NOT EXISTS
CREATE TABLE IF NOT EXISTS users (...);

-- Create index for faster lookups
CREATE INDEX idx_users_email ON users (email);

-- Create unique index
CREATE UNIQUE INDEX idx_users_email ON users (email);

-- Drop table
DROP TABLE IF EXISTS users;

-- Show all tables
SHOW TABLES;

-- Describe table structure
DESCRIBE users;
```

### DML (Data Manipulation Language)

```sql
-- Insert single row
INSERT INTO users (name, email, age) VALUES ('John', 'john@example.com', 25);

-- Insert multiple rows
INSERT INTO users (name, email) VALUES ('Alice', 'alice@mail.com'), ('Bob', 'bob@mail.com');

-- Select with filters
SELECT name, email FROM users WHERE age > 20 ORDER BY name LIMIT 10;

-- Select with LIKE pattern matching
SELECT * FROM users WHERE name LIKE 'J%';

-- Join tables (INNER JOIN)
SELECT users.name, orders.product 
FROM users 
INNER JOIN orders ON users.id = orders.user_id;

-- Left Join
SELECT users.name, orders.product 
FROM users 
LEFT JOIN orders ON users.id = orders.user_id;

-- Update records
UPDATE users SET age = 26 WHERE name = 'John';

-- Delete records (with confirmation dialog)
DELETE FROM users WHERE age < 18;
```

---

## 🚀 Running Locally

### Prerequisites

- Node.js 18+ or Bun
- Git

### Setup

```bash
# Clone the repository
git clone https://github.com/Samuel-Muriuki/MuriukiDB-RDBMS.git
cd MuriukiDB-RDBMS

# Install dependencies
npm install
# or
bun install

# Start development server
npm run dev
# or
bun dev
```

The app runs at `http://localhost:8080` by default.

### Environment Variables

The project uses Lovable Cloud, so no manual `.env` setup is required for the demo. For a custom Supabase backend, configure:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
```

---

## 📁 Project Structure

```
src/
├── components/
│   ├── REPL.tsx              # Interactive SQL terminal
│   ├── ContactManager.tsx     # Demo CRUD application
│   ├── Leaderboard.tsx        # Global rankings
│   ├── ProfilePanel.tsx       # User profile management
│   ├── QueryHistory.tsx       # Query history viewer
│   ├── TerminalAuth.tsx       # Terminal-based authentication
│   ├── DeleteConfirmDialog.tsx # Destructive operation confirmation
│   ├── SampleQueries.tsx      # Sample SQL queries loader
│   └── animations/            # UI animations
├── hooks/
│   ├── useAuth.tsx            # Authentication context
│   ├── useGameStats.tsx       # Gamification state (XP, ranks, badges)
│   └── useUserFingerprint.tsx # Session tracking (per-session visits)
├── lib/rdbms/
│   ├── lexer.ts               # SQL tokenizer with XSS protection
│   ├── parser.ts              # AST builder
│   ├── executor.ts            # Query execution with RLS context
│   ├── btree.ts               # B-Tree index implementation
│   └── types.ts               # TypeScript interfaces
├── pages/
│   ├── Index.tsx              # Main dashboard
│   └── Achievements.tsx       # Badges & ranks view
└── integrations/supabase/
    ├── client.ts              # Supabase client
    └── types.ts               # Auto-generated DB types

supabase/
├── functions/
│   ├── sql-execute/           # Rate limiting Edge Function
│   └── cleanup-inactive/      # Data cleanup Edge Function
└── migrations/                # Database schema migrations
```

---

## 🌟 Key Features

### Core RDBMS Features
1. **Complete SQL Parser**: Lexer → Parser → AST → Executor pipeline
2. **B-Tree Indexing**: In-memory indexes for optimized lookups
3. **Smart Error Messages**: Fuzzy matching suggests correct table/column names
4. **Resource Limits**: Prevents abuse with table/row/query limits

### User Experience
5. **Terminal-Style REPL**: Authentic command-line experience with syntax highlighting
6. **Contact Manager Demo**: Full CRUD app showcasing RDBMS capabilities
7. **CSV/JSON Import/Export**: Data portability for the demo app
8. **Keyboard Shortcuts**: Ctrl+Enter to run, Esc to clear, Arrow keys for history
9. **Dark/Light Themes**: Customizable UI with terminal aesthetics
10. **Mobile Responsive**: Works on all devices

### Gamification
11. **XP & Ranking System**: 23 military-style ranks from Private to Commander in Chief
12. **Badge Achievements**: SQL Scholar, Query Master, Data Wizard, etc.
13. **Streak Tracking**: Daily activity streaks with server-side persistence
14. **Global Leaderboard**: Compete with other users worldwide

### Security & Safety
15. **Destructive Operation Confirmations**: DROP TABLE and DELETE trigger warning dialogs
16. **Rate Limiting**: Prevents abuse with server-side enforcement
17. **Data Isolation**: Each user's data is completely isolated
18. **Auto Cleanup**: Anonymous data cleaned after 7 days

---

## 🔑 Authentication

### Terminal-Based Auth Flow

The authentication uses a unique terminal-style interface:

1. **Commands**: `SIGNUP`, `LOGIN`, `RECOVER`, `EXIT`
2. **OTP Verification**: 6-digit code sent to email (auto-confirm enabled for demo)
3. **Password Toggle**: Press `Shift+T` to show/hide password
4. **Escape to Cancel**: Press `Esc` to exit auth flow

### Session Tracking

- **Visit Counter**: Per-session tracking using sessionStorage
- **Session ID**: Unique per browser tab/window
- **User ID**: Persistent after authentication

---

## ⚠️ Design Decisions & Trade-offs

### Why Browser-Based Storage?

1. **Educational Focus**: Demonstrates RDBMS concepts without backend complexity
2. **Instant Feedback**: No network latency for query execution
3. **Privacy**: User data stays isolated by session/user

### Why Supabase for Persistence?

1. **RLS Policies**: Built-in row-level security
2. **Edge Functions**: Server-side rate limiting
3. **Authentication**: Secure user management
4. **Scalability**: Handles multiple concurrent users

### Why In-Memory B-Tree Indexes?

1. **Performance**: Faster lookups for repeated queries
2. **Educational**: Demonstrates real index structures
3. **Simplicity**: No need for persistent index storage

---

## 👨‍💻 Author

**Samuel Muriuki**
- Portfolio: [samuel-muriuki.vercel.app](https://samuel-muriuki.vercel.app/)
- GitHub: [github.com/Samuel-Muriuki](https://github.com/Samuel-Muriuki)

Built in collaboration with [Lovable](https://lovable.dev) AI.

---

## 📄 License

This project was created for the Pesapal Junior Developer Challenge 2026.

---

## 🙏 Acknowledgments

- **Pesapal** for the challenging and interesting problem
- **Lovable AI** for collaboration on development
- The open-source community for inspiration on SQL parsing techniques
