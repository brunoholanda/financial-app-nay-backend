-- Migração manual (DATABASE_SYNC=false).
-- Seguros por workspace: tipos, prêmio, parcelas, coberturas (jsonb), vigência e alertas.

CREATE TYPE insurance_type_enum AS ENUM (
  'VIDA',
  'VIDA_GRUPO',
  'ACIDENTES_PESSOAIS_INDIVIDUAL',
  'ACIDENTES_PESSOAIS_COLETIVO',
  'SAUDE_INDIVIDUAL_FAMILIAR',
  'SAUDE_EMPRESARIAL',
  'ODONTO_INDIVIDUAL',
  'ODONTO_EMPRESARIAL',
  'AUTOMOVEL_COMPLETO',
  'AUTOMOVEL_TERCEIROS',
  'FROTA',
  'MOTOCICLETA',
  'CAMINHAO',
  'RESIDENCIAL',
  'CONDOMINIO',
  'EMPRESARIAL',
  'LOCADOR',
  'INCENDIO',
  'MULTIPLO_RISCOS',
  'VIAGEM_INTERNACIONAL',
  'VIAGEM_NACIONAL',
  'RESPONSABILIDADE_CIVIL_GERAL',
  'RESPONSABILIDADE_CIVIL_PROFISSIONAL',
  'D_AND_O',
  'E_AND_O',
  'FIANCA_LOCATICIA',
  'FIANCA_JUDICIAL',
  'AGRICOLA',
  'RURAL_PECUARIO',
  'AERONAUTICO',
  'MARITIMO',
  'TRANSPORTE_NACIONAL_INTERNACIONAL',
  'EQUIPAMENTOS',
  'EVENTOS',
  'PET',
  'CELULAR_GADGET',
  'CYBER_RISCOS',
  'GARANTIA',
  'PREVIDENCIA_PRIVADA',
  'EDUCACIONAL',
  'ATRASO_EMBARQUE_BAGAGEM',
  'OUTRO'
);

CREATE TYPE insurance_payment_mode_enum AS ENUM (
  'SINGLE',
  'INSTALLMENTS'
);

CREATE TABLE workspace_insurances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title varchar(256) NOT NULL,
  insurance_type insurance_type_enum NOT NULL,
  insurer_name varchar(256) NULL,
  policy_number varchar(120) NULL,
  insured_capital decimal(16, 2) NOT NULL,
  premium_total decimal(16, 2) NOT NULL,
  payment_mode insurance_payment_mode_enum NOT NULL,
  installment_count smallint NULL,
  installment_value decimal(16, 2) NULL,
  coverages jsonb NOT NULL DEFAULT '[]'::jsonb,
  validity_start date NOT NULL,
  validity_end date NOT NULL,
  alert_days_before smallint NOT NULL DEFAULT 30,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_workspace_insurances_ws_end ON workspace_insurances (workspace_id, validity_end);
