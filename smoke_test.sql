-- ============================================
-- MuriukiDB Smoke Test SQL Queries
-- Pesapal Junior Dev Challenge '26
-- ============================================

-- 1) Create table with constraints
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  age INTEGER,
  created_at DATE
);

-- 2) Insert test data
INSERT INTO users (name, email, age, created_at) VALUES
 ('Alice', 'alice@example.com', 30, '2025-01-01'),
 ('Bob', 'bob@example.com', 25, '2025-01-03');

-- 3) Verify rows
SELECT * FROM users ORDER BY id;

-- 4) Test unique constraint (should fail)
INSERT INTO users (name, email) VALUES ('Eve', 'alice@example.com');

-- 5) Create and use index
CREATE INDEX idx_users_email ON users (email);
SELECT * FROM users WHERE email = 'bob@example.com';

-- 6) Test JOIN
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  user_id INTEGER,
  product TEXT
);
INSERT INTO orders (user_id, product) VALUES (1, 'Tea'), (2, 'Coffee');
SELECT u.name, o.product FROM users u INNER JOIN orders o ON u.id = o.user_id;

-- 7) Update & Delete
UPDATE users SET age = 26 WHERE name = 'Bob';
DELETE FROM users WHERE name = 'Alice';

-- 8) Final verification
SELECT * FROM users;

-- 9) Show all tables
SHOW TABLES;

-- 10) Describe table structure
DESCRIBE users;
