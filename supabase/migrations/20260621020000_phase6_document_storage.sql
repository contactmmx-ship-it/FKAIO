-- Phase 6 Migration: Document Storage Bucket & Enhanced Document Columns

-- 1. Create Supabase Storage bucket 'documents' (private)
-- This must be run via Supabase Dashboard or using the storage API since
-- buckets are managed through the storage schema, not regular SQL.
-- The following is the SQL equivalent for reference:
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documents', 'documents', false, 10485760, ARRAY[
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
])
ON CONFLICT (id) DO NOTHING;

-- 2. Storage RLS Policies for 'documents' bucket
-- Authenticated users can read files
CREATE POLICY "documents_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'documents' AND auth.role() = 'authenticated');

-- Authenticated users can upload files
CREATE POLICY "documents_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');

-- Authenticated users can update files
CREATE POLICY "documents_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'documents' AND auth.role() = 'authenticated') WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');

-- Authenticated users can delete files
CREATE POLICY "documents_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'documents' AND auth.role() = 'authenticated');

-- 3. Add file_url column to documents table (nullable text for public storage URL)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_url text;

-- 4. Add file_size column (integer, nullable)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_size integer;

-- 5. Add version column (integer, default 1)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS version integer DEFAULT 1;

-- 6. Update documents status check constraint to include 'Deleted'
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_status_check;
ALTER TABLE documents ADD CONSTRAINT documents_status_check
  CHECK (status IN ('Pending','Verified','Rejected','Deleted'));

-- 7. Index on file_url for lookups
CREATE INDEX IF NOT EXISTS idx_documents_file_url ON documents(file_url);
CREATE INDEX IF NOT EXISTS idx_documents_lead_status ON documents(lead_id, status);