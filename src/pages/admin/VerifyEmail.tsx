import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Container, Box, Paper, Typography, Button, CircularProgress, Alert } from '@mui/material';
import { supabase } from '../../config/supabase';

const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const emailParam = searchParams.get('email');
    console.log('Email param recibido (raw):', emailParam);
    console.log('Email param recibido (typeof):', typeof emailParam);
    console.log('Email param recibido (length):', emailParam?.length);
    console.log('Email param recibido (char codes):', emailParam?.split('').map(c => c.charCodeAt(0)));

    if (!emailParam) {
      console.error('No se encontró el parámetro email en la URL');
      setError('No se encontró el email en el enlace de verificación.');
      setVerifying(false);
      return;
    }

    const decodedEmail = decodeURIComponent(emailParam);
    console.log('Email decodificado:', decodedEmail);
    console.log('Email decodificado (length):', decodedEmail.length);
    console.log('Email decodificado (char codes):', decodedEmail.split('').map(c => c.charCodeAt(0)));

    const activateUser = async () => {
      try {
        console.log('Iniciando activación de usuario para email:', decodedEmail);

        // Verificar si el usuario existe intentando un sign in
        const { data: signInData, error: signInError } = await supabase.auth.signInWithOtp({
          email: decodedEmail,
          options: {
            shouldCreateUser: false // No crear usuario si no existe
          }
        });

        console.log('Verificación de usuario:', {
          email: decodedEmail,
          resultado: signInData,
          error: signInError
        });

        // Si el error indica que el usuario no existe, lanzar error
        if (signInError?.message?.includes('User not found')) {
          console.error('Usuario no encontrado en auth');
          throw new Error('No se encontró una cuenta de usuario válida. Por favor, contacta al administrador.');
        }

        // Si hay otro tipo de error, lanzarlo
        if (signInError) {
          console.error('Error al verificar usuario:', signInError);
          throw new Error('Error al verificar el usuario en el sistema de autenticación');
        }

        // Obtener el usuario actual
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          console.error('Error al obtener usuario actual:', userError);
          throw new Error('Error al obtener la información del usuario');
        }

        // Buscar el usuario en la tabla users
        const { data: users, error: checkError } = await supabase
          .from('users')
          .select('id, email, status, email_confirmed_at')
          .eq('id', user.id);

        console.log('Búsqueda en tabla users por ID:', {
          userId: user.id,
          usuariosEncontrados: users,
          error: checkError
        });

        if (checkError) {
          console.error('Error al buscar usuario en tabla users:', checkError);
          throw new Error('Error al verificar el estado del usuario');
        }

        if (!users || users.length === 0) {
          // Si no existe en la tabla users, crearlo
          console.log('Usuario no encontrado en tabla users, creando registro...');
          const { error: insertError } = await supabase
            .from('users')
            .insert([{
              id: user.id,
              email: decodedEmail,
              status: 'active',
              email_confirmed_at: new Date().toISOString(),
              requires_password_change: true,
              role: 'user' // Asignar rol por defecto
            }]);

          if (insertError) {
            console.error('Error al crear usuario en tabla users:', insertError);
            throw new Error('Error al crear el registro del usuario');
          }

          console.log('Usuario creado exitosamente en tabla users');
          setSuccess(true);
          return;
        }

        const currentUser = users[0];
        console.log('Estado actual del usuario:', currentUser);

        // Si el usuario ya está activo, no hacer nada
        if (currentUser.status === 'active') {
          console.log('Usuario ya está activo');
          setSuccess(true);
          return;
        }

        // Actualizar el estado del usuario
        const { error: updateError } = await supabase
          .from('users')
          .update({
            status: 'active',
            email_confirmed_at: new Date().toISOString(),
            requires_password_change: true
          })
          .eq('id', currentUser.id);

        if (updateError) {
          console.error('Error al actualizar estado del usuario:', updateError);
          throw new Error('Error al activar la cuenta');
        }

        console.log('Usuario activado exitosamente');
        setSuccess(true);
      } catch (e: any) {
        console.error('Error en activación de usuario:', e);
        setError(e.message || 'Error al activar el usuario.');
      } finally {
        setVerifying(false);
      }
    };

    activateUser();
  }, [searchParams]);

  if (verifying) {
    return (
      <Container component="main" maxWidth="xs">
        <Box sx={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Paper elevation={3} sx={{ padding: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <CircularProgress sx={{ mb: 2 }} />
            <Typography>Verificando tu correo electrónico...</Typography>
          </Paper>
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container component="main" maxWidth="xs">
        <Box sx={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Paper elevation={3} sx={{ padding: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', backgroundColor: '#fff3e0' }}>
            <Typography variant="h6" color="warning.main" gutterBottom>
              Error en la verificación
            </Typography>
            <Typography variant="body1" align="center" gutterBottom>
              {error}
            </Typography>
            <Button variant="outlined" color="primary" sx={{ mt: 2 }} onClick={() => navigate('/admin/login')}>
              Volver al inicio de sesión
            </Button>
          </Paper>
        </Box>
      </Container>
    );
  }

  if (success) {
    return (
      <Container component="main" maxWidth="xs">
        <Box sx={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Paper elevation={3} sx={{ padding: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', backgroundColor: '#e8f5e9' }}>
            <Typography variant="h6" color="success.main" gutterBottom>
              ¡Email verificado exitosamente!
            </Typography>
            <Typography variant="body1" align="center" gutterBottom>
              Tu cuenta ha sido activada correctamente.
            </Typography>
            <Typography variant="body2" align="center" color="text.secondary">
              Ahora puedes iniciar sesión con tus credenciales.
            </Typography>
            <Button variant="contained" color="primary" sx={{ mt: 3 }} onClick={() => navigate('/admin/login')}>
              Ir a Iniciar Sesión
            </Button>
          </Paper>
        </Box>
      </Container>
    );
  }

  return null;
};

export default VerifyEmail; 