import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const siteUrl = import.meta.env.VITE_SITE_URL || 'https://aquatrackapp.vercel.app'

console.log('Supabase Config - Checking environment variables:', {
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseAnonKey,
  hasSiteUrl: !!siteUrl,
  urlLength: supabaseUrl?.length,
  keyLength: supabaseAnonKey?.length,
  siteUrl
});

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase Config - Missing environment variables:', {
    url: supabaseUrl ? 'present' : 'missing',
    key: supabaseAnonKey ? 'present' : 'missing',
    siteUrl
  });
  throw new Error('Missing Supabase environment variables');
}

console.log('Supabase Config - Creating client');
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storageKey: 'aquatrack-auth-token',
    storage: window.localStorage,
    debug: true // Habilitar logs de depuración
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'x-application-name': 'aquatrack'
    }
  }
});

// Verificar la conexión inicial y el estado de autenticación
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Supabase Auth State Change:', { 
    event, 
    session: session ? {
      user: session.user?.id,
      email: session.user?.email,
      expires_at: session.expires_at
    } : 'none',
    timestamp: new Date().toISOString()
  });
});

// Configurar políticas de seguridad
export const setupSecurityPolicies = async () => {
  console.log('Supabase Config - Setting up security policies');
  try {
    // Política para la tabla users - Permitir acceso público para SELECT
    console.log('Supabase Config - Creating users policy');
    const { error: usersPolicyError } = await supabase.rpc('create_users_policy', {
      policy_name: 'users_select',
      operation: 'SELECT',
      definition: 'true'  // Permitir acceso público para consultas
    });

    if (usersPolicyError) {
      console.error('Supabase Config - Error creating users policy:', usersPolicyError);
    }

    // Política para la tabla meters
    console.log('Supabase Config - Creating meters policy');
    const { error: metersPolicyError } = await supabase.rpc('create_meters_policy', {
      policy_name: 'meters_select',
      table_name: 'meters',
      definition: 'true',
      operation: 'SELECT'
    });

    if (metersPolicyError) {
      console.error('Supabase Config - Error creating meters policy:', metersPolicyError);
    }

    // Política para la tabla readings
    console.log('Supabase Config - Creating readings policy');
    const { error: readingsPolicyError } = await supabase.rpc('create_readings_policy', {
      policy_name: 'readings_select',
      operation: 'SELECT',
      definition: 'true'
    });

    if (readingsPolicyError) {
      console.error('Supabase Config - Error creating readings policy:', readingsPolicyError);
    }

    console.log('Supabase Config - Security policies setup completed');
  } catch (error) {
    console.error('Supabase Config - Error setting up security policies:', error);
  }
};

// Ejecutar la configuración de políticas
console.log('Supabase Config - Initiating security policies setup');
setupSecurityPolicies(); 

// Función helper para obtener la URL de redirección
export const getRedirectUrl = () => `${siteUrl}/admin/verify-email`; 