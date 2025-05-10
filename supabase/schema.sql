-- Drop existing tables if they exist
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS readings;
DROP TABLE IF EXISTS meters;

-- Create tables
CREATE TABLE meters (
    code_meter VARCHAR(50) PRIMARY KEY,
    location VARCHAR(255),
    description TEXT,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE TABLE readings (
    id BIGSERIAL PRIMARY KEY,
    meter_id VARCHAR(50) REFERENCES meters(code_meter),
    value INTEGER NOT NULL,
    photo_url TEXT,
    period VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE TABLE comments (
    id BIGSERIAL PRIMARY KEY,
    meter_id_comment VARCHAR(50) REFERENCES meters(code_meter),
    notes TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Drop existing bucket if it exists
DELETE FROM storage.buckets WHERE id = 'meter-photos';

-- Create storage bucket for meter photos
INSERT INTO storage.buckets (id, name, public) VALUES ('meter-photos', 'meter-photos', true);

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access to meter photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public upload access to meter photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public update access to meter photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public delete access to meter photos" ON storage.objects;

-- Storage policies for meter-photos bucket
CREATE POLICY "Allow public read access to meter photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'meter-photos');

CREATE POLICY "Allow public upload access to meter photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'meter-photos');

CREATE POLICY "Allow public update access to meter photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'meter-photos');

CREATE POLICY "Allow public delete access to meter photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'meter-photos');

-- Set up Row Level Security (RLS)
ALTER TABLE meters ENABLE ROW LEVEL SECURITY;
ALTER TABLE readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable read access for all users" ON meters;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON meters;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON meters;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON meters;

DROP POLICY IF EXISTS "Enable read access for all users" ON readings;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON readings;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON readings;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON readings;

DROP POLICY IF EXISTS "Enable read access for all users" ON comments;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON comments;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON comments;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON comments;

-- Create policies
-- Meters policies
CREATE POLICY "Enable read access for all users" ON meters
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON meters
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON meters
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON meters
    FOR DELETE USING (auth.role() = 'authenticated');

-- Readings policies
CREATE POLICY "Enable read access for all users" ON readings
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON readings
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON readings
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON readings
    FOR DELETE USING (auth.role() = 'authenticated');

-- Comments policies
CREATE POLICY "Enable read access for all users" ON comments
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON comments
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON comments
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON comments
    FOR DELETE USING (auth.role() = 'authenticated');

-- Drop existing indexes if they exist
DROP INDEX IF EXISTS idx_readings_meter_id;
DROP INDEX IF EXISTS idx_readings_period;
DROP INDEX IF EXISTS idx_comments_meter_id;
DROP INDEX IF EXISTS idx_meters_status;

-- Create indexes for better performance
CREATE INDEX idx_readings_meter_id ON readings(meter_id);
CREATE INDEX idx_readings_period ON readings(period);
CREATE INDEX idx_comments_meter_id ON comments(meter_id_comment);
CREATE INDEX idx_meters_status ON meters(status);

-- Drop existing function and trigger if they exist
DROP TRIGGER IF EXISTS on_meter_deletion ON meters;
DROP FUNCTION IF EXISTS handle_meter_deletion();

-- Create function to handle meter deletion (cascade delete related records)
CREATE OR REPLACE FUNCTION handle_meter_deletion()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM readings WHERE meter_id = OLD.code_meter;
    DELETE FROM comments WHERE meter_id_comment = OLD.code_meter;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for meter deletion
CREATE TRIGGER on_meter_deletion
    BEFORE DELETE ON meters
    FOR EACH ROW
    EXECUTE FUNCTION handle_meter_deletion(); 