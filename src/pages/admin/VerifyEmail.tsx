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
    const code = searchParams.get('code');
    const emailParam = searchParams.get('email');
    console.log('Parámetros recibidos:', { code, emailParam });

    if (!code || !emailParam) {
      console.error('Faltan parámetros requeridos:', { code, emailParam });
      setError('El enlace de verificación es inválido. Faltan parámetros requeridos.');
      setVerifying(false);
      return;
    }

    const decodedEmail = decodeURIComponent(emailParam);
    console.log('Email decodificado:', decodedEmail);

    const verifyAndActivateUser = async () => {
      try {
        console.log('Iniciando verificación con Supabase...');
        
        // Primero verificar el código con Supabase
        const { error: verifyError } = await supabase.auth.verifyOtp({
          email: decodedEmail,
          token: code,
          type: 'signup'
        });

        if (verifyError) {
          console.error('Error en verificación OTP:', verifyError);
          throw new Error('El código de verificación es inválido o ha expirado.');
        }

        console.log('Código verificado exitosamente, buscando usuario...');

        // Buscar el usuario por email
        const { data: users, error: checkError } = await supabase
          .from('users')
          .select('id, email, status, email_confirmed_at')
          .eq('email', decodedEmail);

        console.log('Resultado de búsqueda:', {
          emailBuscado: decodedEmail,
          usuariosEncontrados: users,
          error: checkError
        });

        if (checkError) {
          console.error('Error al buscar usuario:', checkError);
          throw new Error('Error al verificar el usuario');
        }

        if (!users || users.length === 0) {
          console.error('No se encontró usuario con el email:', decodedEmail);
          throw new Error('No se encontró una cuenta asociada a este email.');
        }

        if (users.length > 1) {
          console.error('Se encontraron múltiples usuarios con el mismo email:', {
            email: decodedEmail,
            usuarios: users
          });
          throw new Error('Error: Se encontraron múltiples cuentas con este email. Por favor, contacta al administrador.');
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
        console.error('Error en proceso de verificación:', e);
        setError(e.message || 'Error al verificar el usuario.');
      } finally {
        setVerifying(false);
      }
    };

    verifyAndActivateUser();
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