-- Fix per-user/session database isolation
-- Remove the global unique constraint on table_name that prevents different users from having same table names

-- First drop the existing unique constraint
ALTER TABLE public.rdbms_tables DROP CONSTRAINT IF EXISTS rdbms_tables_table_name_key;

-- Drop any unique index on table_name alone
DROP INDEX IF EXISTS rdbms_tables_table_name_key;

-- Create owner-scoped unique indexes:
-- 1. For authenticated users: unique per user_id
CREATE UNIQUE INDEX IF NOT EXISTS rdbms_tables_user_table_unique 
ON public.rdbms_tables (user_id, table_name) 
WHERE user_id IS NOT NULL;

-- 2. For anonymous sessions: unique per session_id
CREATE UNIQUE INDEX IF NOT EXISTS rdbms_tables_session_table_unique 
ON public.rdbms_tables (session_id, table_name) 
WHERE user_id IS NULL AND session_id IS NOT NULL;