import { supabase } from './supabase';

const setupAdmin = async () => {
  try {
    // Intentar iniciar sesión primero
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'admin@aquatrack.com',
      password: 'Admin123!',
    });

    if (authError) {
      // Si el usuario no existe, crearlo
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: 'admin@aquatrack.com',
        password: 'Admin123!',
        options: {
          emailRedirectTo: `${window.location.origin}/admin/login`,
        },
      });

      if (signUpError) throw signUpError;

      // Crear el registro en la tabla de usuarios
      const { error: userError } = await supabase
        .from('users')
        .insert([
          {
            id: signUpData.user?.id,
            email: 'admin@aquatrack.com',
            full_name: 'Administrador',
            role: 'admin',
            status: 'active',
          },
        ]);

      if (userError) throw userError;

      throw new Error('Por favor, revisa tu correo electrónico para confirmar tu cuenta.');
    }

    // Si el usuario existe, verificar si está en la tabla de usuarios
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'admin@aquatrack.com')
      .single();

    if (userError || !userData) {
      // Si no está en la tabla de usuarios, crearlo
      const { error: insertError } = await supabase
        .from('users')
        .insert([
          {
            id: authData.user?.id,
            email: 'admin@aquatrack.com',
            full_name: 'Administrador',
            role: 'admin',
            status: 'active',
          },
        ]);

      if (insertError) throw insertError;
    }

    return { success: true, message: 'Usuario administrador configurado exitosamente' };
  } catch (error: any) {
    console.error('Error al configurar el usuario administrador:', error);
    throw new Error(error.message || 'Error al configurar el usuario administrador');
  }
};

export default setupAdmin; 