-- Licença de uso: teste grátis de 15 dias e assinatura mensal (Stripe)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS subscription_status varchar(16) NOT NULL DEFAULT 'TRIALING';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS subscription_ends_at timestamptz NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS license_exempt boolean NOT NULL DEFAULT false;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_customer_id varchar(64) NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_subscription_id varchar(64) NULL;

-- Contas que já existiam antes do plano continuam liberadas: todo cadastro novo
-- grava trial_ends_at, então a ausência desse campo identifica o legado.
UPDATE users
SET license_exempt = true
WHERE license_exempt = false
  AND role = 'MASTER'
  AND trial_ends_at IS NULL
  AND subscription_ends_at IS NULL
  AND stripe_customer_id IS NULL;

COMMENT ON COLUMN users.subscription_status IS
  'TRIALING | ACTIVE | PAST_DUE | CANCELED | EXPIRED — vale para a conta MASTER; clientes herdam do dono do espaço.';
COMMENT ON COLUMN users.license_exempt IS
  'Quando true, a conta usa o sistema sem licença (dono da plataforma / contas legadas).';
