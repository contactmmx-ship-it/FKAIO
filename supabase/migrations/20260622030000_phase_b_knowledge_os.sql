-- ============================================================================
-- Phase B: Knowledge Operating System
-- ============================================================================
-- Creates the full schema for a RAG-based Knowledge OS: ingest documents,
-- chunk them, embed them via pgvector, and perform semantic search with
-- audit logging.
--
-- Tables created:
--   knowledge_sources     — Top-level knowledge collections (brand-scoped)
--   knowledge_documents  — Individual files within a source
--   knowledge_chunks      — Text chunks extracted from documents
--   knowledge_embeddings — Vector embeddings for each chunk (pgvector)
--   knowledge_search_log  — Audit trail of semantic searches performed
--
-- Extension required: pgvector (CREATE EXTENSION IF NOT EXISTS vector)
--
-- Indexes:
--   HNSW index on knowledge_embeddings.embedding for fast cosine similarity
--   Composite indexes on source_id+status, document_id+chunk_index,
--   consultant_id+created_at
--
-- RLS:
--   All knowledge tables — SELECT for authenticated, write for admin only
--   knowledge_search_log — INSERT for any authenticated user, SELECT own only
--   Edge functions using the service_role key bypass RLS entirely.
-- ============================================================================

-- ============================================================================
-- 0. ENABLE PGVECTOR EXTENSION
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- 1. knowledge_sources
-- ============================================================================
CREATE TABLE IF NOT EXISTS knowledge_sources (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  source_type    text NOT NULL CHECK (source_type IN ('pdf', 'docx', 'txt', 'markdown', 'url', 'manual')),
  description    text,
  brand_id       uuid REFERENCES brands(id) ON DELETE SET NULL,
  tags           text[] DEFAULT '{}',
  metadata       jsonb DEFAULT '{}',
  document_count integer DEFAULT 0,
  status         text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'processing')),
  created_by     uuid REFERENCES auth.users(id),
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

COMMENT ON TABLE knowledge_sources IS
'Phase B Knowledge OS: Top-level knowledge collections. Each source represents a '
'distinct body of knowledge (e.g. "Brand X Franchise Handbook") that can be '
'scoped to a brand via brand_id.';

COMMENT ON COLUMN knowledge_sources.source_type IS
'Type of the knowledge source. "manual" = user-typed entries; others = file/URL ingestion.';
COMMENT ON COLUMN knowledge_sources.metadata IS
'Arbitrary JSONB metadata: language, version, ingestion config, etc.';

ALTER TABLE knowledge_sources ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. knowledge_documents
-- ============================================================================
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id     uuid NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  title         text NOT NULL,
  file_type     text NOT NULL,
  file_size     integer,
  storage_path  text,
  raw_text      text,
  status        text NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'parsed', 'chunked', 'embedded', 'failed')),
  chunk_count   integer DEFAULT 0,
  error_message text,
  metadata      jsonb DEFAULT '{}',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

COMMENT ON TABLE knowledge_documents IS
'Phase B Knowledge OS: Individual files uploaded into a knowledge source. '
'Tracks the full ingestion pipeline status from upload → parse → chunk → embed.';

COMMENT ON COLUMN knowledge_documents.storage_path IS
'Path to the file in Supabase Storage (e.g. knowledge/abc123/document.pdf).';
COMMENT ON COLUMN knowledge_documents.raw_text IS
'Full extracted text content. Stored so we can re-chunk without re-uploading.';
COMMENT ON COLUMN knowledge_documents.metadata IS
'JSONB metadata: page count, language detected, upload source, etc.';

ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. knowledge_chunks
-- ============================================================================
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  content     text NOT NULL,
  token_count integer NOT NULL DEFAULT 0,
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);

COMMENT ON TABLE knowledge_chunks IS
'Phase B Knowledge OS: Text chunks extracted from knowledge documents. '
'Each chunk is a window of text (typically 512–2048 tokens) with overlap.';

COMMENT ON COLUMN knowledge_chunks.metadata IS
'JSONB with page_number, section_heading, start_char, end_char, etc.';

ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. knowledge_embeddings
-- ============================================================================
CREATE TABLE IF NOT EXISTS knowledge_embeddings (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id  uuid NOT NULL REFERENCES knowledge_chunks(id) ON DELETE CASCADE,
  embedding vector(1536),
  model     text NOT NULL DEFAULT 'text-embedding-ada-002',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT uq_knowledge_embeddings_chunk UNIQUE (chunk_id)
);

COMMENT ON TABLE knowledge_embeddings IS
'Phase B Knowledge OS: Vector embeddings for knowledge chunks. '
'Dimension 1536 = OpenAI text-embedding-ada-002. The HNSW index enables '
'fast approximate nearest-neighbor search via cosine similarity.';

