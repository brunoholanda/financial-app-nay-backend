-- Expande workspace_document_kind_enum com tipos PF/PJ (bases com DATABASE_SYNC=false).
-- Idempotente: só adiciona o valor se ainda não existir.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'PASSAPORTE') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'PASSAPORTE';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'CTPS') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'CTPS';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'TITULO_ELEITOR') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'TITULO_ELEITOR';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'CIE_RNE') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'CIE_RNE';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'CRNM') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'CRNM';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'CERTIDAO_NASCIMENTO') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'CERTIDAO_NASCIMENTO';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'CERTIDAO_CASAMENTO') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'CERTIDAO_CASAMENTO';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'CERTIDAO_OBITO') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'CERTIDAO_OBITO';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'COMPROVANTE_RENDA') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'COMPROVANTE_RENDA';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'DECLARACAO_IRPF') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'DECLARACAO_IRPF';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'COMPROVANTE_ESCOLARIDADE') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'COMPROVANTE_ESCOLARIDADE';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'COMPROVANTE_CONTA_BANCARIA_PF') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'COMPROVANTE_CONTA_BANCARIA_PF';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'CARTEIRA_ORGAO_CLASSE') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'CARTEIRA_ORGAO_CLASSE';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'COMPROVANTE_INSS') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'COMPROVANTE_INSS';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'FGTS_TRABALHADOR') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'FGTS_TRABALHADOR';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'CONTRATO_TRABALHO') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'CONTRATO_TRABALHO';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'PROCURACAO') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'PROCURACAO';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'LAUDO_MEDICO_PERICIA') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'LAUDO_MEDICO_PERICIA';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'CERTIDAO_ANTECEDENTES_CRIMINAIS') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'CERTIDAO_ANTECEDENTES_CRIMINAIS';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'CERTIDAO_NADA_CONSTA_JUSTICA') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'CERTIDAO_NADA_CONSTA_JUSTICA';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'ATA_CONSTITUICAO') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'ATA_CONSTITUICAO';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'ALTERACAO_CONTRATUAL') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'ALTERACAO_CONTRATUAL';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'ESTATUTO_SOCIAL') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'ESTATUTO_SOCIAL';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'ATA_ASSEMBLEIA_REUNIAO_SOCIOS') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'ATA_ASSEMBLEIA_REUNIAO_SOCIOS';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'CERTIDAO_SIMPLIFICADA_JUNTA') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'CERTIDAO_SIMPLIFICADA_JUNTA';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'CERTIFICADO_MEI') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'CERTIFICADO_MEI';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'INSCRICAO_ESTADUAL') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'INSCRICAO_ESTADUAL';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'INSCRICAO_MUNICIPAL') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'INSCRICAO_MUNICIPAL';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'ALVARA_FUNCIONAMENTO') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'ALVARA_FUNCIONAMENTO';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'LICENCA_AMBIENTAL') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'LICENCA_AMBIENTAL';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'LICENCA_SANITARIA') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'LICENCA_SANITARIA';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'ALVARA_BOMBEIROS') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'ALVARA_BOMBEIROS';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'BALANCO_PATRIMONIAL') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'BALANCO_PATRIMONIAL';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'DRE_DEMONSTRATIVO') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'DRE_DEMONSTRATIVO';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'DECLARACOES_ACESSORIAS') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'DECLARACOES_ACESSORIAS';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'CERTIDAO_NEGATIVA_DEBITOS_FEDERAL') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'CERTIDAO_NEGATIVA_DEBITOS_FEDERAL';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'CERTIDAO_DEBITOS_TRABALHISTAS') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'CERTIDAO_DEBITOS_TRABALHISTAS';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'CERTIDAO_DEBITOS_MUNICIPAL') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'CERTIDAO_DEBITOS_MUNICIPAL';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'CERTIDAO_DEBITOS_ESTADUAL') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'CERTIDAO_DEBITOS_ESTADUAL';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'CONTRATO_LOCACAO') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'CONTRATO_LOCACAO';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'CONTRATO_FORNECIMENTO') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'CONTRATO_FORNECIMENTO';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'CONTRATO_SERVICOS') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'CONTRATO_SERVICOS';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'CONVENIO_BANCARIO') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'CONVENIO_BANCARIO';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'NOTA_FISCAL') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'NOTA_FISCAL';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'workspace_document_kind_enum' AND e.enumlabel = 'RECIBO_DESPESA') THEN
    ALTER TYPE workspace_document_kind_enum ADD VALUE 'RECIBO_DESPESA';
  END IF;
END $$;
