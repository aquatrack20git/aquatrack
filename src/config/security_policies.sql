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
$$ LANGUAGE plpgsql;

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

-- Crear políticas para meters
SELECT create_meters_policy('meters_select', 'meters', 'true', 'SELECT');
SELECT create_meters_policy('meters_insert', 'meters', 'true', 'INSERT');
SELECT create_meters_policy('meters_update', 'meters', 'true', 'UPDATE');
SELECT create_meters_policy('meters_delete', 'meters', 'true', 'DELETE');

-- Crear políticas para readings
SELECT create_readings_policy('readings_select', 'SELECT', 'true');
SELECT create_readings_policy('readings_insert', 'INSERT', 'true');
SELECT create_readings_policy('readings_update', 'UPDATE', 'true');
SELECT create_readings_policy('readings_delete', 'DELETE', 'true');

-- Crear políticas para users
SELECT create_users_policy('users_select', 'true', 'SELECT');
SELECT create_users_policy('users_insert', 'true', 'INSERT');
SELECT create_users_policy('users_update', 'true', 'UPDATE');
SELECT create_users_policy('users_delete', 'true', 'DELETE'); 