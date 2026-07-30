-- Migração manual (DATABASE_SYNC=false).
-- FITID do OFX para deduplicar importações bancárias.

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS bank_fit_id varchar(128) NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_ws_account_fitid
  ON transactions (workspace_id, workspace_account_id, bank_fit_id)
  WHERE bank_fit_id IS NOT NULL;
