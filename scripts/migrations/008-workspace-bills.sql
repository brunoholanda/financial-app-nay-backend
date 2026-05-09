-- Migração manual (DATABASE_SYNC=false).
-- Contas a pagar por workspace.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'workspace_bills_paid_payment_source_enum'
  ) THEN
    CREATE TYPE workspace_bills_paid_payment_source_enum AS ENUM (
      'CASH',
      'ACCOUNT',
      'CREDIT_CARD'
    );
  END IF;
END
$$;

CREATE TABLE workspace_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title varchar(256) NOT NULL,
  amount decimal(14, 2) NOT NULL,
  due_date date NOT NULL,
  alert_days_before smallint NOT NULL DEFAULT 7,
  is_paid boolean NOT NULL DEFAULT false,
  paid_at date NULL,
  paid_payment_source workspace_bills_paid_payment_source_enum NULL,
  paid_workspace_account_id uuid NULL REFERENCES workspace_accounts(id) ON DELETE SET NULL,
  linked_transaction_id uuid NULL REFERENCES transactions(id) ON DELETE SET NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_workspace_bills_ws_due ON workspace_bills (workspace_id, due_date);
CREATE INDEX idx_workspace_bills_ws_open ON workspace_bills (workspace_id, is_paid);
