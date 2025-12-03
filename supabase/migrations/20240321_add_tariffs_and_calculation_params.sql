-- Tabla de tarifas basada en la estructura del Excel
CREATE TABLE IF NOT EXISTS tariffs (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    min_consumption NUMERIC(10, 2) NOT NULL DEFAULT 0,
    max_consumption NUMERIC(10, 2),
    price_per_unit NUMERIC(10, 4) NOT NULL,
    max_units NUMERIC(10, 2), -- Para limitar unidades (ej: máximo 5 m³ en rango 16-20)
    fixed_charge NUMERIC(10, 2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Tabla de parámetros de cálculo
CREATE TABLE IF NOT EXISTS calculation_params (
    id BIGSERIAL PRIMARY KEY,
    param_key VARCHAR(100) UNIQUE NOT NULL,
    param_name VARCHAR(255) NOT NULL,
    param_value TEXT NOT NULL,
    param_type VARCHAR(50) DEFAULT 'number', -- number, text, formula, boolean
    description TEXT,
    category VARCHAR(100), -- general, tariff, billing, multas, mora, jardin
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_tariffs_status ON tariffs(status);
CREATE INDEX IF NOT EXISTS idx_tariffs_order ON tariffs(order_index);
CREATE INDEX IF NOT EXISTS idx_tariffs_consumption ON tariffs(min_consumption, max_consumption);
CREATE INDEX IF NOT EXISTS idx_calculation_params_key ON calculation_params(param_key);
CREATE INDEX IF NOT EXISTS idx_calculation_params_category ON calculation_params(category);
CREATE INDEX IF NOT EXISTS idx_calculation_params_active ON calculation_params(is_active);

-- Habilitar RLS
ALTER TABLE tariffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculation_params ENABLE ROW LEVEL SECURITY;

-- Políticas para tariffs
DROP POLICY IF EXISTS "Enable read access for all users" ON tariffs;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON tariffs;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON tariffs;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON tariffs;

CREATE POLICY "Enable read access for all users" ON tariffs
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON tariffs
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON tariffs
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON tariffs
    FOR DELETE USING (auth.role() = 'authenticated');

-- Políticas para calculation_params
DROP POLICY IF EXISTS "Enable read access for all users" ON calculation_params;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON calculation_params;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON calculation_params;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON calculation_params;

CREATE POLICY "Enable read access for all users" ON calculation_params
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON calculation_params
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON calculation_params
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON calculation_params
    FOR DELETE USING (auth.role() = 'authenticated');

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para actualizar updated_at
DROP TRIGGER IF EXISTS update_tariffs_updated_at ON tariffs;
CREATE TRIGGER update_tariffs_updated_at
    BEFORE UPDATE ON tariffs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_calculation_params_updated_at ON calculation_params;
CREATE TRIGGER update_calculation_params_updated_at
    BEFORE UPDATE ON calculation_params
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insertar tarifas por defecto basadas en el Excel
INSERT INTO tariffs (name, description, min_consumption, max_consumption, price_per_unit, max_units, fixed_charge, order_index, status) VALUES
('BASE', 'Cargo base para consumo hasta 15 m³', 0, 15, 0, NULL, 2.00, 1, 'active'),
('Rango 16-20', 'Consumo entre 16 y 20 m³', 16, 20, 0.20, 5, 0, 2, 'active'),
('Rango 21-25', 'Consumo entre 21 y 25 m³', 21, 25, 0.50, 5, 0, 3, 'active'),
('Rango 26+', 'Consumo de 26 m³ en adelante', 26, NULL, 1.00, NULL, 0, 4, 'active')
ON CONFLICT DO NOTHING;

-- Insertar parámetros de cálculo por defecto
INSERT INTO calculation_params (param_key, param_name, param_value, param_type, description, category) VALUES
('base_tariff', 'Cargo Base', '2', 'number', 'Cargo base fijo para consumo hasta 15 m³', 'tariff'),
('multas_reuniones', 'Multas por Reuniones', '0', 'number', 'Multa por no asistir a reuniones', 'multas'),
('multas_mingas', 'Multas por Mingas', '0', 'number', 'Multa por no asistir a mingas', 'multas'),
('mora_percentage', 'Porcentaje de Mora', '0', 'number', 'Porcentaje de mora aplicado a deudas', 'mora'),
('jardin_enabled', 'Cargo por Jardín Habilitado', 'false', 'boolean', 'Indica si se aplica cargo por jardín', 'jardin'),
('jardin_amount', 'Valor de Jardín', '0', 'number', 'Cargo adicional por jardín', 'jardin')
ON CONFLICT (param_key) DO NOTHING;


