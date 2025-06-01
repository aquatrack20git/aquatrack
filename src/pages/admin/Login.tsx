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
  const { login } = useAuth();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Verificar si hay un mensaje de verificación exitosa
    const verificationStatus = searchParams.get('verification');
    if (verificationStatus === 'success') {
      setError('Email verificado exitosamente. Por favor, inicia sesión.');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Limpiar el email de espacios en blanco
      const cleanEmail = email.trim().toLowerCase();
      console.log('Iniciando proceso de login para:', cleanEmail);
      
      // Primero intentar la autenticación con Supabase
      console.log('Intentando autenticación con Supabase...');
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password
      });

      console.log('Respuesta de autenticación:', {
        usuario: authData?.user,
        error: authError,
        session: authData?.session
      });

      if (authError) {
        console.error('Error detallado de autenticación:', {
          code: authError.code,
          message: authError.message,
          status: authError.status
        });
        
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
        console.error('No se recibió usuario en la respuesta de autenticación');
        throw new Error('Error al obtener la información del usuario');
      }

      // Si la autenticación fue exitosa, verificar el estado del usuario
      console.log('Autenticación exitosa, verificando estado del usuario...');
      const { data: directUser, error: directError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      console.log('Resultado de búsqueda en tabla users:', { 
        usuario: directUser,
        error: directError,
        query: `SELECT * FROM users WHERE id = '${authData.user.id}'`
      });

      if (directError) {
        console.error('Error detallado al buscar usuario:', {
          code: directError.code,
          message: directError.message,
          details: directError.details,
          hint: directError.hint
        });
        throw new Error('Error al verificar el estado del usuario. Por favor, contacta al administrador.');
      }

      if (!directUser) {
        console.error('Usuario no encontrado en tabla users después de autenticación exitosa');
        throw new Error('Error: Usuario autenticado pero no encontrado en la base de datos. Por favor, contacta al administrador.');
      }

      console.log('Estado del usuario:', {
        id: directUser.id,
        email: directUser.email,
        status: directUser.status,
        role: directUser.role,
        email_confirmed_at: directUser.email_confirmed_at
      });

      // Verificar el estado del usuario
      if (directUser.status === 'pending') {
        console.log('Usuario en estado pending');
        setError('Tu cuenta está pendiente de activación. Por favor, revisa tu correo electrónico para confirmar tu cuenta.');
        return;
      }

      if (directUser.status === 'inactive') {
        console.log('Usuario en estado inactive');
        setError('Tu cuenta está inactiva. Por favor, contacta al administrador.');
        return;
      }

      console.log('Login exitoso:', {
        userId: authData.user.id,
        email: authData.user.email,
        status: directUser.status,
        role: directUser.role,
        session: authData.session?.access_token ? 'Token presente' : 'Sin token'
      });

      // Si todo está bien, navegar al dashboard
      navigate('/admin/dashboard');
    } catch (error: any) {
      console.error('Error completo en login:', {
        message: error.message,
        code: error.code,
        status: error.status,
        details: error.details,
        stack: error.stack
      });
      setError(error.message || 'Error al iniciar sesión. Por favor, intenta nuevamente.');
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
      // Limpiar el email de espacios en blanco
      const cleanEmail = email.trim().toLowerCase();
      console.log('Reenviando confirmación a email limpio:', cleanEmail);
      
      // Verificar si el usuario existe en la tabla users
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('*')
        .ilike('email', cleanEmail);

      console.log('Verificación de usuario para reenvío:', { 
        emailBuscado: cleanEmail,
        usuariosEncontrados: users,
        error: userError 
      });

      if (userError) {
        console.error('Error al verificar usuario para reenvío:', userError);
        throw new Error('Error al verificar el estado de tu cuenta');
      }

      if (!users || users.length === 0) {
        setError('No existe una cuenta con este correo electrónico. Por favor, contacta al administrador para crear una cuenta.');
        return;
      }

      const userData = users[0];
      
      // Verificar si el usuario ya está activo
      if (userData.status === 'active') {
        setError('Tu cuenta ya está activa. Por favor, intenta iniciar sesión.');
        return;
      }

      // Intentar reenviar el email de confirmación con opciones específicas
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
      alert('Se ha enviado un nuevo enlace de confirmación a tu correo electrónico. Por favor, revisa tu bandeja de entrada y sigue las instrucciones para activar tu cuenta. El enlace expirará en 24 horas.');
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