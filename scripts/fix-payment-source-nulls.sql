-- Se a sincronização TypeORM já criou payment_source como NULL em linhas antigas,
-- rode uma vez contra o mesmo banco (ajuste nomes do tipo enum se necessário):

UPDATE transactions SET payment_source = 'CASH' WHERE payment_source IS NULL;
UPDATE recurring_series SET payment_source = 'CASH' WHERE payment_source IS NULL;

-- Depois garanta DEFAULT e NOT NULL (descomente se a coluna já existir e for nullable):
-- ALTER TABLE transactions ALTER COLUMN payment_source SET DEFAULT 'CASH';
-- ALTER TABLE transactions ALTER COLUMN payment_source SET NOT NULL;
-- ALTER TABLE recurring_series ALTER COLUMN payment_source SET DEFAULT 'CASH';
-- ALTER TABLE recurring_series ALTER COLUMN payment_source SET NOT NULL;
