-- Migração manual (use quando DATABASE_SYNC=false).

CREATE TABLE savings_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title varchar(256) NOT NULL,
  reference_amount decimal(14,2) NOT NULL,
  paid_amount decimal(14,2) NOT NULL,
  saved_amount decimal(14,2) NOT NULL,
  date date NOT NULL,
  description text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_savings_entries_workspace_date ON savings_entries (workspace_id, date);
