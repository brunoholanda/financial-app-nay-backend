-- Adiciona CREDIT_CARD ao enum de payment_source (bases já existentes).
-- Nomes de tipo citam o padrão típico do TypeORM + Postgres (ajuste se o seu differe).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transactions_payment_source_enum') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'transactions_payment_source_enum' AND e.enumlabel = 'CREDIT_CARD'
    ) THEN
      ALTER TYPE transactions_payment_source_enum ADD VALUE 'CREDIT_CARD';
    END IF;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recurring_series_payment_source_enum') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'recurring_series_payment_source_enum' AND e.enumlabel = 'CREDIT_CARD'
    ) THEN
      ALTER TYPE recurring_series_payment_source_enum ADD VALUE 'CREDIT_CARD';
    END IF;
  END IF;
END$$;
