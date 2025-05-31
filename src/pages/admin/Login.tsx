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
      // Limpiar el email de espacios en blanco
      const cleanEmail = email.trim().toLowerCase();
      console.log('Intentando iniciar sesión con email limpio:', cleanEmail);
      
      // Verificar la conexión a la base de datos
      const { data: testData, error: testError } = await supabase
        .from('users')
        .select('count')
        .limit(1);

      console.log('Prueba de conexión a la base de datos:', { testData, testError });

      // Primero verificar si el usuario existe en la tabla users con una consulta más simple
      const { data: directUser, error: directError } = await supabase
        .from('users')
        .select('*')
        .eq('email', cleanEmail)
        .single();

      console.log('Búsqueda directa de usuario:', { 
        emailBuscado: cleanEmail,
        usuarioEncontrado: directUser,
        error: directError 
      });

      // Intentar una búsqueda más amplia para diagnóstico
      const { data: allUsers, error: allUsersError } = await supabase
        .from('users')
        .select('email')
        .limit(5);

      console.log('Muestra de usuarios en la tabla:', {
        usuariosEncontrados: allUsers,
        error: allUsersError
      });

      if (directError) {
        console.error('Error al verificar usuario:', directError);
        throw new Error('Error al verificar el usuario. Por favor, intenta nuevamente.');
      }

      if (!directUser) {
        // Verificar si el usuario existe en auth.users
        const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
        console.log('Verificación en auth.users:', {
          usuariosAuth: authUsers?.users?.filter(u => u.email?.toLowerCase() === cleanEmail),
          error: authError
        });

        console.error('Usuario no encontrado en tabla users');
        throw new Error('No existe una cuenta con este correo electrónico. Por favor, contacta al administrador para crear una cuenta.');
      }

      console.log('Usuario encontrado:', {
        id: directUser.id,
        email: directUser.email,
        status: directUser.status,
        emailConfirmed: directUser.email_confirmed_at
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

      // Si el usuario existe y está activo, intentar login
      console.log('Usuario verificado, intentando login');
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
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
        status: directUser.status,
        emailConfirmed: directUser.email_confirmed_at
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
      const code = params.get('code');
      const type = params.get('type');
      const errorCode = params.get('error_code');
      const errorDescription = params.get('error_description');

      // Verificar si estamos en la URL de verificación de Supabase
      const isSupabaseVerifyUrl = window.location.href.includes('supabase.co/auth/v1/verify');
      
      if (isSupabaseVerifyUrl) {
        console.log('Detectada URL de verificación de Supabase');
        setVerifying(true);
        try {
          // Extraer el token directamente de la URL
          const urlParams = new URLSearchParams(window.location.search);
          const verifyToken = urlParams.get('token');
          const redirectTo = urlParams.get('redirect_to');
          
          console.log('Parámetros de verificación:', {
            token: verifyToken,
            redirectTo: redirectTo
          });

          if (!verifyToken) {
            throw new Error('Token de verificación no encontrado');
          }

          // Intentar verificar el token directamente con Supabase
          const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: verifyToken,
            type: 'signup'
          });

          if (verifyError) {
            console.error('Error en verificación de Supabase:', verifyError);
            throw verifyError;
          }

          console.log('Token verificado exitosamente:', verifyData);

          // Obtener el usuario después de la verificación
          const { data: { user: verifiedUser }, error: verifiedUserError } = await supabase.auth.getUser();
          
          if (verifiedUserError) {
            console.error('Error al obtener usuario:', verifiedUserError);
            throw verifiedUserError;
          }

          if (!verifiedUser) {
            throw new Error('No se pudo obtener la información del usuario');
          }

          console.log('Usuario verificado:', verifiedUser);

          // Actualizar el estado del usuario en la tabla users
          const { error: updateError } = await supabase
            .from('users')
            .update({ 
              status: 'active',
              email_confirmed_at: new Date().toISOString()
            })
            .eq('id', verifiedUser.id);

          if (updateError) {
            console.error('Error al actualizar estado del usuario:', updateError);
            throw updateError;
          }

          console.log('Estado del usuario actualizado exitosamente');

          // Redirigir a la aplicación con mensaje de éxito
          const redirectUrl = new URL(redirectTo || `${window.location.origin}/admin/login`);
          redirectUrl.searchParams.set('verification', 'success');
          window.location.href = redirectUrl.toString();
          return;

        } catch (error: any) {
          console.error('Error en proceso de verificación:', error);
          setVerifying(false);
          
          // Mostrar interfaz de error con opción de reenvío
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
                    {error.message?.includes('expired') || error.message?.includes('invalid')
                      ? 'El enlace de confirmación ha expirado o no es válido.'
                      : 'Hubo un error al verificar tu correo electrónico.'}
                  </Typography>
                  <Typography variant="body2" align="center" color="text.secondary" gutterBottom>
                    Por favor, solicita un nuevo enlace de confirmación.
                  </Typography>
                  <Button
                    variant="contained"
                    color="primary"
                    sx={{ mt: 2 }}
                    onClick={() => {
                      // Redirigir a la página de login para solicitar nuevo enlace
                      window.location.href = `${window.location.origin}/admin/login`;
                    }}
                  >
                    Ir a la página de inicio de sesión
                  </Button>
                </Paper>
              </Box>
            </Container>
          );
        }
      }

      // Procesar verificación con code (para URLs de la aplicación)
      if (code && type === 'signup') {
        setVerifying(true);
        try {
          console.log('Iniciando verificación de email con code:', { code, type });
          
          // Verificar el código con Supabase
          const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: code,
            type: 'signup'
          });

          if (verifyError) {
            console.error('Error al verificar email:', verifyError);
            
            // Manejar errores específicos
            if (verifyError.message?.includes('expired') || verifyError.message?.includes('invalid')) {
              setError('El enlace de confirmación ha expirado o no es válido. Por favor, solicita un nuevo enlace de confirmación.');
              // Mostrar el botón de reenvío
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
                        Enlace expirado o inválido
                      </Typography>
                      <Typography variant="body1" align="center" gutterBottom>
                        El enlace de confirmación ha expirado o no es válido.
                      </Typography>
                      <Typography variant="body2" align="center" color="text.secondary" gutterBottom>
                        Por favor, solicita un nuevo enlace de confirmación.
                      </Typography>
                      <Button
                        variant="contained"
                        color="primary"
                        sx={{ mt: 2 }}
                        onClick={handleResendConfirmation}
                        disabled={loading}
                      >
                        {loading ? 'Enviando...' : 'Solicitar nuevo enlace'}
                      </Button>
                    </Paper>
                  </Box>
                </Container>
              );
            }
            
            setError('Error al verificar el email. Por favor, intenta nuevamente.');
            return;
          }

          console.log('Código verificado exitosamente:', verifyData);

          // Obtener el usuario después de la verificación
          const { data: { user: verifiedUser }, error: verifiedUserError } = await supabase.auth.getUser();
          
          if (verifiedUserError) {
            console.error('Error al obtener usuario después de verificación:', verifiedUserError);
            throw verifiedUserError;
          }

          if (!verifiedUser) {
            throw new Error('No se pudo obtener la información del usuario');
          }

          // Actualizar el estado del usuario en la tabla users
          const { error: updateError } = await supabase
            .from('users')
            .update({ 
              status: 'active',
              email_confirmed_at: new Date().toISOString()
            })
            .eq('id', verifiedUser.id);

          if (updateError) {
            console.error('Error al actualizar estado del usuario:', updateError);
            throw updateError;
          }

          console.log('Estado del usuario actualizado exitosamente');

          // Limpiar la URL y mostrar mensaje de éxito
          window.history.replaceState({}, document.title, '/admin/login');
          setError('');
          setVerifying(false);
          
          // Mostrar mensaje de éxito en un componente más visible
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
                    onClick={() => window.location.href = '/admin/login'}
                  >
                    Ir a Iniciar Sesión
                  </Button>
                </Paper>
              </Box>
            </Container>
          );
        } catch (error: any) {
          console.error('Error en verificación:', error);
          if (error.message?.includes('expired') || error.message?.includes('invalid')) {
            setError('El enlace de confirmación ha expirado o no es válido. Por favor, solicita un nuevo enlace de confirmación.');
          } else {
            setError('Error al verificar el email. Por favor, intenta nuevamente.');
          }
        } finally {
          setVerifying(false);
        }
      }

      // Procesar verificación con token (para URLs de la aplicación)
      if (token && type === 'signup') {
        setVerifying(true);
        try {
          console.log('Iniciando verificación de email con token local:', { token, type });
          
          // Verificar el token
          const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'signup'
          });

          if (verifyError) {
            console.error('Error al verificar email:', verifyError);
            if (verifyError.message?.includes('expired')) {
              setError('El enlace de confirmación ha expirado. Por favor, solicita un nuevo enlace de confirmación.');
            } else {
              setError('Error al verificar el email. Por favor, intenta nuevamente.');
            }
            return;
          }

          console.log('Token verificado exitosamente:', verifyData);

          // Obtener el usuario después de la verificación
          const { data: { user: verifiedUser }, error: verifiedUserError } = await supabase.auth.getUser();
          
          if (verifiedUserError) {
            console.error('Error al obtener usuario después de verificación:', verifiedUserError);
            throw verifiedUserError;
          }

          if (!verifiedUser) {
            throw new Error('No se pudo obtener la información del usuario');
          }

          // Actualizar el estado del usuario en la tabla users
          const { error: updateError } = await supabase
            .from('users')
            .update({ 
              status: 'active',
              email_confirmed_at: new Date().toISOString()
            })
            .eq('id', verifiedUser.id);

          if (updateError) {
            console.error('Error al actualizar estado del usuario:', updateError);
            throw updateError;
          }

          console.log('Estado del usuario actualizado exitosamente');

          // Limpiar la URL y mostrar mensaje de éxito
          window.history.replaceState({}, document.title, '/admin/login');
          setError('');
          alert('Email verificado exitosamente. Por favor, inicia sesión con tus credenciales.');
          
        } catch (error: any) {
          console.error('Error en verificación:', error);
          if (error.message?.includes('expired')) {
            setError('El enlace de confirmación ha expirado. Por favor, solicita un nuevo enlace de confirmación.');
          } else {
            setError('Error al verificar el email. Por favor, intenta nuevamente.');
          }
        } finally {
          setVerifying(false);
        }
      }

      // Procesar parámetros de redirección después de verificación
      if (params.get('verification') === 'success') {
        setError('');
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
                  onClick={() => window.location.href = '/admin/login'}
                >
                  Ir a Iniciar Sesión
                </Button>
              </Paper>
            </Box>
          </Container>
        );
      }

      if (errorCode === 'verification_failed') {
        setError(decodeURIComponent(errorDescription || 'Error al verificar el email'));
        window.history.replaceState({}, document.title, '/admin/login');
        return;
      }

      if (errorCode === 'otp_expired') {
        setError('El enlace de confirmación ha expirado. Por favor, solicita un nuevo enlace de confirmación.');
        window.history.replaceState({}, document.title, '/admin/login');
        return;
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
          emailRedirectTo: `${window.location.origin}/admin/login`
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