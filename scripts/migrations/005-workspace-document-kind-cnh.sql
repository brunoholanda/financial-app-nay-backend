-- Adiciona CNH ao enum em bases já criadas pela 004 antes de incluir CNH.
-- Seguro executar várias vezes (só adiciona se ainda não existir).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'workspace_document_kind_enum'
      AND e.enumlabel = 'CNH'
  ) THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'CNH';
  END IF;
END$$;
