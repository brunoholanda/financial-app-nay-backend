-- Segundo fator do login: código de 6 dígitos enviado por e-mail
CREATE TABLE IF NOT EXISTS login_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  code_hash varchar NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  resend_count integer NOT NULL DEFAULT 0,
  last_sent_at timestamptz NOT NULL,
  consumed_at timestamptz NULL,
  request_ip varchar(64) NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_challenges_user_id
  ON login_challenges (user_id);

CREATE INDEX IF NOT EXISTS idx_login_challenges_expires_at
  ON login_challenges (expires_at);

COMMENT ON TABLE login_challenges IS
  'Desafios de 2FA do login. O código só existe em texto puro no e-mail; aqui fica o hash bcrypt.';
COMMENT ON COLUMN login_challenges.consumed_at IS
  'Preenchido quando o código é aceito — impede reuso do mesmo desafio.';
