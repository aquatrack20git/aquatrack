import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import { Box, CircularProgress, Typography } from '@mui/material';
import { Outlet, useLocation } from 'react-router-dom';

interface AuthContextType {
  user: User | null;
  userRole: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LoadingScreen = () => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      width: '100vw',
      position: 'fixed',
      top: 0,
      left: 0,
      backgroundColor: 'background.default',
      zIndex: 9999,
      padding: 2,
    }}
  >
    <CircularProgress size={60} thickness={4} />
    <Typography variant="body1" sx={{ mt: 2, textAlign: 'center' }}>
      Cargando aplicación...
    </Typography>
  </Box>
);

const ErrorScreen = ({ message }: { message: string }) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      width: '100vw',
      position: 'fixed',
      top: 0,
      left: 0,
      backgroundColor: 'background.default',
      zIndex: 9999,
      padding: 2,
    }}
  >
    <Typography variant="h6" color="error" sx={{ mb: 2, textAlign: 'center' }}>
      Error al cargar la aplicación
    </Typography>
    <Typography variant="body1" sx={{ mb: 2, textAlign: 'center' }}>
      {message}
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
      Por favor, intenta recargar la página o contacta al administrador si el problema persiste.
    </Typography>
  </Box>
);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();

  // Función para limpiar la sesión
  const clearSession = () => {
    console.log('AuthContext - Limpiando sesión');
    setUser(null);
    setUserRole(null);
    setError(null);
    // Limpiar localStorage
    localStorage.removeItem('aquatrack-auth-token');
    localStorage.removeItem('supabase.auth.token');
  };

  // Verificar si la sesión ha expirado
  const checkSessionExpiration = (session: any) => {
    if (!session?.expires_at) return true;
    const expiresAt = new Date(session.expires_at * 1000);
    const now = new Date();
    return now >= expiresAt;
  };

  const fetchUserRole = async (userId: string) => {
    console.log('AuthContext - Iniciando fetchUserRole para userId:', userId);
    try {
      if (!userId) {
        console.error('AuthContext - fetchUserRole: userId es null o undefined');
        return null;
      }

      console.log('AuthContext - Consultando rol en base de datos');
      const { data, error } = await supabase
        .from('users')
        .select('role, status')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('AuthContext - Error en fetchUserRole:', error);
        throw error;
      }

      if (!data) {
        console.error('AuthContext - No se encontró el usuario en la base de datos');
        return null;
      }

      console.log('AuthContext - Datos de usuario obtenidos:', {
        role: data.role,
        status: data.status,
        userId
      });

      // Verificar si el usuario está activo
      if (data.status !== 'active') {
        console.error('AuthContext - Usuario no está activo:', data.status);
        throw new Error(`Usuario no está activo (estado: ${data.status})`);
      }

      return data.role || null;
    } catch (error: any) {
      console.error('AuthContext - Error en fetchUserRole:', {
        error,
        message: error.message,
        code: error.code,
        details: error.details
      });
      // No propagar el error, solo retornar null
      return null;
    }
  };

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      if (!data.session) {
        throw new Error('Error al iniciar sesión: No se pudo establecer la sesión');
      }

      const role = await fetchUserRole(data.user.id);
      setUser(data.user);
      setUserRole(role);
      setError(null);
    } catch (error: any) {
      setUser(null);
      setUserRole(null);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    let retryCount = 0;
    const MAX_RETRIES = 3;
    
    const checkUser = async () => {
      console.log('AuthContext - Iniciando verificación de sesión');
      try {
        console.log('AuthContext - Obteniendo sesión actual');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('AuthContext - Error al obtener sesión:', sessionError);
          if (mounted) {
            clearSession();
            setError(`Error de sesión: ${sessionError.message}`);
          }
          return;
        }

        // Verificar si la sesión es válida
        if (!session || !session.user || !session.user.id) {
          console.error('AuthContext - Sesión inválida:', session);
          if (mounted) {
            clearSession();
            setError('Sesión inválida. Por favor, inicia sesión nuevamente.');
          }
          return;
        }

        // Verificar si la sesión ha expirado
        if (checkSessionExpiration(session)) {
          console.log('AuthContext - Sesión expirada');
          if (mounted) {
            clearSession();
            setError('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
          }
          return;
        }

        console.log('AuthContext - Estado de sesión:', {
          tieneSesion: !!session,
          userId: session.user?.id,
          email: session.user?.email,
          expiraEn: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'no expira',
          timestamp: new Date().toISOString()
        });

        // Verificar el rol del usuario
        console.log('AuthContext - Obteniendo rol de usuario');
        const role = await fetchUserRole(session.user.id);
        
        if (!role && retryCount < MAX_RETRIES) {
          console.log(`AuthContext - Reintentando obtener rol (intento ${retryCount + 1}/${MAX_RETRIES})`);
          retryCount++;
          // Esperar 1 segundo antes de reintentar
          await new Promise(resolve => setTimeout(resolve, 1000));
          return checkUser();
        }

        console.log('AuthContext - Rol obtenido:', role);
        
        if (mounted) {
          if (!role) {
            console.error('AuthContext - No se pudo obtener el rol después de varios intentos');
            clearSession();
            setError('Error al verificar permisos de usuario. Por favor, inicia sesión nuevamente.');
            return;
          }

          // Verificar si el usuario tiene permisos para la ruta actual
          const currentPath = window.location.pathname;
          if (currentPath.startsWith('/admin') && role !== 'admin') {
            console.error('AuthContext - Usuario no tiene permisos de administrador');
            clearSession();
            setError('No tienes permisos para acceder a esta sección.');
            return;
          }

          setUser(session.user);
          setUserRole(role);
          setError(null);
        }
      } catch (error: any) {
        console.error('AuthContext - Error en checkUser:', {
          error,
          message: error.message,
          code: error.code,
          details: error.details,
          timestamp: new Date().toISOString()
        });
        if (mounted) {
          clearSession();
          setError(`Error al verificar la sesión: ${error.message}`);
        }
      } finally {
        if (mounted) {
          console.log('AuthContext - Finalizando verificación de sesión');
          setLoading(false);
        }
      }
    };

    checkUser();

    console.log('AuthContext - Configurando suscriptor de cambios de autenticación');
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('AuthContext - Cambio de estado de autenticación:', {
        evento: event,
        tieneSesion: !!session,
        userId: session?.user?.id,
        email: session?.user?.email,
        expiraEn: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'no expira',
        timestamp: new Date().toISOString()
      });

      if (mounted) {
        if (session?.user) {
          // Verificar si la sesión es válida
          if (!session.user.id) {
            console.error('AuthContext - Sesión inválida en cambio de estado');
            clearSession();
            setError('Sesión inválida. Por favor, inicia sesión nuevamente.');
            return;
          }

          // Verificar si la sesión ha expirado
          if (checkSessionExpiration(session)) {
            console.log('AuthContext - Sesión expirada en cambio de estado');
            clearSession();
            setError('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
            return;
          }

          console.log('AuthContext - Obteniendo rol para nuevo estado de sesión');
          const role = await fetchUserRole(session.user.id);
          
          if (!role) {
            console.error('AuthContext - No se pudo obtener el rol en cambio de estado');
            clearSession();
            setError('Error al verificar permisos de usuario. Por favor, inicia sesión nuevamente.');
            return;
          }

          // Verificar permisos para la ruta actual
          const currentPath = window.location.pathname;
          if (currentPath.startsWith('/admin') && role !== 'admin') {
            console.error('AuthContext - Usuario no tiene permisos de administrador en cambio de estado');
            clearSession();
            setError('No tienes permisos para acceder a esta sección.');
            return;
          }

          setUser(session.user);
          setUserRole(role);
          setError(null);
        } else {
          console.log('AuthContext - Sesión finalizada');
          clearSession();
        }
      }
    });

    return () => {
      console.log('AuthContext - Limpiando suscriptor de autenticación');
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      clearSession();
    } catch (error: any) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Solo mostrar loading/error para rutas protegidas
  const isProtectedRoute = location.pathname.startsWith('/admin') && 
    !location.pathname.includes('/login') && 
    !location.pathname.includes('/setup') &&
    !location.pathname.includes('/verify-email');
  
  if (isProtectedRoute && loading) {
    console.log('AuthContext - Mostrando pantalla de carga para ruta protegida:', location.pathname);
    return <LoadingScreen />;
  }

  if (isProtectedRoute && error) {
    console.log('AuthContext - Mostrando pantalla de error para ruta protegida:', {
      path: location.pathname,
      error
    });
    return <ErrorScreen message={error} />;
  }

  return (
    <AuthContext.Provider value={{
      user,
      userRole,
      isAuthenticated: !!user,
      isAdmin: userRole === 'admin',
      login,
      logout,
      loading,
      error
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    console.error('useAuth - Used outside of AuthProvider');
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 