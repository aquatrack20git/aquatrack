-- Tabla para guardar facturas/cobros calculados
CREATE TABLE IF NOT EXISTS bills (
    id BIGSERIAL PRIMARY KEY,
    meter_id VARCHAR(50) REFERENCES meters(code_meter),
    period VARCHAR(20) NOT NULL,
    previous_reading NUMERIC(10, 2),
    current_reading NUMERIC(10, 2),
    consumption NUMERIC(10, 2) NOT NULL,
    base_amount NUMERIC(10, 2) DEFAULT 0,
    range_16_20_amount NUMERIC(10, 2) DEFAULT 0,
    range_21_25_amount NUMERIC(10, 2) DEFAULT 0,
    range_26_plus_amount NUMERIC(10, 2) DEFAULT 0,
    tariff_total NUMERIC(10, 2) DEFAULT 0,
    previous_debt NUMERIC(10, 2) DEFAULT 0,
    fines_reuniones NUMERIC(10, 2) DEFAULT 0,
    fines_mingas NUMERIC(10, 2) DEFAULT 0,
    mora_amount NUMERIC(10, 2) DEFAULT 0,
    garden_amount NUMERIC(10, 2) DEFAULT 0,
    total_amount NUMERIC(10, 2) NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'PENDIENTE', -- PENDIENTE, ACREDITADO
    payment_date TIMESTAMP WITH TIME ZONE,
    observations TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE(meter_id, period)
);

-- Tabla para deudas anteriores (ingresadas manualmente)
CREATE TABLE IF NOT EXISTS debts (
    id BIGSERIAL PRIMARY KEY,
    meter_id VARCHAR(50) REFERENCES meters(code_meter),
    period VARCHAR(20) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE(meter_id, period)
);

-- Tabla para multas y mora por medidor
CREATE TABLE IF NOT EXISTS meter_fines (
    id BIGSERIAL PRIMARY KEY,
    meter_id VARCHAR(50) REFERENCES meters(code_meter),
    period VARCHAR(20) NOT NULL,
    fines_reuniones NUMERIC(10, 2) DEFAULT 0,
    fines_mingas NUMERIC(10, 2) DEFAULT 0,
    mora_percentage NUMERIC(5, 2) DEFAULT 0, -- Porcentaje de mora
    mora_amount NUMERIC(10, 2) DEFAULT 0, -- Monto calculado de mora
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE(meter_id, period)
);

-- Tabla para valores de jardín (se puede importar desde Excel)
CREATE TABLE IF NOT EXISTS garden_values (
    id BIGSERIAL PRIMARY KEY,
    meter_id VARCHAR(50) REFERENCES meters(code_meter),
    period VARCHAR(20) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    imported_from_excel BOOLEAN DEFAULT false,
    import_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE(meter_id, period)
);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_bills_meter_id ON bills(meter_id);
CREATE INDEX IF NOT EXISTS idx_bills_period ON bills(period);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(payment_status);
CREATE INDEX IF NOT EXISTS idx_debts_meter_id ON debts(meter_id);
CREATE INDEX IF NOT EXISTS idx_debts_period ON debts(period);
CREATE INDEX IF NOT EXISTS idx_meter_fines_meter_id ON meter_fines(meter_id);
CREATE INDEX IF NOT EXISTS idx_meter_fines_period ON meter_fines(period);
CREATE INDEX IF NOT EXISTS idx_garden_values_meter_id ON garden_values(meter_id);
CREATE INDEX IF NOT EXISTS idx_garden_values_period ON garden_values(period);

-- Habilitar RLS
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE meter_fines ENABLE ROW LEVEL SECURITY;
ALTER TABLE garden_values ENABLE ROW LEVEL SECURITY;

-- Políticas para bills
DROP POLICY IF EXISTS "Enable read access for all users" ON bills;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON bills;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON bills;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON bills;

CREATE POLICY "Enable read access for all users" ON bills
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON bills
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON bills
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON bills
    FOR DELETE USING (auth.role() = 'authenticated');

-- Políticas para debts
DROP POLICY IF EXISTS "Enable read access for all users" ON debts;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON debts;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON debts;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON debts;

CREATE POLICY "Enable read access for all users" ON debts
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON debts
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON debts
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON debts
    FOR DELETE USING (auth.role() = 'authenticated');

-- Políticas para meter_fines
DROP POLICY IF EXISTS "Enable read access for all users" ON meter_fines;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON meter_fines;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON meter_fines;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON meter_fines;

CREATE POLICY "Enable read access for all users" ON meter_fines
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON meter_fines
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON meter_fines
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON meter_fines
    FOR DELETE USING (auth.role() = 'authenticated');

-- Políticas para garden_values
DROP POLICY IF EXISTS "Enable read access for all users" ON garden_values;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON garden_values;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON garden_values;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON garden_values;

CREATE POLICY "Enable read access for all users" ON garden_values
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON garden_values
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON garden_values
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON garden_values
    FOR DELETE USING (auth.role() = 'authenticated');

-- Triggers para actualizar updated_at
DROP TRIGGER IF EXISTS update_bills_updated_at ON bills;
CREATE TRIGGER update_bills_updated_at
    BEFORE UPDATE ON bills
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_debts_updated_at ON debts;
CREATE TRIGGER update_debts_updated_at
    BEFORE UPDATE ON debts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_meter_fines_updated_at ON meter_fines;
CREATE TRIGGER update_meter_fines_updated_at
    BEFORE UPDATE ON meter_fines
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_garden_values_updated_at ON garden_values;
CREATE TRIGGER update_garden_values_updated_at
    BEFORE UPDATE ON garden_values
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

