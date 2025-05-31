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
      console.log('Intentando iniciar sesión con:', { email });
      
      // Primero verificar si el usuario existe en la tabla users
      const { data: userData, error: userCheckError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      console.log('Verificación de usuario en tabla users:', { userData, userCheckError });

      if (userCheckError) {
        console.error('Error al verificar usuario:', userCheckError);
        throw new Error('Error al verificar el usuario. Por favor, intenta nuevamente.');
      }

      if (!userData) {
        console.error('Usuario no encontrado en tabla users');
        throw new Error('No existe una cuenta con este correo electrónico. Por favor, contacta al administrador para crear una cuenta.');
      }

      // Verificar el estado del usuario
      if (userData.status === 'pending') {
        console.log('Usuario en estado pending');
        setError('Tu cuenta está pendiente de activación. Por favor, revisa tu correo electrónico para confirmar tu cuenta.');
        return;
      }

      if (userData.status === 'inactive') {
        console.log('Usuario en estado inactive');
        setError('Tu cuenta está inactiva. Por favor, contacta al administrador.');
        return;
      }

      // Si el usuario existe y está activo, intentar login
      console.log('Usuario verificado, intentando login');
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        console.error('Error de autenticación:', authError);
        
        if (authError.message?.includes('Email not confirmed')) {
          setError('Tu correo electrónico no ha sido confirmado. Por favor, revisa tu bandeja de entrada y confirma tu cuenta.');
          return;
        }

        if (authError.message?.includes('Invalid login credentials')) {
          setError('Credenciales inválidas. Por favor, verifica tu correo y contraseña.');
          return;
        }

        throw authError;
      }

      if (!authData.user) {
        throw new Error('Error al obtener la información del usuario');
      }

      console.log('Login completado exitosamente:', {
        userId: authData.user.id,
        status: userData.status,
        emailConfirmed: userData.email_confirmed_at
      });

      // Si todo está bien, navegar al dashboard
      navigate('/admin');
    } catch (error: any) {
      console.error('Error completo en login:', error);
      setError(error.message || 'Error al iniciar sesión. Por favor, intenta nuevamente.');
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
          console.log('Iniciando verificación de email con token:', { token, type });
          
          // Verificar el token
          const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'signup'
          });

          if (verifyError) {
            console.error('Error al verificar email:', verifyError);
            setError('Error al verificar el email. Por favor, intenta nuevamente.');
            return;
          }

          console.log('Token verificado exitosamente:', verifyData);

          // Obtener el usuario actual
          const { data: { user }, error: userError } = await supabase.auth.getUser();
          
          if (userError) {
            console.error('Error al obtener usuario:', userError);
            throw userError;
          }

          if (!user) {
            console.error('No se encontró usuario después de la verificación');
            throw new Error('No se pudo obtener la información del usuario');
          }

          console.log('Usuario obtenido después de verificación:', user);

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

          // Intentar iniciar sesión automáticamente
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: user.email!,
            password: 'Temporal123!' // La contraseña temporal que se estableció al crear el usuario
          });

          if (signInError) {
            console.error('Error al iniciar sesión automáticamente:', signInError);
            setError('');
            // Limpiar la URL después de la verificación exitosa
            window.history.replaceState({}, document.title, '/admin/login');
            alert('Email verificado exitosamente. Por favor, inicia sesión con tus credenciales.');
          } else {
            // Si el inicio de sesión automático fue exitoso, navegar al dashboard
            navigate('/admin');
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
  }, [location, navigate]);

  const handleResendConfirmation = async () => {
    if (!email) {
      setError('Por favor, ingresa tu correo electrónico');
      return;
    }

    setLoading(true);
    try {
      console.log('Reenviando confirmación a:', email);
      
      // Verificar si el usuario existe en la tabla users
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      console.log('Verificación de usuario para reenvío:', { userData, userError });

      if (userError) {
        console.error('Error al verificar usuario para reenvío:', userError);
        throw new Error('Error al verificar el estado de tu cuenta');
      }

      if (!userData) {
        setError('No existe una cuenta con este correo electrónico. Por favor, contacta al administrador para crear una cuenta.');
        return;
      }

      if (userData.status !== 'pending') {
        setError('Tu cuenta ya está activa. Por favor, intenta iniciar sesión.');
        return;
      }

      // Intentar reenviar el email de confirmación
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/admin/login?type=signup`
        }
      });

      if (resendError) {
        console.error('Error al reenviar confirmación:', resendError);
        throw resendError;
      }

      setError('');
      alert('Se ha enviado un nuevo enlace de confirmación a tu correo electrónico. Por favor, revisa tu bandeja de entrada y sigue las instrucciones para activar tu cuenta.');
    } catch (error: any) {
      console.error('Error al reenviar confirmación:', error);
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
                (error.includes('pendiente') || 
                 error.includes('confirmado') || 
                 error.includes('no existe')) && (
                  <Button 
                    color="inherit" 
                    size="small" 
                    onClick={handleResendConfirmation}
                    disabled={loading}
                  >
                    {loading ? 'Enviando...' : 'Reenviar confirmación'}
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