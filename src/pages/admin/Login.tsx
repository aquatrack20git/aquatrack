import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Container,
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../config/supabase';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Intentar iniciar sesión directamente
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (loginError) {
        if (loginError.message?.includes('Email not confirmed')) {
          setError('Tu correo electrónico no ha sido confirmado. Por favor, revisa tu bandeja de entrada y confirma tu cuenta.');
        } else if (loginError.message?.includes('Invalid login credentials')) {
          setError('Credenciales inválidas. Por favor, verifica tu correo y contraseña.');
        } else {
          throw loginError;
        }
        return;
      }

      if (data?.user) {
        // Verificar el estado del usuario en la tabla users
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('status')
          .eq('id', data.user.id)
          .single();

        if (userError) {
          console.error('Error al verificar estado del usuario:', userError);
          throw new Error('Error al verificar el estado de tu cuenta');
        }

        if (userData?.status === 'pending') {
          setError('Tu cuenta está pendiente de activación. Por favor, revisa tu correo electrónico para confirmar tu cuenta.');
          return;
        }

        if (userData?.status === 'inactive') {
          setError('Tu cuenta está inactiva. Por favor, contacta al administrador.');
          return;
        }

        // Si todo está bien, navegar al dashboard
        navigate('/admin');
      }
    } catch (error: any) {
      console.error('Error en login:', error);
      setError(error.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const verifyEmail = async () => {
      const params = new URLSearchParams(location.search);
      const token = params.get('token');
      const type = params.get('type');
      const errorCode = params.get('error_code');
      const errorDescription = params.get('error_description');

      if (token && type === 'signup') {
        setVerifying(true);
        try {
          // Verificar el token
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'signup'
          });

          if (verifyError) {
            console.error('Error al verificar email:', verifyError);
            setError('Error al verificar el email. Por favor, intenta nuevamente.');
          } else {
            // Actualizar el estado del usuario en la tabla users
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            
            if (userError) {
              console.error('Error al obtener usuario:', userError);
              throw userError;
            }

            if (user) {
              const { error: updateError } = await supabase
                .from('users')
                .update({ status: 'active' })
                .eq('id', user.id);

              if (updateError) {
                console.error('Error al actualizar estado del usuario:', updateError);
                throw updateError;
              }
            }

            setError('');
            // Limpiar la URL después de la verificación exitosa
            window.history.replaceState({}, document.title, '/admin/login');
            alert('Email verificado exitosamente. Ahora puedes iniciar sesión.');
          }
        } catch (error: any) {
          console.error('Error en verificación:', error);
          setError('Error al verificar el email. Por favor, intenta nuevamente.');
        } finally {
          setVerifying(false);
        }
      } else if (errorCode === 'otp_expired') {
        setError('El enlace de confirmación ha expirado. Por favor, solicita un nuevo enlace de confirmación.');
        window.history.replaceState({}, document.title, '/admin/login');
      } else if (errorCode) {
        setError(decodeURIComponent(errorDescription || 'Error al confirmar el email'));
        window.history.replaceState({}, document.title, '/admin/login');
      }
    };

    verifyEmail();
  }, [location]);

  const handleResendConfirmation = async () => {
    if (!email) {
      setError('Por favor, ingresa tu correo electrónico');
      return;
    }

    setLoading(true);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/admin/login`
        }
      });

      if (resendError) throw resendError;

      setError('');
      alert('Se ha enviado un nuevo enlace de confirmación a tu correo electrónico.');
    } catch (error: any) {
      setError(error.message || 'Error al reenviar el enlace de confirmación');
    } finally {
      setLoading(false);
    }
  };

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
          <Typography component="h1" variant="h5" gutterBottom>
            AquaTrack Admin
          </Typography>
          <Typography component="h2" variant="h6" gutterBottom>
            Iniciar Sesión
          </Typography>

          {error && (
            <Alert 
              severity="error" 
              sx={{ width: '100%', mb: 2 }}
              action={
                error.includes('confirmado') && (
                  <Button color="inherit" size="small" onClick={handleResendConfirmation}>
                    Reenviar confirmación
                  </Button>
                )
              }
            >
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit} style={{ width: '100%' }}>
            <TextField
              margin="normal"
              required
              fullWidth
              label="Correo electrónico"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              label="Contraseña"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Iniciar Sesión'}
            </Button>
          </form>
        </Paper>
      </Box>
    </Container>
  );
};

export default Login; 