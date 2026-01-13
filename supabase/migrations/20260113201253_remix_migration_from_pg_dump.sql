CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: leaderboard; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leaderboard (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nickname text NOT NULL,
    xp integer DEFAULT 0 NOT NULL,
    level integer DEFAULT 1 NOT NULL,
    queries_executed integer DEFAULT 0 NOT NULL,
    tables_created integer DEFAULT 0 NOT NULL,
    rows_inserted integer DEFAULT 0 NOT NULL,
    badges text[] DEFAULT '{}'::text[],
    browser_fingerprint text,
    last_seen timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rdbms_query_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rdbms_query_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    query text NOT NULL,
    result jsonb,
    success boolean DEFAULT true NOT NULL,
    execution_time_ms integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rdbms_rows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rdbms_rows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    table_id uuid NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rdbms_tables; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rdbms_tables (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    table_name text NOT NULL,
    columns jsonb DEFAULT '[]'::jsonb NOT NULL,
    indexes jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: leaderboard leaderboard_nickname_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leaderboard
    ADD CONSTRAINT leaderboard_nickname_key UNIQUE (nickname);


--
-- Name: leaderboard leaderboard_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leaderboard
    ADD CONSTRAINT leaderboard_pkey PRIMARY KEY (id);


--
-- Name: rdbms_query_history rdbms_query_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rdbms_query_history
    ADD CONSTRAINT rdbms_query_history_pkey PRIMARY KEY (id);


--
-- Name: rdbms_rows rdbms_rows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rdbms_rows
    ADD CONSTRAINT rdbms_rows_pkey PRIMARY KEY (id);


--
-- Name: rdbms_tables rdbms_tables_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rdbms_tables
    ADD CONSTRAINT rdbms_tables_pkey PRIMARY KEY (id);


--
-- Name: rdbms_tables rdbms_tables_table_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rdbms_tables
    ADD CONSTRAINT rdbms_tables_table_name_key UNIQUE (table_name);


--
-- Name: idx_leaderboard_fingerprint; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leaderboard_fingerprint ON public.leaderboard USING btree (browser_fingerprint);


--
-- Name: idx_leaderboard_nickname; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leaderboard_nickname ON public.leaderboard USING btree (nickname);


--
-- Name: idx_leaderboard_xp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leaderboard_xp ON public.leaderboard USING btree (xp DESC);


--
-- Name: idx_rdbms_query_history_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rdbms_query_history_created ON public.rdbms_query_history USING btree (created_at DESC);


--
-- Name: idx_rdbms_rows_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rdbms_rows_data ON public.rdbms_rows USING gin (data);


--
-- Name: idx_rdbms_rows_table_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rdbms_rows_table_id ON public.rdbms_rows USING btree (table_id);


--
-- Name: leaderboard update_leaderboard_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_leaderboard_updated_at BEFORE UPDATE ON public.leaderboard FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: rdbms_rows update_rdbms_rows_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_rdbms_rows_updated_at BEFORE UPDATE ON public.rdbms_rows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: rdbms_tables update_rdbms_tables_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_rdbms_tables_updated_at BEFORE UPDATE ON public.rdbms_tables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: rdbms_rows rdbms_rows_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rdbms_rows
    ADD CONSTRAINT rdbms_rows_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.rdbms_tables(id) ON DELETE CASCADE;


--
-- Name: rdbms_rows Allow public delete access to rows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public delete access to rows" ON public.rdbms_rows FOR DELETE USING (true);


--
-- Name: rdbms_tables Allow public delete access to tables; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public delete access to tables" ON public.rdbms_tables FOR DELETE USING (true);


--
-- Name: rdbms_query_history Allow public insert access to history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert access to history" ON public.rdbms_query_history FOR INSERT WITH CHECK (true);


--
-- Name: rdbms_rows Allow public insert access to rows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert access to rows" ON public.rdbms_rows FOR INSERT WITH CHECK (true);


--
-- Name: rdbms_tables Allow public insert access to tables; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert access to tables" ON public.rdbms_tables FOR INSERT WITH CHECK (true);


--
-- Name: rdbms_query_history Allow public read access to history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access to history" ON public.rdbms_query_history FOR SELECT USING (true);


--
-- Name: rdbms_rows Allow public read access to rows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access to rows" ON public.rdbms_rows FOR SELECT USING (true);


--
-- Name: rdbms_tables Allow public read access to tables; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access to tables" ON public.rdbms_tables FOR SELECT USING (true);


--
-- Name: rdbms_rows Allow public update access to rows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public update access to rows" ON public.rdbms_rows FOR UPDATE USING (true);


--
-- Name: rdbms_tables Allow public update access to tables; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public update access to tables" ON public.rdbms_tables FOR UPDATE USING (true);


--
-- Name: leaderboard Anyone can register on leaderboard; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can register on leaderboard" ON public.leaderboard FOR INSERT WITH CHECK (true);


--
-- Name: leaderboard Leaderboard is viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Leaderboard is viewable by everyone" ON public.leaderboard FOR SELECT USING (true);


--
-- Name: leaderboard Users can update their own leaderboard entry; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own leaderboard entry" ON public.leaderboard FOR UPDATE USING (true);


--
-- Name: leaderboard; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;

--
-- Name: rdbms_query_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rdbms_query_history ENABLE ROW LEVEL SECURITY;

--
-- Name: rdbms_rows; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rdbms_rows ENABLE ROW LEVEL SECURITY;

--
-- Name: rdbms_tables; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rdbms_tables ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;