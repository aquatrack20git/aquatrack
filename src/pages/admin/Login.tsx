import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();

  // Verificar si ya hay una sesión activa
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Error al verificar sesión:', sessionError);
          return;
        }

        if (session && isAuthenticated) {
          console.log('Sesión activa encontrada, redirigiendo al dashboard');
          navigate('/admin/dashboard');
        }
      } catch (error) {
        console.error('Error en verificación de sesión:', error);
      }
    };

    checkSession();
  }, [navigate, isAuthenticated]);

  useEffect(() => {
    // Verificar si hay un mensaje de verificación exitosa
    const verificationStatus = searchParams.get('verification');
    if (verificationStatus === 'success') {
      setError('Email verificado exitosamente. Por favor, inicia sesión.');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Limpiar el email de espacios en blanco
      const cleanEmail = email.trim().toLowerCase();
      console.log('Iniciando proceso de login para:', cleanEmail);
      
      // Intentar el login usando el contexto de autenticación
      await login(cleanEmail, password);
      
      // Si el login es exitoso, verificar el estado del usuario
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Error al obtener sesión después del login:', sessionError);
        throw sessionError;
      }

      if (!session) {
        console.error('No se pudo obtener la sesión después del login');
        throw new Error('Error al establecer la sesión');
      }

      // Verificar el estado del usuario en la base de datos
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (userError) {
        console.error('Error al verificar usuario:', userError);
        throw new Error('Error al verificar el estado del usuario');
      }

      if (!userData) {
        console.error('Usuario no encontrado en la base de datos');
        throw new Error('Usuario no encontrado en la base de datos');
      }

      console.log('Estado del usuario:', {
        id: userData.id,
        email: userData.email,
        status: userData.status,
        role: userData.role
      });

      // Verificar el estado del usuario
      if (userData.status !== 'active') {
        if (userData.status === 'pending') {
          throw new Error('Tu cuenta está pendiente de activación. Por favor, revisa tu correo electrónico para confirmar tu cuenta.');
        }
        if (userData.status === 'inactive') {
          throw new Error('Tu cuenta está inactiva. Por favor, contacta al administrador.');
        }
        throw new Error('Estado de usuario no válido');
      }

      // Si todo está bien, navegar al dashboard
      console.log('Login exitoso, redirigiendo al dashboard');
      navigate('/admin/dashboard');
    } catch (error: any) {
      console.error('Error en login:', error);
      
      // Manejar errores específicos
      if (error.message?.includes('Email not confirmed')) {
        setError('Tu correo electrónico no ha sido confirmado. Por favor, revisa tu bandeja de entrada y confirma tu cuenta.');
      } else if (error.message?.includes('Invalid login credentials')) {
        setError('Credenciales inválidas. Por favor, verifica tu correo y contraseña.');
      } else {
        setError(error.message || 'Error al iniciar sesión. Por favor, intenta nuevamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!email) {
      setError('Por favor, ingresa tu correo electrónico');
      return;
    }

    setLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      console.log('Reenviando confirmación a:', cleanEmail);
      
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: cleanEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/admin/verify-email`
        }
      });

      if (resendError) {
        console.error('Error al reenviar confirmación:', resendError);
        if (resendError.message?.includes('rate limit')) {
          throw new Error('Has solicitado demasiados enlaces de confirmación. Por favor, espera unos minutos antes de intentar nuevamente.');
        }
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
              autoComplete="email"
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
              autoComplete="current-password"
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