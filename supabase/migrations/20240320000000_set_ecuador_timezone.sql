-- Configurar la zona horaria de Ecuador para la base de datos
ALTER DATABASE postgres SET timezone TO 'America/Guayaquil';

-- Configurar la zona horaria para la sesión actual
SET timezone TO 'America/Guayaquil';

-- Verificar la configuración
SHOW timezone;

-- Asegurarse de que las columnas timestamp usen la zona horaria correcta
ALTER TABLE meters 
ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE readings 
ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE comments 
ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP; 