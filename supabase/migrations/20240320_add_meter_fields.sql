-- Agregar nuevos campos a la tabla meters
ALTER TABLE meters
ADD COLUMN identification VARCHAR(20),
ADD COLUMN email VARCHAR(255),
ADD COLUMN contact_number VARCHAR(20);

-- Crear políticas RLS para la tabla meters
DROP POLICY IF EXISTS "Enable read access for all users" ON meters;
CREATE POLICY "Enable read access for all users" ON meters
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON meters;
CREATE POLICY "Enable insert for authenticated users only" ON meters
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable update for authenticated users only" ON meters;
CREATE POLICY "Enable update for authenticated users only" ON meters
    FOR UPDATE
    USING (auth.role() = 'authenticated');

-- Habilitar RLS en la tabla si no está habilitado
ALTER TABLE meters ENABLE ROW LEVEL SECURITY;

-- Comentarios para los nuevos campos
COMMENT ON COLUMN meters.identification IS 'Número de identificación del usuario (DNI, RUC, etc.)';
COMMENT ON COLUMN meters.email IS 'Correo electrónico de contacto del usuario';
COMMENT ON COLUMN meters.contact_number IS 'Número de teléfono de contacto del usuario'; 