COMMENT ON COLUMN knowledge_embeddings.model IS
'Embedding model name. Allows future migration to text-embedding-3-small/large '
'by adding new rows with a different model value.';

ALTER TABLE knowledge_embeddings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. knowledge_search_log
-- ============================================================================
CREATE TABLE IF NOT EXISTS knowledge_search_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query         text NOT NULL,
  embedding     vector(1536),
  results_count integer,
  top_chunk_ids uuid[],
  agent_id      uuid REFERENCES ai_agents(id) ON DELETE SET NULL,
  consultant_id uuid REFERENCES consultants(id) ON DELETE SET NULL,
  latency_ms    integer,
  created_at    timestamptz DEFAULT now()
);

COMMENT ON TABLE knowledge_search_log IS
'Phase B Knowledge OS: Audit log of every semantic search performed against '
'the knowledge base. Stores the query embedding, result count, top chunk IDs, '
'and latency for analytics and debugging.';

COMMENT ON COLUMN knowledge_search_log.embedding IS
'Vector embedding of the search query, used for analytics and potential '
're-ranking without re-computing the embedding.';
COMMENT ON COLUMN knowledge_search_log.top_chunk_ids IS
'UUIDs of the top-K chunks returned by the search, for click-through analysis.';

ALTER TABLE knowledge_search_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. UPDATED_AT TRIGGER FUNCTION
-- ============================================================================
-- Reusable trigger function: sets updated_at = now() on every row mutation.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION set_updated_at() IS
'Reusable trigger function for auto-setting updated_at on row mutation.';

-- Attach the trigger to every Knowledge OS table that has an updated_at column.
DROP TRIGGER IF EXISTS trg_knowledge_sources_updated_at ON knowledge_sources;
CREATE TRIGGER trg_knowledge_sources_updated_at
  BEFORE UPDATE ON knowledge_sources
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_knowledge_documents_updated_at ON knowledge_documents;
CREATE TRIGGER trg_knowledge_documents_updated_at
  BEFORE UPDATE ON knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Note: knowledge_chunks and knowledge_embeddings do not have updated_at columns.

DROP TRIGGER IF EXISTS trg_knowledge_search_log_updated_at ON knowledge_search_log;
CREATE TRIGGER trg_knowledge_search_log_updated_at
  BEFORE UPDATE ON knowledge_search_log
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 7. INDEXES
-- ============================================================================

-- knowledge_documents: lookup by source + status (pipeline queries)
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_source_status
  ON knowledge_documents (source_id, status);

-- knowledge_chunks: ordered retrieval within a document
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_document_index
  ON knowledge_chunks (document_id, chunk_index);

-- knowledge_search_log: per-consultant search history (time-series)
CREATE INDEX IF NOT EXISTS idx_knowledge_search_log_consultant_time
  ON knowledge_search_log (consultant_id, created_at);

-- knowledge_sources: lookup by brand
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_brand
  ON knowledge_sources (brand_id)
  WHERE brand_id IS NOT NULL;

-- knowledge_sources: lookup by status
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_status
  ON knowledge_sources (status);

-- knowledge_documents: lookup by status (find failed documents)
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_status
  ON knowledge_documents (status)
  WHERE status = 'failed';

-- knowledge_search_log: lookup by agent
CREATE INDEX IF NOT EXISTS idx_knowledge_search_log_agent_time
  ON knowledge_search_log (agent_id, created_at DESC)
  WHERE agent_id IS NOT NULL;

-- ============================================================================
-- 8. HNSW VECTOR INDEX — COSINE SIMILARITY SEARCH
-- ============================================================================
-- HNSW (Hierarchical Navigable Small World) index for approximate nearest
-- neighbor search. vector_cosine_ops = cosine distance operator class.
-- m = 16 (max connections per layer node), ef_construction = 64 (build-time
-- beam width). Good balance of recall vs build speed for 10K–1M vectors.
CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_hnsw
  ON knowledge_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ============================================================================
-- 9. RLS POLICIES — knowledge_sources
-- ============================================================================
-- SELECT: any authenticated user (needed for UI dropdowns, dashboards)
-- INSERT/UPDATE/DELETE: admin only (Founder, OpsHead)
DROP POLICY IF EXISTS knowledge_sources_select ON knowledge_sources;
CREATE POLICY knowledge_sources_select ON knowledge_sources
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS knowledge_sources_insert ON knowledge_sources;
CREATE POLICY knowledge_sources_insert ON knowledge_sources
  FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS knowledge_sources_update ON knowledge_sources;
CREATE POLICY knowledge_sources_update ON knowledge_sources
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS knowledge_sources_delete ON knowledge_sources;
CREATE POLICY knowledge_sources_delete ON knowledge_sources
  FOR DELETE TO authenticated USING (is_admin());

