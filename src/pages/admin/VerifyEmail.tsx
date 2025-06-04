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

        // Primero intentar buscar el usuario directamente
        const { data: directUser, error: directError } = await supabase
          .from('users')
          .select('id, email, status, email_confirmed_at')
          .eq('email', decodedEmail)
          .maybeSingle();

        console.log('Búsqueda directa:', {
          emailBuscado: decodedEmail,
          resultado: directUser,
          error: directError
        });

        // Si no se encuentra, intentar con una búsqueda más flexible
        if (!directUser) {
          console.log('Intentando búsqueda alternativa...');
          const { data: users, error: checkError } = await supabase
            .from('users')
            .select('id, email, status, email_confirmed_at')
            .ilike('email', decodedEmail);

          console.log('Búsqueda alternativa:', {
            emailBuscado: decodedEmail,
            usuariosEncontrados: users,
            error: checkError
          });

          if (checkError) {
            console.error('Error en búsqueda alternativa:', checkError);
            throw new Error('Error al verificar el usuario');
          }

          if (!users || users.length === 0) {
            // Último intento: buscar sin decodificar
            console.log('Intentando búsqueda con email sin decodificar...');
            const { data: rawUsers, error: rawError } = await supabase
              .from('users')
              .select('id, email, status, email_confirmed_at')
              .eq('email', emailParam);

            console.log('Búsqueda con email sin decodificar:', {
              emailBuscado: emailParam,
              usuariosEncontrados: rawUsers,
              error: rawError
            });

            if (rawError) {
              console.error('Error en búsqueda con email sin decodificar:', rawError);
              throw new Error('Error al verificar el usuario');
            }

            if (!rawUsers || rawUsers.length === 0) {
              console.error('No se encontró usuario con ningún método de búsqueda');
              throw new Error('No se encontró una cuenta asociada a este email. Por favor, verifica que el email sea correcto.');
            }

            if (rawUsers.length > 1) {
              console.error('Se encontraron múltiples usuarios con el email sin decodificar');
              throw new Error('Error: Se encontraron múltiples cuentas con este email. Por favor, contacta al administrador.');
            }

            // Usar el usuario encontrado con email sin decodificar
            const currentUser = rawUsers[0];
            await updateUserStatus(currentUser.id);
            return;
          }

          if (users.length > 1) {
            console.error('Se encontraron múltiples usuarios en la búsqueda alternativa');
            throw new Error('Error: Se encontraron múltiples cuentas con este email. Por favor, contacta al administrador.');
          }

          // Usar el usuario encontrado en la búsqueda alternativa
          const currentUser = users[0];
          await updateUserStatus(currentUser.id);
          return;
        }

        // Si se encontró el usuario directamente, actualizarlo
        await updateUserStatus(directUser.id);

      } catch (e: any) {
        console.error('Error en activación de usuario:', e);
        setError(e.message || 'Error al activar el usuario.');
      } finally {
        setVerifying(false);
      }
    };

    const updateUserStatus = async (userId: string) => {
      console.log('Actualizando estado del usuario:', userId);
      
      const { error: updateError } = await supabase
        .from('users')
        .update({
          status: 'active',
          email_confirmed_at: new Date().toISOString(),
          requires_password_change: true
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Error al actualizar estado del usuario:', updateError);
        throw new Error('Error al activar la cuenta');
      }

      console.log('Usuario activado exitosamente');
      setSuccess(true);
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