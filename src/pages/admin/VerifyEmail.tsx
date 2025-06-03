import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Container, Box, Paper, Typography, Button, CircularProgress } from '@mui/material';
import { supabase } from '../../config/supabase';

const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const verifyEmail = async () => {
      console.log('Iniciando proceso de verificación en VerifyEmail...');
      console.log('URL actual:', window.location.href);

      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      const verifyToken = url.searchParams.get('token');
      const type = url.searchParams.get('type');
      const redirectTo = url.searchParams.get('redirect_to');

      console.log('Parámetros extraídos de la URL:', {
        code,
        token: verifyToken,
        type,
        redirectTo,
        fullUrl: window.location.href
      });

      if (code) {
        // Flujo estándar de Supabase con code
        try {
          const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
          if (sessionError) {
            console.error('Error al intercambiar código por sesión:', sessionError);
            if (sessionError.message?.includes('expired') || sessionError.message?.includes('invalid')) {
              throw new Error('El enlace de verificación ha expirado o no es válido. Por favor, solicita un nuevo enlace.');
            }
            throw sessionError;
          }
          console.log('Código intercambiado exitosamente:', sessionData);
          const user = sessionData.user;
          if (!user) {
            throw new Error('No se pudo obtener la información del usuario');
          }
          await updateUserStatus(user.id, null);
        } catch (error: any) {
          console.error('Error en proceso de verificación (code):', error);
          setError(error.message || 'Error al verificar el email');
          setVerifying(false);
        }
        return;
      }

      if (verifyToken && type) {
        // Flujo alternativo con token y type
        try {
          const { data, error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: verifyToken,
            type: type as any
          });
          if (verifyError) {
            console.error('Error al verificar token PKCE:', verifyError);
            throw verifyError;
          }
          console.log('Token PKCE verificado exitosamente:', data);
          const { data: { user }, error: userError } = await supabase.auth.getUser();
          if (userError || !user) {
            console.error('Error al obtener usuario:', userError);
            throw new Error('Error al obtener la información del usuario');
          }
          await updateUserStatus(user.id, redirectTo);
        } catch (error: any) {
          console.error('Error en proceso de verificación (token):', error);
          setError(error.message || 'Error al verificar el email');
          setVerifying(false);
        }
        return;
      }

      // Si no hay parámetros válidos
      setError('El enlace de verificación no es válido o le faltan parámetros. Por favor, solicita un nuevo enlace.');
      setVerifying(false);
    };

    const updateUserStatus = async (userId: string, redirectTo: string | null) => {
      console.log('Actualizando estado del usuario:', userId);
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          status: 'active',
          email_confirmed_at: new Date().toISOString()
        })
        .eq('id', userId);
      if (updateError) {
        console.error('Error al actualizar estado del usuario:', updateError);
        throw updateError;
      }
      console.log('Estado del usuario actualizado exitosamente');
      setSuccess(true);
      setVerifying(false);
      if (redirectTo) {
        console.log('Redirigiendo a la URL especificada:', redirectTo);
        const redirectUrl = new URL(redirectTo);
        redirectUrl.searchParams.set('verification', 'success');
        console.log('URL final de redirección:', redirectUrl.toString());
        window.location.href = redirectUrl.toString();
      } else {
        console.log('Redirigiendo a login con mensaje de éxito');
        window.location.href = '/admin/login?verification=success';
      }
    };

    verifyEmail();
  }, [searchParams]);

  if (verifying) {
    return (
      <Container component="main" maxWidth="xs">
        <Box
          sx={{
            marginTop: 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Paper
            elevation={3}
            sx={{
              padding: 4,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '100%',
            }}
          >
            <CircularProgress sx={{ mb: 2 }} />
            <Typography>
              Verificando tu correo electrónico...
            </Typography>
          </Paper>
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container component="main" maxWidth="xs">
        <Box
          sx={{
            marginTop: 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Paper
            elevation={3}
            sx={{
              padding: 4,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '100%',
              backgroundColor: '#fff3e0',
            }}
          >
            <Typography variant="h6" color="warning.main" gutterBottom>
              Error en la verificación
            </Typography>
            <Typography variant="body1" align="center" gutterBottom>
              {error}
            </Typography>
            <Button
              variant="outlined"
              color="primary"
              sx={{ mt: 2 }}
              onClick={() => navigate('/admin/login')}
            >
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
        <Box
          sx={{
            marginTop: 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Paper
            elevation={3}
            sx={{
              padding: 4,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '100%',
              backgroundColor: '#e8f5e9',
            }}
          >
            <Typography variant="h6" color="success.main" gutterBottom>
              ¡Email verificado exitosamente!
            </Typography>
            <Typography variant="body1" align="center" gutterBottom>
              Tu cuenta ha sido activada correctamente.
            </Typography>
            <Typography variant="body2" align="center" color="text.secondary">
              Ahora puedes iniciar sesión con tus credenciales.
            </Typography>
            <Button
              variant="contained"
              color="primary"
              sx={{ mt: 3 }}
              onClick={() => navigate('/admin/login')}
            >
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