-- Migração manual (DATABASE_SYNC=false).
-- Agrupa documentos em PF / PJ.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'workspace_documents_person_scope_enum'
  ) THEN
    CREATE TYPE workspace_documents_person_scope_enum AS ENUM ('PF', 'PJ');
  END IF;
END
$$;

ALTER TABLE workspace_documents
  ADD COLUMN IF NOT EXISTS person_scope workspace_documents_person_scope_enum NOT NULL DEFAULT 'PF';
