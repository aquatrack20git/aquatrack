import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
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
  const [verifying, setVerifying] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [searchParams] = useSearchParams();

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

  useEffect(() => {
    const verifyEmail = async () => {
      console.log('Iniciando proceso de verificación...');
      console.log('URL actual:', window.location.href);
      
      // Verificar si estamos en la URL de verificación de Supabase
      const isSupabaseVerifyUrl = window.location.href.includes('supabase.co/auth/v1/verify');
      console.log('¿Es URL de verificación de Supabase?', isSupabaseVerifyUrl);
      
      if (isSupabaseVerifyUrl) {
        console.log('Procesando URL de verificación de Supabase');
        setVerifying(true);
        try {
          // Extraer parámetros directamente de la URL completa
          const url = new URL(window.location.href);
          const verifyToken = url.searchParams.get('token');
          const type = url.searchParams.get('type');
          const redirectTo = url.searchParams.get('redirect_to');
          
          console.log('Parámetros extraídos de la URL:', {
            token: verifyToken,
            type: type,
            redirectTo: redirectTo,
            fullUrl: window.location.href
          });

          if (!verifyToken) {
            console.error('Token no encontrado en la URL');
            throw new Error('Token de verificación no encontrado');
          }

          if (type !== 'signup') {
            console.error('Tipo de verificación incorrecto:', type);
            throw new Error('Tipo de verificación inválido');
          }

          console.log('Intentando verificar token con Supabase...');
          // Intentar verificar el token directamente con Supabase
          const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: verifyToken,
            type: 'signup'
          });

          if (verifyError) {
            console.error('Error detallado en verificación de Supabase:', {
              message: verifyError.message,
              status: verifyError.status,
              name: verifyError.name
            });
            throw verifyError;
          }

          console.log('Token verificado exitosamente:', verifyData);

          // Obtener el usuario después de la verificación
          console.log('Obteniendo información del usuario...');
          const { data: { user: verifiedUser }, error: verifiedUserError } = await supabase.auth.getUser();
          
          if (verifiedUserError) {
            console.error('Error al obtener usuario:', verifiedUserError);
            throw verifiedUserError;
          }

          if (!verifiedUser) {
            console.error('No se pudo obtener la información del usuario después de la verificación');
            throw new Error('No se pudo obtener la información del usuario');
          }

          console.log('Usuario verificado:', {
            id: verifiedUser.id,
            email: verifiedUser.email,
            email_confirmed_at: verifiedUser.email_confirmed_at
          });

          // Actualizar el estado del usuario en la tabla users
          console.log('Actualizando estado del usuario en la base de datos...');
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

          // Si hay una URL de redirección específica, usarla
          if (redirectTo) {
            console.log('Redirigiendo a la URL especificada:', redirectTo);
            // Asegurarnos de que la URL de redirección incluya el parámetro de verificación exitosa
            const redirectUrl = new URL(redirectTo);
            redirectUrl.searchParams.set('verification', 'success');
            console.log('URL final de redirección:', redirectUrl.toString());
            window.location.href = redirectUrl.toString();
          } else {
            // Si no hay URL de redirección, ir a la página de verificación
            console.log('Redirigiendo a la página de verificación por defecto');
            const defaultRedirect = `${window.location.origin}/admin/verify-email?verification=success`;
            console.log('URL de redirección por defecto:', defaultRedirect);
            window.location.href = defaultRedirect;
          }
          return;
        } catch (error: any) {
          console.error('Error en proceso de verificación:', error);
          setVerifying(false);
          setError(error.message || 'Error al verificar el email');
        }
      }

      // Procesar otros parámetros de la URL (para URLs de la aplicación)
      const params = new URLSearchParams(location.search);
      const code = params.get('code');
      const type = params.get('type');
      const errorCode = params.get('error_code');
      const errorDescription = params.get('error_description');

      console.log('Parámetros de la URL de la aplicación:', {
        code,
        type,
        errorCode,
        errorDescription
      });

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
      const token = params.get('token');
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

  useEffect(() => {
    // Verificar si hay un mensaje de verificación exitosa
    const verificationStatus = searchParams.get('verification');
    if (verificationStatus === 'success') {
      setError('Email verificado exitosamente. Por favor, inicia sesión.');
    }
  }, [searchParams]);

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