-- ============================================================================
-- 10. RLS POLICIES — knowledge_documents
-- ============================================================================
DROP POLICY IF EXISTS knowledge_documents_select ON knowledge_documents;
CREATE POLICY knowledge_documents_select ON knowledge_documents
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS knowledge_documents_insert ON knowledge_documents;
CREATE POLICY knowledge_documents_insert ON knowledge_documents
  FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS knowledge_documents_update ON knowledge_documents;
CREATE POLICY knowledge_documents_update ON knowledge_documents
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS knowledge_documents_delete ON knowledge_documents;
CREATE POLICY knowledge_documents_delete ON knowledge_documents
  FOR DELETE TO authenticated USING (is_admin());

-- ============================================================================
-- 11. RLS POLICIES — knowledge_chunks
-- ============================================================================
DROP POLICY IF EXISTS knowledge_chunks_select ON knowledge_chunks;
CREATE POLICY knowledge_chunks_select ON knowledge_chunks
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS knowledge_chunks_insert ON knowledge_chunks;
CREATE POLICY knowledge_chunks_insert ON knowledge_chunks
  FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS knowledge_chunks_update ON knowledge_chunks;
CREATE POLICY knowledge_chunks_update ON knowledge_chunks
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS knowledge_chunks_delete ON knowledge_chunks;
CREATE POLICY knowledge_chunks_delete ON knowledge_chunks
  FOR DELETE TO authenticated USING (is_admin());

-- ============================================================================
-- 12. RLS POLICIES — knowledge_embeddings
-- ============================================================================
DROP POLICY IF EXISTS knowledge_embeddings_select ON knowledge_embeddings;
CREATE POLICY knowledge_embeddings_select ON knowledge_embeddings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS knowledge_embeddings_insert ON knowledge_embeddings;
CREATE POLICY knowledge_embeddings_insert ON knowledge_embeddings
  FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS knowledge_embeddings_update ON knowledge_embeddings;
CREATE POLICY knowledge_embeddings_update ON knowledge_embeddings
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS knowledge_embeddings_delete ON knowledge_embeddings;
CREATE POLICY knowledge_embeddings_delete ON knowledge_embeddings
  FOR DELETE TO authenticated USING (is_admin());

-- ============================================================================
-- 13. RLS POLICIES — knowledge_search_log
-- ============================================================================
-- INSERT: any authenticated user can log their own searches (needed for
--          the frontend + edge function to record what consultants query)
-- SELECT: own searches only (consultant_id = get_my_consultant_id()),
--         admins see everything
DROP POLICY IF EXISTS knowledge_search_log_insert ON knowledge_search_log;
CREATE POLICY knowledge_search_log_insert ON knowledge_search_log
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS knowledge_search_log_select_own ON knowledge_search_log;
CREATE POLICY knowledge_search_log_select_own ON knowledge_search_log
  FOR SELECT TO authenticated
  USING (
    consultant_id = get_my_consultant_id()
  );

DROP POLICY IF EXISTS knowledge_search_log_select_admin ON knowledge_search_log;
CREATE POLICY knowledge_search_log_select_admin ON knowledge_search_log
  FOR SELECT TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS knowledge_search_log_delete ON knowledge_search_log;
CREATE POLICY knowledge_search_log_delete ON knowledge_search_log
  FOR DELETE TO authenticated USING (is_admin());

