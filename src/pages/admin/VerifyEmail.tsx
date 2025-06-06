import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Container, Box, Paper, Typography, Button, CircularProgress, Alert } from '@mui/material';
import { supabaseAdmin } from '../../config/supabase';

const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const emailParam = searchParams.get('email');
    
    console.log('Email recibido:', emailParam);

    if (!emailParam) {
      setError('No se encontró el email en el enlace de verificación.');
      setVerifying(false);
      return;
    }

    const decodedEmail = decodeURIComponent(emailParam);
    console.log('Email decodificado:', decodedEmail);

    const activateUser = async () => {
      try {
        // Buscar el usuario en la base de datos usando el cliente administrativo
        console.log('Buscando usuario en la base de datos...');
        const { data: users, error: checkError } = await supabaseAdmin
          .from('users')
          .select('id, email, status, email_confirmed_at')
          .eq('email', decodedEmail)
          .maybeSingle();

        console.log('Resultado de búsqueda:', { users, error: checkError });

        if (checkError) {
          console.error('Error al buscar usuario:', checkError);
          throw new Error('Error al verificar el estado del usuario');
        }

        if (!users) {
          throw new Error('No se encontró una cuenta asociada a este email. Por favor, verifica que el email sea correcto.');
        }

        // Si el usuario ya está activo, no hacer nada
        if (users.status === 'active') {
          console.log('Usuario ya está activo');
          setSuccess(true);
          return;
        }

        // Si el usuario está pendiente, activarlo
        if (users.status === 'pending') {
          console.log('Activando usuario pendiente...');
          const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({
              status: 'active',
              email_confirmed_at: new Date().toISOString(),
              requires_password_change: true
            })
            .eq('id', users.id);

          if (updateError) {
            console.error('Error al actualizar estado del usuario:', updateError);
            throw new Error('Error al activar la cuenta');
          }

          console.log('Usuario activado exitosamente');
          setSuccess(true);
          return;
        }

        // Si el usuario está en otro estado, mostrar error
        throw new Error(`El usuario se encuentra en un estado inválido: ${users.status}`);

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