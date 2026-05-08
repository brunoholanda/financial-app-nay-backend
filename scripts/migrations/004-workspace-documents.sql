-- Migração manual (DATABASE_SYNC=false).
-- Tabela de documentos por workspace e armazenamento em disco (ver DOCUMENTS_UPLOAD_DIR).

CREATE TYPE workspace_document_kind_enum AS ENUM (
  'RG',
  'CPF',
  'CNH',
  'CARTAO_CNPJ',
  'COMPROVANTE_RESIDENCIA',
  'CONTRATO_SOCIAL',
  'CONTRATOS_DIVERSOS',
  'DOCUMENTOS_DIVERSOS'
);

CREATE TABLE workspace_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind workspace_document_kind_enum NOT NULL,
  description text NULL,
  original_file_name varchar(512) NOT NULL,
  stored_file_name varchar(280) NOT NULL,
  mime_type varchar(200) NOT NULL,
  size_bytes int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_workspace_documents_ws_created ON workspace_documents (workspace_id, created_at DESC);
