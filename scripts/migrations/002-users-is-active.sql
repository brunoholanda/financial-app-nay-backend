-- Migração opcional (ambiente com synchronize=false ou ajuste manual)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN users.is_active IS 'Usuários com false não autenticam (login e JWT).';
