-- Preferências de e-mail do digest (contas e seguros)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_notify_bills boolean NOT NULL DEFAULT true;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_notify_insurances boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN users.email_notify_bills IS
  'Quando true, o MASTER recebe o digest diário de contas vencidas / que vencem hoje.';
COMMENT ON COLUMN users.email_notify_insurances IS
  'Quando true, o MASTER recebe o digest diário de seguros vencidos / a vencer.';
