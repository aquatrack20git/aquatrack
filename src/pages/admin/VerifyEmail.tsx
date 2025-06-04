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
  const [timeWarning, setTimeWarning] = useState<string | null>(null);

  useEffect(() => {
    // Validar hora local vs servidor
    const checkTimeSync = async () => {
      try {
        const { data, error } = await supabase.rpc('get_server_time');
        if (!error && data) {
          const serverTime = new Date(data);
          const localTime = new Date();
          const diffMs = Math.abs(localTime.getTime() - serverTime.getTime());
          const diffMinutes = diffMs / (1000 * 60);
          if (diffMinutes > 5) {
            setTimeWarning('La hora de tu dispositivo está desincronizada respecto al servidor. Esto puede causar problemas de autenticación. Por favor, revisa la configuración de fecha y hora de tu sistema.');
          }
        }
      } catch (e) {
        // No mostrar advertencia si falla la consulta
      }
    };
    checkTimeSync();

    const verifyByEmail = async () => {
      setVerifying(true);
      setError(null);
      setSuccess(false);
      const email = searchParams.get('email');
      if (!email) {
        setError('No se encontró el email en el enlace de verificación.');
        setVerifying(false);
        return;
      }
      try {
        // Buscar usuario en la tabla users
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('id, status')
          .eq('email', email)
          .maybeSingle();
        if (userError || !user) {
          throw new Error('No se encontró el usuario asociado a este email.');
        }
        if (user.status === 'active') {
          setSuccess(true);
          setVerifying(false);
          return;
        }
        // Actualizar estado a active
        const { error: updateError } = await supabase
          .from('users')
          .update({
            status: 'active',
            email_confirmed_at: new Date().toISOString(),
          })
          .eq('id', user.id);
        if (updateError) {
          throw updateError;
        }
        setSuccess(true);
      } catch (e: any) {
        setError(e.message || 'Error al activar el usuario');
      } finally {
        setVerifying(false);
      }
    };
    verifyByEmail();
  }, [searchParams]);

  if (verifying) {
    return (
      <Container component="main" maxWidth="xs">
        {timeWarning && (
          <Alert severity="warning" sx={{ mt: 4, mb: 2 }}>{timeWarning}</Alert>
        )}
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
        {timeWarning && (
          <Alert severity="warning" sx={{ mt: 4, mb: 2 }}>{timeWarning}</Alert>
        )}
        <Box sx={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Paper elevation={3} sx={{ padding: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', backgroundColor: '#fff3e0' }}>
            <Typography variant="h6" color="warning.main" gutterBottom>Error en la verificación</Typography>
            <Typography variant="body1" align="center" gutterBottom>{error}</Typography>
            <Button variant="outlined" color="primary" sx={{ mt: 2 }} onClick={() => navigate('/admin/login')}>Volver al inicio de sesión</Button>
          </Paper>
        </Box>
      </Container>
    );
  }

  if (success) {
    return (
      <Container component="main" maxWidth="xs">
        {timeWarning && (
          <Alert severity="warning" sx={{ mt: 4, mb: 2 }}>{timeWarning}</Alert>
        )}
        <Box sx={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Paper elevation={3} sx={{ padding: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', backgroundColor: '#e8f5e9' }}>
            <Typography variant="h6" color="success.main" gutterBottom>¡Email verificado exitosamente!</Typography>
            <Typography variant="body1" align="center" gutterBottom>Tu cuenta ha sido activada correctamente.</Typography>
            <Typography variant="body2" align="center" color="text.secondary">Ahora puedes iniciar sesión con tus credenciales.</Typography>
            <Button variant="contained" color="primary" sx={{ mt: 3 }} onClick={() => navigate('/admin/login')}>Ir a Iniciar Sesión</Button>
          </Paper>
        </Box>
      </Container>
    );
  }

  return null;
};

export default VerifyEmail; 