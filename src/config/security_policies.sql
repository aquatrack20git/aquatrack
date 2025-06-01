-- Eliminar tablas existentes en orden correcto
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS readings CASCADE;
DROP TABLE IF EXISTS meters CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Crear las tablas en orden correcto
CREATE TABLE meters (
    code_meter VARCHAR(50) PRIMARY KEY,
    location TEXT,
    description TEXT,
    status VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE readings (
    id SERIAL PRIMARY KEY,
    meter_id VARCHAR(50) REFERENCES meters(code_meter),
    value NUMERIC,
    photo_url TEXT,
    period TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE comments (
    id SERIAL PRIMARY KEY,
    meter_id_comment VARCHAR(50) REFERENCES meters(code_meter),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    email VARCHAR(255),
    full_name VARCHAR(255),
    role VARCHAR(20),
    status VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Otorgar permisos necesarios
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;

-- Función para crear políticas de seguridad
CREATE OR REPLACE FUNCTION create_meters_policy(
    policy_name text,
    table_name text,
    definition text,
    operation text
) RETURNS void AS $$
BEGIN
    -- Eliminar política existente si existe
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_name, table_name);
    
    -- Crear nueva política
    IF operation = 'INSERT' THEN
        EXECUTE format('CREATE POLICY %I ON %I FOR %s TO authenticated WITH CHECK (%s)',
            policy_name,
            table_name,
            operation,
            definition
        );
    ELSE
        EXECUTE format('CREATE POLICY %I ON %I FOR %s TO authenticated USING (%s)',
            policy_name,
            table_name,
            operation,
            definition
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para crear políticas de seguridad para readings
CREATE OR REPLACE FUNCTION create_readings_policy(
    policy_name text,
    operation text,
    definition text
) RETURNS void AS $$
BEGIN
    -- Eliminar política existente si existe
    EXECUTE format('DROP POLICY IF EXISTS %I ON readings', policy_name);

    -- Crear nueva política
    IF operation = 'INSERT' THEN
        EXECUTE format('
            CREATE POLICY %I ON readings
            FOR %s
            TO authenticated
            WITH CHECK (%s)
        ', policy_name, operation, definition);
    ELSE
        EXECUTE format('
            CREATE POLICY %I ON readings
            FOR %s
            TO authenticated
            USING (%s)
        ', policy_name, operation, definition);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para crear políticas de seguridad para users
CREATE OR REPLACE FUNCTION create_users_policy(
    policy_name text,
    definition text,
    operation text
) RETURNS void AS $$
BEGIN
    -- Eliminar política existente si existe
    EXECUTE format('DROP POLICY IF EXISTS %I ON users', policy_name);

    -- Crear nueva política
    IF operation = 'INSERT' THEN
        EXECUTE format('
            CREATE POLICY %I ON users
            FOR %s
            TO authenticated
            WITH CHECK (%s)
        ', policy_name, operation, definition);
    ELSE
        EXECUTE format('
            CREATE POLICY %I ON users
            FOR %s
            TO authenticated
            USING (%s)
        ', policy_name, operation, definition);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Habilitar RLS en las tablas
ALTER TABLE meters ENABLE ROW LEVEL SECURITY;
ALTER TABLE readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Crear políticas básicas para todas las tablas
DO $$ 
BEGIN
    -- Políticas para users - Acceso público para SELECT
    DROP POLICY IF EXISTS users_select ON users;
    CREATE POLICY users_select ON users
        FOR SELECT
        TO public
        USING (true);

    DROP POLICY IF EXISTS users_insert ON users;
    CREATE POLICY users_insert ON users
        FOR INSERT
        TO authenticated
        WITH CHECK (true);

    DROP POLICY IF EXISTS users_update ON users;
    CREATE POLICY users_update ON users
        FOR UPDATE
        TO authenticated
        USING (true)
        WITH CHECK (true);

    DROP POLICY IF EXISTS users_delete ON users;
    CREATE POLICY users_delete ON users
        FOR DELETE
        TO authenticated
        USING (true);

    -- Políticas para meters
    DROP POLICY IF EXISTS meters_select ON meters;
    CREATE POLICY meters_select ON meters
        FOR SELECT
        TO authenticated
        USING (true);

    DROP POLICY IF EXISTS meters_insert ON meters;
    CREATE POLICY meters_insert ON meters
        FOR INSERT
        TO authenticated
        WITH CHECK (true);

    DROP POLICY IF EXISTS meters_update ON meters;
    CREATE POLICY meters_update ON meters
        FOR UPDATE
        TO authenticated
        USING (true)
        WITH CHECK (true);

    DROP POLICY IF EXISTS meters_delete ON meters;
    CREATE POLICY meters_delete ON meters
        FOR DELETE
        TO authenticated
        USING (true);

    -- Políticas para readings
    DROP POLICY IF EXISTS readings_select ON readings;
    CREATE POLICY readings_select ON readings
        FOR SELECT
        TO authenticated
        USING (true);

    DROP POLICY IF EXISTS readings_insert ON readings;
    CREATE POLICY readings_insert ON readings
        FOR INSERT
        TO authenticated
        WITH CHECK (true);

    DROP POLICY IF EXISTS readings_update ON readings;
    CREATE POLICY readings_update ON readings
        FOR UPDATE
        TO authenticated
        USING (true)
        WITH CHECK (true);

    DROP POLICY IF EXISTS readings_delete ON readings;
    CREATE POLICY readings_delete ON readings
        FOR DELETE
        TO authenticated
        USING (true);

    -- Políticas para comments
    DROP POLICY IF EXISTS comments_select ON comments;
    CREATE POLICY comments_select ON comments
        FOR SELECT
        TO authenticated
        USING (true);

    DROP POLICY IF EXISTS comments_insert ON comments;
    CREATE POLICY comments_insert ON comments
        FOR INSERT
        TO authenticated
        WITH CHECK (true);

    DROP POLICY IF EXISTS comments_update ON comments;
    CREATE POLICY comments_update ON comments
        FOR UPDATE
        TO authenticated
        USING (true)
        WITH CHECK (true);

    DROP POLICY IF EXISTS comments_delete ON comments;
    CREATE POLICY comments_delete ON comments
        FOR DELETE
        TO authenticated
        USING (true);
END $$; 