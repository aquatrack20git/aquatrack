-- Diferencia = total a pagar − valor jardín (persistido para reportes y arrastre de deuda)
ALTER TABLE bills
ADD COLUMN IF NOT EXISTS difference_amount NUMERIC(10, 2);

UPDATE bills
SET difference_amount = COALESCE(total_amount, 0) - COALESCE(garden_amount, 0)
WHERE difference_amount IS NULL;

ALTER TABLE bills
ALTER COLUMN difference_amount SET DEFAULT 0;

ALTER TABLE bills
ALTER COLUMN difference_amount SET NOT NULL;

COMMENT ON COLUMN bills.difference_amount IS 'Total a pagar menos valor jardín (columna DIFERENCIA)';
