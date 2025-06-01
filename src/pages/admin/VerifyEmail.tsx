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
    const verifyEmail = async () => {
      console.log('Iniciando proceso de verificación en VerifyEmail...');
      console.log('URL actual:', window.location.href);

      // Verificar si estamos en la URL de verificación de Supabase
      const isSupabaseVerifyUrl = window.location.href.includes('supabase.co/auth/v1/verify');
      console.log('¿Es URL de verificación de Supabase?', isSupabaseVerifyUrl);

      if (isSupabaseVerifyUrl) {
        try {
          // Extraer parámetros directamente de la URL completa
          const url = new URL(window.location.href);
          const verifyToken = url.searchParams.get('token');
          const type = url.searchParams.get('type');
          const redirectTo = url.searchParams.get('redirect_to');

          console.log('Parámetros extraídos de la URL de Supabase:', {
            token: verifyToken,
            type: type,
            redirectTo: redirectTo,
            fullUrl: window.location.href
          });

          if (!verifyToken) {
            throw new Error('Token de verificación no encontrado');
          }

          if (type !== 'signup') {
            throw new Error('Tipo de verificación inválido');
          }

          await verifyWithToken(verifyToken, redirectTo);
          return;
        } catch (error: any) {
          console.error('Error en proceso de verificación de Supabase:', error);
          setError(error.message || 'Error al verificar el email');
          setVerifying(false);
        }
      }

      // Procesar verificación con parámetros normales
      const token = searchParams.get('token');
      const code = searchParams.get('code');
      const type = searchParams.get('type');

      console.log('Parámetros de verificación de la aplicación:', { token, code, type });

      if (!token && !code) {
        setError('No se encontró el token de verificación');
        setVerifying(false);
        return;
      }

      try {
        // Intentar verificar con el token o código disponible
        await verifyWithToken(token || code || '', null);
      } catch (error: any) {
        console.error('Error en proceso de verificación:', error);
        if (error.message?.includes('expired') || error.message?.includes('invalid')) {
          setError('El enlace de verificación ha expirado o no es válido. Por favor, solicita un nuevo enlace.');
        } else {
          setError(error.message || 'Error al verificar el email');
        }
        setVerifying(false);
      }
    };

    const verifyWithToken = async (tokenOrCode: string, redirectTo: string | null) => {
      console.log('Intentando verificar con código:', tokenOrCode);
      
      try {
        // Intentar intercambiar el código por una sesión
        const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(tokenOrCode);

        if (sessionError) {
          console.error('Error al intercambiar código por sesión:', sessionError);
          if (sessionError.message?.includes('expired') || sessionError.message?.includes('invalid')) {
            throw new Error('El enlace de verificación ha expirado o no es válido. Por favor, solicita un nuevo enlace.');
          }
          throw sessionError;
        }

        console.log('Código intercambiado exitosamente:', sessionData);

        // Obtener el usuario de la sesión
        const user = sessionData.user;
        if (!user) {
          throw new Error('No se pudo obtener la información del usuario');
        }

        console.log('Usuario verificado:', {
          id: user.id,
          email: user.email,
          email_confirmed_at: user.email_confirmed_at
        });

        // Actualizar el estado del usuario en la tabla users
        const { error: updateError } = await supabase
          .from('users')
          .update({ 
            status: 'active',
            email_confirmed_at: new Date().toISOString()
          })
          .eq('id', user.id);

        if (updateError) {
          console.error('Error al actualizar estado del usuario:', updateError);
          throw updateError;
        }

        console.log('Estado del usuario actualizado exitosamente');
        setSuccess(true);
        setVerifying(false);

        // Si hay una URL de redirección específica, usarla
        if (redirectTo) {
          console.log('Redirigiendo a la URL especificada:', redirectTo);
          const redirectUrl = new URL(redirectTo);
          redirectUrl.searchParams.set('verification', 'success');
          console.log('URL final de redirección:', redirectUrl.toString());
          window.location.href = redirectUrl.toString();
        } else {
          // Si no hay URL de redirección, redirigir a login con mensaje de éxito
          console.log('Redirigiendo a login con mensaje de éxito');
          window.location.href = '/admin/login?verification=success';
        }
      } catch (error: any) {
        console.error('Error en proceso de verificación:', error);
        setError(error.message || 'Error al verificar el email');
        setVerifying(false);
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