# Known Limitations

This document outlines the current limitations of MuriukiDB and the roadmap for future improvements.

---

## SQL Parser

### Single-Statement Execution
- **Behavior**: The REPL now supports multiple semicolon-separated statements, but the parser processes one statement at a time internally.
- **Workaround**: Statements are split at the REPL level and executed sequentially.

### No Nested Subqueries
- **Limitation**: `SELECT * FROM (SELECT ...)` is not supported.
- **Workaround**: Break complex queries into multiple simpler queries.

### No Aggregate Functions in WHERE
- **Limitation**: `WHERE COUNT(*) > 5` is not supported.
- **Workaround**: Use HAVING clause for filtering on aggregates (partial support).

### No CASE/WHEN Expressions
- **Limitation**: Conditional expressions in SELECT are not supported.
- **Workaround**: Handle conditional logic in application code.

---

## Indexing

### In-Memory B-Tree Only
- **Limitation**: Indexes are not persisted across sessions.
- **Impact**: Indexes must be recreated after browser refresh or session restart.
- **Future**: Plan to persist B-Tree metadata in database for session survival.

### No Composite Indexes
- **Limitation**: Only single-column indexes are supported.
- **Workaround**: Create separate indexes for each frequently queried column.

### No Index Statistics
- **Limitation**: Query planner doesn't use cost-based optimization.
- **Impact**: Index selection is based on simple heuristics.

---

## Transactions

### No ACID Transactions
- **Limitation**: No support for BEGIN, COMMIT, ROLLBACK.
- **Impact**: Operations are executed immediately and cannot be rolled back.
- **Workaround**: Use single statements for critical operations.

### No Isolation Levels
- **Limitation**: Concurrent writes may conflict.
- **Behavior**: Last write wins (optimistic concurrency).

### No Rollback on Batch Error
- **Limitation**: When executing multiple statements, if one fails, previous statements are already committed.
- **Workaround**: Test individual statements before running in batch.

---

## Concurrency

### No Locking
- **Limitation**: No row-level or table-level locks.
- **Impact**: Race conditions possible with concurrent users.
- **Mitigation**: Session-based data isolation via RLS policies.

### Optimistic Approach
- **Behavior**: Last write wins in case of conflicts.
- **Workaround**: Use Supabase real-time subscriptions for conflict detection.

---

## Data Types

### Limited Type Support
**Supported Types:**
- INTEGER (whole numbers)
- TEXT (strings)
- REAL (floating-point numbers)
- BOOLEAN (true/false)
- DATE (date strings)

**Not Supported:**
- BLOB/binary data
- JSON type (store as TEXT)
- TIMESTAMP with timezone
- Arrays
- UUID (use TEXT)

---

## Query Features

### Limited HAVING Support
- Basic HAVING clause works but complex expressions may fail.

### No Window Functions
- `ROW_NUMBER()`, `RANK()`, `LAG()`, `LEAD()` are not supported.

### No Common Table Expressions (CTEs)
- `WITH ... AS` syntax is not supported.

### No UNION/INTERSECT/EXCEPT
- Set operations are not supported.

---

## Performance

### Query Timeout
- Queries are limited to 5 seconds execution time.
- Complex joins on large tables may timeout.

### Row Limits
- Maximum 10,000 rows per table.
- SELECT queries return at most 1,000 rows by default.

### Table Limits
- Maximum 50 tables per user session.

---

## Security

### Client-Side Execution
- **Design Choice**: SQL parsing and some execution happens in browser.
- **Mitigation**: Server-side validation, rate limiting, and RLS policies.

### Rate Limiting
- 30 queries per minute maximum.
- Exceeded limits trigger exponential backoff.

---

## Roadmap (Future Improvements)

### Short-Term
1. ✅ Multi-statement execution support
2. 🔄 Better error messages with query position
3. 🔄 Query execution plan visualization

### Medium-Term
1. 📋 Persist B-Tree indexes to database
2. 📋 Transaction layer (BEGIN/COMMIT/ROLLBACK)
3. 📋 Composite indexes

### Long-Term
1. 📋 Subquery support
2. 📋 Window functions
3. 📋 Common Table Expressions (CTEs)
4. 📋 Query cost optimizer

---

## Legend
- ✅ Completed
- 🔄 In Progress
- 📋 Planned