-- ============================================================================
-- 14. HELPER FUNCTION: semantic_search_knowledge()
-- ============================================================================
-- Performs vector cosine similarity search across the knowledge base.
-- Returns ranked chunks with their parent document and source metadata.
-- SECURITY DEFINER so the edge function (using service_role) or any
-- authenticated caller can execute it regardless of their RLS context.
CREATE OR REPLACE FUNCTION semantic_search_knowledge(
  p_query_embedding  vector(1536),
  p_brand_id         uuid DEFAULT NULL,
  p_source_id        uuid DEFAULT NULL,
  p_limit            integer DEFAULT 10,
  p_threshold        real DEFAULT 0.7
)
RETURNS TABLE (
  chunk_id     uuid,
  chunk_index  integer,
  content      text,
  token_count  integer,
  similarity   real,
  document_id  uuid,
  document_title text,
  source_id    uuid,
  source_name  text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    kc.id,
    kc.chunk_index,
    kc.content,
    kc.token_count,
    1 - (ke.embedding <=> p_query_embedding) AS similarity,
    kd.id,
    kd.title,
    ks.id,
    ks.name
  FROM knowledge_embeddings ke
  INNER JOIN knowledge_chunks kc ON kc.id = ke.chunk_id
  INNER JOIN knowledge_documents kd ON kd.id = kc.document_id
  INNER JOIN knowledge_sources ks ON ks.id = kd.source_id
  WHERE
    ks.status = 'active'
    AND kd.status IN ('chunked', 'embedded')
    AND ke.embedding <=> p_query_embedding < (1 - p_threshold)
    AND (p_brand_id IS NULL OR ks.brand_id = p_brand_id)
    AND (p_source_id IS NULL OR ks.id = p_source_id)
  ORDER BY ke.embedding <=> p_query_embedding
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION semantic_search_knowledge IS
'Phase B Knowledge OS: Performs semantic search via cosine similarity on the '
'knowledge embeddings. Returns ranked chunks with source/document context. '
'Optional filters: p_brand_id, p_source_id, p_limit (default 10), '
'p_threshold (cosine similarity floor, default 0.7). '
'Threshold uses 1 - cosine_distance, so 0.7 means < 0.3 cosine distance.';

-- ============================================================================
-- 15. HELPER FUNCTION: log_knowledge_search()
-- ============================================================================
-- Convenience function to insert a search log entry in one call.
-- SECURITY DEFINER: the edge function can call this with service_role key.
CREATE OR REPLACE FUNCTION log_knowledge_search(
  p_query         text,
  p_embedding     vector(1536),
  p_results_count integer DEFAULT NULL,
  p_top_chunk_ids uuid[] DEFAULT NULL,
  p_agent_id      uuid DEFAULT NULL,
  p_consultant_id uuid DEFAULT NULL,
  p_latency_ms    integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
AS $$
  INSERT INTO knowledge_search_log (
    query, embedding, results_count, top_chunk_ids,
    agent_id, consultant_id, latency_ms
  )
  VALUES (
    p_query, p_embedding, p_results_count, p_top_chunk_ids,
    p_agent_id, p_consultant_id, p_latency_ms
  )
  RETURNING id;
$$;

COMMENT ON FUNCTION log_knowledge_search IS
'Phase B Knowledge OS: Inserts a search audit log entry. Returns the log ID. '
'Called by the edge function after every semantic search.';

-- ============================================================================
-- 16. HELPER FUNCTION: count_documents_for_source()
-- ============================================================================
-- Trigger-compatible function: updates knowledge_sources.document_count
-- to reflect the actual number of documents in that source.
CREATE OR REPLACE FUNCTION count_documents_for_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE knowledge_sources
    SET document_count = (SELECT COUNT(*) FROM knowledge_documents WHERE source_id = NEW.source_id)
    WHERE id = NEW.source_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE knowledge_sources
    SET document_count = (SELECT COUNT(*) FROM knowledge_documents WHERE source_id = OLD.source_id)
    WHERE id = OLD.source_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION count_documents_for_source IS
'Phase B Knowledge OS: Trigger function to keep knowledge_sources.document_count '
'in sync with the actual number of documents in each source.';

-- Attach AFTER INSERT/DELETE on knowledge_documents
DROP TRIGGER IF EXISTS trg_count_documents_insert ON knowledge_documents;
CREATE TRIGGER trg_count_documents_insert
  AFTER INSERT ON knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION count_documents_for_source();

DROP TRIGGER IF EXISTS trg_count_documents_delete ON knowledge_documents;
CREATE TRIGGER trg_count_documents_delete
  AFTER DELETE ON knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION count_documents_for_source();

-- ============================================================================
-- 17. HELPER FUNCTION: count_chunks_for_document()
-- ============================================================================
-- Trigger-compatible function: updates knowledge_documents.chunk_count
-- to reflect the actual number of chunks in that document.
CREATE OR REPLACE FUNCTION count_chunks_for_document()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE knowledge_documents
    SET chunk_count = (SELECT COUNT(*) FROM knowledge_chunks WHERE document_id = NEW.document_id)
    WHERE id = NEW.document_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE knowledge_documents
    SET chunk_count = (SELECT COUNT(*) FROM knowledge_chunks WHERE document_id = OLD.document_id)
    WHERE id = OLD.document_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION count_chunks_for_document IS
'Phase B Knowledge OS: Trigger function to keep knowledge_documents.chunk_count '
'in sync with the actual number of chunks in each document.';

-- Attach AFTER INSERT/DELETE on knowledge_chunks
DROP TRIGGER IF EXISTS trg_count_chunks_insert ON knowledge_chunks;
CREATE TRIGGER trg_count_chunks_insert
  AFTER INSERT ON knowledge_chunks
  FOR EACH ROW EXECUTE FUNCTION count_chunks_for_document();

DROP TRIGGER IF EXISTS trg_count_chunks_delete ON knowledge_chunks;
CREATE TRIGGER trg_count_chunks_delete
  AFTER DELETE ON knowledge_chunks
  FOR EACH ROW EXECUTE FUNCTION count_chunks_for_document();

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
