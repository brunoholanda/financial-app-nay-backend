-- Migração manual (use quando DATABASE_SYNC=false).
-- Com synchronize=true, o TypeORM cria os tipos/tabelas automaticamente; este script
-- pode exigir adaptação dos nomes dos tipos ENUM caso já existam objetos no Postgres.

CREATE TYPE investment_instrument_type_enum AS ENUM (
  'CDB','LCI','LCA','LC','LF','DEBENTURA','DEBENTURA_INFRAESTRUTURA',
  'CRI','CRA','COE','LIG','POUPANCA','TESOURO','FUNDO_RENDA_FIXA',
  'FUNDO_MULTIMERCADO','FUNDO_CAMBIAL','FUNDO_ACOES','FUNDO_INDEXADO',
  'FIDC','FIA','ACAO','ETF','ETF_EXTERIOR','BDR','FII','OPCAO_ACAO',
  'MINI_CONTRATO','TERMO','SWAP','ACION_EXTERIOR','REIT','PREVIDENCIA_ABERTO',
  'PREVIDENCIA_FECHADO','TITULO_CAPITALIZACAO','LETRA_PROMISSORIA',
  'NOTA_PROMISSORIA','EMPRESTIMO_MARGEM','CRYPTO','STABLECOIN','NFT','OUTRO'
);

CREATE TYPE investment_portfolio_category_enum AS ENUM (
  'RENDA_FIXA','RENDA_VARIAVEL','CRYPTO'
);

CREATE TYPE investment_yield_type_enum AS ENUM (
  'PREFIXADO','POS_FIXADO','HIBRIDO'
);

CREATE TYPE investment_liquidity_type_enum AS ENUM (
  'IMEDIATA','D1','D30','VENCIMENTO'
);

CREATE TYPE investment_transaction_kind_enum AS ENUM (
  'APORTE','RESGATE'
);

CREATE TABLE investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  workspace_account_id uuid NOT NULL REFERENCES workspace_accounts(id) ON DELETE RESTRICT,
  name varchar(256) NOT NULL,
  instrument_type investment_instrument_type_enum NOT NULL,
  category investment_portfolio_category_enum NOT NULL,
  invested_amount decimal(16,2) NOT NULL,
  current_amount decimal(16,2) NOT NULL,
  yield_type investment_yield_type_enum NOT NULL,
  indexer varchar(64),
  rate decimal(12,4),
  start_date date NOT NULL,
  end_date date,
  liquidity_type investment_liquidity_type_enum NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_investments_workspace ON investments(workspace_id);
CREATE INDEX idx_investments_account ON investments(workspace_account_id);

CREATE TABLE investment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id uuid NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  kind investment_transaction_kind_enum NOT NULL,
  amount decimal(16,2) NOT NULL,
  date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_inv_tx_investment ON investment_transactions(investment_id);

CREATE TABLE yield_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id uuid NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  date date NOT NULL,
  value decimal(16,2) NOT NULL,
  daily_yield decimal(14,6),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_yield_investment ON yield_history(investment_id);
