-- Área de gestão da plataforma + chamados/sugestões dos usuários

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_manager boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN users.is_manager IS
  'Dono da plataforma: acessa a área de gestão (usuários, chamados e pagamentos). Ligar/desligar aqui vale na hora, sem novo login.';

CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number integer NOT NULL,
  requester_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES workspaces (id) ON DELETE SET NULL,
  category varchar(16) NOT NULL DEFAULT 'SUPPORT',
  priority varchar(16) NOT NULL DEFAULT 'NORMAL',
  status varchar(16) NOT NULL DEFAULT 'OPEN',
  subject varchar(180) NOT NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  manager_unread boolean NOT NULL DEFAULT true,
  requester_unread boolean NOT NULL DEFAULT false,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_support_tickets_number
  ON support_tickets (number);
CREATE INDEX IF NOT EXISTS ix_support_tickets_requester
  ON support_tickets (requester_id);
-- Fila de atendimento: abertos primeiro, mais recentes no topo.
CREATE INDEX IF NOT EXISTS ix_support_tickets_status_last_message
  ON support_tickets (status, last_message_at DESC);

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES support_tickets (id) ON DELETE CASCADE,
  author_id uuid REFERENCES users (id) ON DELETE SET NULL,
  author_name varchar(160) NOT NULL,
  from_manager boolean NOT NULL DEFAULT false,
  is_internal boolean NOT NULL DEFAULT false,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_support_ticket_messages_ticket
  ON support_ticket_messages (ticket_id, created_at);

COMMENT ON COLUMN support_ticket_messages.is_internal IS
  'Nota interna da gestão: nunca é enviada nem exibida ao usuário.';
