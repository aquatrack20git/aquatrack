import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin

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
  throw new Error('Faltan las variables de entorno de Supabase')
}

console.log('Supabase Config - Creating client');
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: {
      getItem: (key) => {
        try {
          const value = sessionStorage.getItem(key);
          if (value) return JSON.parse(value);
          
          const localValue = localStorage.getItem(key);
          return localValue ? JSON.parse(localValue) : null;
        } catch (error) {
          console.error('Error reading from storage:', error);
          return null;
        }
      },
      setItem: (key, value) => {
        try {
          const stringValue = JSON.stringify(value);
          sessionStorage.setItem(key, stringValue);
          localStorage.setItem(key, stringValue);
        } catch (error) {
          console.error('Error writing to storage:', error);
        }
      },
      removeItem: (key) => {
        try {
          sessionStorage.removeItem(key);
          localStorage.removeItem(key);
        } catch (error) {
          console.error('Error removing from storage:', error);
        }
      }
    }
  }
});

// Configurar políticas de seguridad
export const setupSecurityPolicies = async () => {
  console.log('Supabase Config - Setting up security policies');
  try {
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

    // Política para la tabla users
    console.log('Supabase Config - Creating users policy');
    const { error: usersPolicyError } = await supabase.rpc('create_users_policy', {
      policy_name: 'users_select',
      operation: 'SELECT',
      definition: 'true'
    });

    if (usersPolicyError) {
      console.error('Supabase Config - Error creating users policy:', usersPolicyError);
    }

    console.log('Supabase Config - Security policies setup completed');
  } catch (error) {
    console.error('Supabase Config - Error setting up security policies:', error);
  }
};

// Ejecutar la configuración de políticas
console.log('Supabase Config - Initiating security policies setup');
setupSecurityPolicies(); 