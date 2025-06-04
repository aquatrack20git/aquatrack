import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Container, Box, Paper, Typography, Button, CircularProgress, Alert, TextField } from '@mui/material';
import { supabase } from '../../config/supabase';

const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [resendStatus, setResendStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [resendMessage, setResendMessage] = useState('');
  const [timeWarning, setTimeWarning] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      setError('El enlace de verificación no es válido o le faltan parámetros. Por favor, solicita un nuevo enlace.');
      setVerifying(false);
      return;
    }

    const activateUser = async () => {
      try {
        // Intercambiar el code por una sesión
        const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
        if (sessionError) {
          throw new Error('El enlace de verificación ha expirado o no es válido. Por favor, solicita un nuevo enlace.');
        }
        const user = sessionData.user;
        if (!user || !user.id) {
          throw new Error('No se pudo obtener la información del usuario.');
        }
        // Actualizar el estado usando el id
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
        setError(e.message || 'Error al activar el usuario.');
      } finally {
        setVerifying(false);
      }
    };
    activateUser();
  }, [searchParams]);

  const handleResend = async () => {
    setResendStatus('loading');
    setResendMessage('');
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: resendEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/admin/verify-email`,
        },
      });
      if (error) {
        setResendStatus('error');
        setResendMessage(error.message || 'Error al reenviar el correo de verificación');
      } else {
        setResendStatus('success');
        setResendMessage('Correo de verificación reenviado exitosamente. Revisa tu bandeja de entrada.');
      }
    } catch (e: any) {
      setResendStatus('error');
      setResendMessage(e.message || 'Error al reenviar el correo de verificación');
    }
  };

  if (verifying) {
    return (
      <Container component="main" maxWidth="xs">
        {timeWarning && (
          <Alert severity="warning" sx={{ mt: 4, mb: 2 }}>
            {timeWarning}
          </Alert>
        )}
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
        {timeWarning && (
          <Alert severity="warning" sx={{ mt: 4, mb: 2 }}>
            {timeWarning}
          </Alert>
        )}
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
            <Box sx={{ mt: 3, width: '100%' }}>
              <Typography variant="body2" align="center" gutterBottom>
                ¿No recibiste el correo o el enlace expiró? Ingresa tu email para reenviar el correo de verificación:
              </Typography>
              <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                <TextField
                  label="Email"
                  type="email"
                  value={resendEmail}
                  onChange={e => setResendEmail(e.target.value)}
                  size="small"
                  fullWidth
                  sx={{ mt: 1 }}
                />
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleResend}
                  disabled={resendStatus === 'loading' || !resendEmail}
                >
                  {resendStatus === 'loading' ? 'Enviando...' : 'Reenviar correo de verificación'}
                </Button>
                {resendStatus !== 'idle' && (
                  <Alert severity={resendStatus === 'success' ? 'success' : 'error'} sx={{ mt: 1 }}>
                    {resendMessage}
                  </Alert>
                )}
              </Box>
            </Box>
          </Paper>
        </Box>
      </Container>
    );
  }

  if (success) {
    return (
      <Container component="main" maxWidth="xs">
        {timeWarning && (
          <Alert severity="warning" sx={{ mt: 4, mb: 2 }}>
            {timeWarning}
          </Alert>
        )}
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