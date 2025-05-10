import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan las variables de entorno de Supabase')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Configurar políticas de seguridad
export const setupSecurityPolicies = async () => {
  try {
    // Política para la tabla meters
    const { error: metersPolicyError } = await supabase.rpc('create_meters_policy', {
      policy_name: 'Enable read access for authenticated users',
      table_name: 'meters',
      definition: '(auth.role() = \'authenticated\')',
      command: 'SELECT'
    })

    if (metersPolicyError) {
      console.error('Error al crear política para meters:', metersPolicyError)
    }

    // Política para la tabla readings
    const { error: readingsPolicyError } = await supabase.rpc('create_readings_policy', {
      policy_name: 'Enable read access for authenticated users',
      table_name: 'readings',
      definition: '(auth.role() = \'authenticated\')',
      command: 'SELECT'
    })

    if (readingsPolicyError) {
      console.error('Error al crear política para readings:', readingsPolicyError)
    }

    // Política para la tabla users
    const { error: usersPolicyError } = await supabase.rpc('create_users_policy', {
      policy_name: 'Enable read access for authenticated users',
      table_name: 'users',
      definition: '(auth.role() = \'authenticated\')',
      command: 'SELECT'
    })

    if (usersPolicyError) {
      console.error('Error al crear política para users:', usersPolicyError)
    }

  } catch (error) {
    console.error('Error al configurar políticas de seguridad:', error)
  }
}

// Ejecutar la configuración de políticas
setupSecurityPolicies() 