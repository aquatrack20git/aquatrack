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

// Crear un objeto de almacenamiento personalizado
const customStorage = {
  getItem: (key: string) => {
    try {
      const value = localStorage.getItem(key);
      console.log('Supabase Storage - Getting item:', { key, hasValue: !!value });
      return value;
    } catch (error) {
      console.error('Supabase Storage - Error getting item:', error);
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      console.log('Supabase Storage - Setting item:', { key, hasValue: !!value });
      localStorage.setItem(key, value);
    } catch (error) {
      console.error('Supabase Storage - Error setting item:', error);
    }
  },
  removeItem: (key: string) => {
    try {
      console.log('Supabase Storage - Removing item:', { key });
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Supabase Storage - Error removing item:', error);
    }
  }
};

console.log('Supabase Config - Creating client');
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: customStorage,
    debug: true,
    storageKey: 'aquatrack-auth-token',
    cookieOptions: {
      name: 'aquatrack-auth',
      lifetime: 60 * 60 * 24 * 7, // 7 días
      domain: window.location.hostname,
      path: '/',
      sameSite: 'lax'
    }
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'x-application-name': 'aquatrack',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  }
});

// Verificar la conexión inicial
supabase.auth.getSession().then(({ data: { session }, error }) => {
  if (error) {
    console.error('Supabase - Error getting initial session:', error);
    return;
  }
  
  console.log('Supabase - Initial session check:', {
    hasSession: !!session,
    user: session?.user?.email,
    expiresAt: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'none'
  });
});

// Suscribirse a cambios de autenticación
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Supabase Auth State Change:', { 
    event, 
    session: session ? {
      user: session.user?.id,
      email: session.user?.email,
      expires_at: session.expires_at,
      expiraEn: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'no expira'
    } : 'none',
    timestamp: new Date().toISOString()
  });

  // Manejar eventos específicos
  switch (event) {
    case 'SIGNED_IN':
      console.log('Supabase - Usuario inició sesión');
      break;
    case 'SIGNED_OUT':
      console.log('Supabase - Usuario cerró sesión');
      // Limpiar el almacenamiento local
      localStorage.removeItem('aquatrack-auth-token');
      break;
    case 'TOKEN_REFRESHED':
      console.log('Supabase - Token refrescado');
      break;
    case 'USER_UPDATED':
      console.log('Supabase - Usuario actualizado');
      break;
  }
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