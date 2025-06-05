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
      try {
        const emailParam = searchParams.get('email');
        const codeParam = searchParams.get('code');

        console.log('VerifyEmail - Iniciando verificación:', {
          email: emailParam,
          hasCode: !!codeParam,
          timestamp: new Date().toISOString()
        });

        if (!emailParam || !codeParam) {
          throw new Error('Faltan parámetros necesarios para la verificación.');
        }

        const decodedEmail = decodeURIComponent(emailParam);

        // Primero verificar si el usuario existe en auth.users
        const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
        
        console.log('VerifyEmail - Búsqueda en auth.users:', {
          foundUsers: users?.length,
          hasError: !!authError,
          error: authError
        });

        if (authError) {
          throw new Error('Error al verificar el usuario en auth.users');
        }

        const userExists = users?.some(user => user.email === decodedEmail);
        
        if (!userExists) {
          console.error('VerifyEmail - Usuario no encontrado en auth.users:', decodedEmail);
          throw new Error('No se encontró una cuenta asociada a este email. Por favor, verifica que el email sea correcto.');
        }

        // Verificar el código de verificación
        const { error: verifyError } = await supabase.auth.verifyOtp({
          email: decodedEmail,
          token: codeParam,
          type: 'email'
        });

        console.log('VerifyEmail - Resultado de verificación OTP:', {
          hasError: !!verifyError,
          error: verifyError
        });

        if (verifyError) {
          throw verifyError;
        }

        // Actualizar el estado del usuario en la tabla users
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, status')
          .eq('email', decodedEmail)
          .single();

        console.log('VerifyEmail - Estado actual del usuario:', {
          hasData: !!userData,
          status: userData?.status,
          hasError: !!userError,
          error: userError
        });

        if (userError) {
          console.error('VerifyEmail - Error al obtener usuario:', userError);
          throw new Error('Error al verificar el estado del usuario');
        }

        if (!userData) {
          // Si el usuario no existe en la tabla users, crearlo
          const { error: insertError } = await supabase
            .from('users')
            .insert([{
              email: decodedEmail,
              status: 'active',
              role: 'user'
            }]);

          if (insertError) {
            console.error('VerifyEmail - Error al crear usuario:', insertError);
            throw new Error('Error al crear el registro del usuario');
          }
        } else if (userData.status !== 'active') {
          // Actualizar el estado del usuario a activo
          const { error: updateError } = await supabase
            .from('users')
            .update({ status: 'active' })
            .eq('email', decodedEmail);

          if (updateError) {
            console.error('VerifyEmail - Error al actualizar estado:', updateError);
            throw new Error('Error al activar la cuenta del usuario');
          }
        }

        console.log('VerifyEmail - Verificación exitosa');
        setSuccess(true);
        setVerifying(false);

        // Redirigir al login después de 3 segundos
        setTimeout(() => {
          navigate('/admin/login?verification=success');
        }, 3000);

      } catch (error: any) {
        console.error('VerifyEmail - Error en verificación:', error);
        setError(error.message || 'Error al verificar el email');
        setVerifying(false);
      }
    };

    verifyEmail();
  }, [searchParams, navigate]);

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
        <Box sx={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Paper elevation={3} sx={{ padding: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', backgroundColor: '#e8f5e9' }}>
            <Typography variant="h6" color="success.main" gutterBottom>
              ¡Email verificado exitosamente!
            </Typography>
            <Typography variant="body1" align="center" gutterBottom>
              Tu cuenta ha sido activada. Serás redirigido al inicio de sesión en unos segundos...
            </Typography>
            <CircularProgress size={24} sx={{ mt: 2 }} />
          </Paper>
        </Box>
      </Container>
    );
  }

  return null;
};

export default VerifyEmail; 