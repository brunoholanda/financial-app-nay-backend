-- Planos da licença: Padrão (até 10 documentos) e Premium (documentos sem limite)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS plan_tier varchar(16) NOT NULL DEFAULT 'STANDARD';

COMMENT ON COLUMN users.plan_tier IS
  'STANDARD | PREMIUM — o Premium soma um adicional mensal ao plano e libera documentos sem limite. Vale para a conta MASTER; clientes herdam do dono do espaço.';
