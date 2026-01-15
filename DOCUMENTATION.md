# MuriukiDB - Custom RDBMS for Pesapal Junior Dev Challenge '26

## 📋 Overview

MuriukiDB is a custom Relational Database Management System (RDBMS) built as a submission for the **Pesapal Junior Dev Challenge '26**. It features a complete SQL parser, query execution engine with in-memory B-Tree indexing, and an interactive REPL interface, demonstrated through a Contact Manager web application.

**Live Demo**: [https://rdbms.lovable.app](https://rdbms.lovable.app)

---

## 🎯 Challenge Requirements Met

| Requirement | Implementation |
|-------------|----------------|
| Declare tables with column types | ✅ CREATE TABLE with INTEGER, TEXT, REAL, BOOLEAN types |
| CRUD operations | ✅ Full INSERT, SELECT, UPDATE, DELETE support |
| Basic indexing | ✅ In-memory B-Tree indexes with CREATE INDEX |
| Primary and unique keys | ✅ PRIMARY KEY, UNIQUE, NOT NULL, AUTO_INCREMENT |
| JOIN operations | ✅ INNER JOIN and LEFT JOIN with ON clause |
| Interactive REPL | ✅ Terminal-style interface with syntax highlighting |
| Demo application | ✅ Contact Manager with full CRUD, import/export |

---

## 🏗️ Architecture

### Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS with custom terminal theme
- **Backend**: Lovable Cloud (Supabase) for data persistence
- **State Management**: React Context + localStorage

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

### Data Isolation

Each user operates in an isolated environment:
- Session-based isolation using browser fingerprinting
- Authenticated users have persistent, secure storage
- RLS policies enforce strict data access control

---

## 🔒 Security Features

### Implemented Security Measures

1. **XSS Protection**: SQL lexer escapes HTML entities
2. **Rate Limiting**: Server-side enforcement via Edge Functions + client fallback
3. **Input Validation**: Stats validation before leaderboard sync
4. **RLS Policies**: Row-level security on all tables
5. **SECURITY DEFINER Functions**: Protected with auth.uid() checks
6. **Resource Limits**: Max 50 tables, 10k rows/table, 5s query timeout

### Security Fixes Applied

| Issue | Fix |
|-------|-----|
| Client-side rate limit bypass | Added server-side rate limiting via Edge Function |
| SECURITY DEFINER abuse | Added auth.uid() verification in DB functions |
| Leaderboard stats tampering | Client-side validation + capped values on sync |
| localStorage data exposure | Server-side validation before persisting |

---

## 🎮 Gamification System

### SQL Command Ladder (23 Ranks)

Progress from **Private (0 XP)** to **Commander in Chief (1,000,000 XP)**:

| Rank | XP Required |
|------|-------------|
| Private | 0 |
| Private First Class | 50 |
| Corporal | 150 |
| Sergeant | 350 |
| ... | ... |
| General | 540,000 |
| Commander in Chief | 1,000,000 |

### XP Rewards

| Action | XP |
|--------|-----|
| CREATE TABLE | +50 |
| INSERT (per row) | +10 |
| SELECT | +5 |
| UPDATE/DELETE | +15 |

### Anti-Abuse Mechanics

- **Cooldown**: XP gains over 1,000/day reduced to 20%
- **Validation**: Server-side stats verification
- **Rate Limiting**: 30 queries/minute max

---

## 💻 Supported SQL Commands

### DDL (Data Definition Language)

```sql
-- Create table with constraints
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  age INTEGER
);

-- Create index for faster lookups
CREATE INDEX idx_users_email ON users (email);

-- Drop table
DROP TABLE IF EXISTS users;

-- Show all tables
SHOW TABLES;

-- Describe table structure
DESCRIBE users;
```

### DML (Data Manipulation Language)

```sql
-- Insert data
INSERT INTO users (name, email, age) VALUES ('John', 'john@example.com', 25);

-- Select with filters
SELECT name, email FROM users WHERE age > 20 ORDER BY name LIMIT 10;

-- Join tables
SELECT users.name, orders.product 
FROM users 
INNER JOIN orders ON users.id = orders.user_id;

-- Update records
UPDATE users SET age = 26 WHERE name = 'John';

-- Delete records
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

### Environment Variables

The project uses Lovable Cloud, so no manual `.env` setup is required for the demo. For a custom backend, configure:

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
│   └── animations/            # UI animations
├── hooks/
│   ├── useAuth.tsx            # Authentication context
│   ├── useGameStats.tsx       # Gamification state
│   └── useUserFingerprint.tsx # Session tracking
├── lib/rdbms/
│   ├── lexer.ts               # SQL tokenizer
│   ├── parser.ts              # AST builder
│   ├── executor.ts            # Query execution
│   ├── btree.ts               # B-Tree index implementation
│   └── types.ts               # TypeScript interfaces
└── pages/
    ├── Index.tsx              # Main dashboard
    └── Achievements.tsx       # Badges & ranks view
```

---

## 🌟 Key Features

1. **Terminal-Style REPL**: Authentic command-line experience with syntax highlighting
2. **B-Tree Indexing**: In-memory indexes for optimized lookups
3. **Smart Error Messages**: Fuzzy matching suggests correct table/column names
4. **Contact Manager Demo**: Full CRUD app showcasing RDBMS capabilities
5. **CSV/JSON Import/Export**: Data portability
6. **Gamification**: XP, ranks, badges, streaks, leaderboard
7. **Dark/Light Themes**: Customizable UI
8. **Mobile Responsive**: Works on all devices
9. **Keyboard Shortcuts**: Power user productivity

---

## 👨‍💻 Author

**Samuel Muriuki**
- Portfolio: [samuel-muriuki.vercel.app](https://samuel-muriuki.vercel.app/)
- GitHub: [github.com/Samuel-Muriuki](https://github.com/Samuel-Muriuki)

Built in collaboration with [Lovable](https://lovable.dev) AI.

---

## 📄 License

This project was created for the Pesapal Junior Developer Challenge 2026.
