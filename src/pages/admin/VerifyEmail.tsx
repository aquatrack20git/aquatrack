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
      const token = searchParams.get('token');
      const code = searchParams.get('code');
      const type = searchParams.get('type');

      if (!token && !code) {
        setError('No se encontró el token de verificación');
        setVerifying(false);
        return;
      }

      try {
        // Intentar verificar el email usando el token o código
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: token || code || '',
          type: type as any || 'signup'
        });

        if (verifyError) {
          console.error('Error al verificar email:', verifyError);
          if (verifyError.message?.includes('expired')) {
            setError('El enlace de verificación ha expirado. Por favor, solicita un nuevo enlace.');
          } else {
            setError('Error al verificar el email. Por favor, intenta nuevamente.');
          }
          setVerifying(false);
          return;
        }

        // Obtener el usuario después de la verificación
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          console.error('Error al obtener usuario:', userError);
          setError('Error al obtener la información del usuario');
          setVerifying(false);
          return;
        }

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
          setError('Error al actualizar el estado de la cuenta');
          setVerifying(false);
          return;
        }

        setSuccess(true);
        setVerifying(false);
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