import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
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
  const [initialCheckComplete, setInitialCheckComplete] = useState(false);
  const location = useLocation();

  // Función para limpiar la sesión
  const clearSession = () => {
    console.log('AuthContext - Limpiando sesión');
    setUser(null);
    setUserRole(null);
    setError(null);
    localStorage.removeItem('supabase.auth.token');
  };

  // Función para verificar si la sesión ha expirado
  const checkSessionExpiration = (session: Session | null) => {
    if (!session?.expires_at) return true;
    const expiresAt = new Date(session.expires_at).getTime();
    const now = new Date().getTime();
    return now >= expiresAt;
  };

  // Verificar sesión inicial
  useEffect(() => {
    const checkInitialSession = async () => {
      try {
        console.log('AuthContext - Verificando sesión inicial');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('AuthContext - Error al obtener sesión:', sessionError);
          throw sessionError;
        }

        if (session) {
          console.log('AuthContext - Sesión encontrada:', {
            user: session.user?.email,
            expires_at: session.expires_at,
            timestamp: new Date().toISOString()
          });

          if (checkSessionExpiration(session)) {
            console.log('AuthContext - Sesión expirada');
            clearSession();
            setInitialCheckComplete(true);
            return;
          }

          // Obtener el rol del usuario
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('role, status')
            .eq('id', session.user.id)
            .single();

          if (userError) {
            console.error('AuthContext - Error al obtener rol de usuario:', userError);
            throw userError;
          }

          if (!userData) {
            console.error('AuthContext - No se encontró el usuario en la base de datos');
            throw new Error('Usuario no encontrado en la base de datos');
          }

          if (userData.status !== 'active') {
            console.error('AuthContext - Usuario no está activo:', userData.status);
            throw new Error('Usuario no está activo');
          }

          setUser(session.user);
          setUserRole(userData.role);
          console.log('AuthContext - Sesión inicial verificada:', {
            email: session.user.email,
            role: userData.role,
            status: userData.status
          });
        } else {
          console.log('AuthContext - No hay sesión activa');
          clearSession();
        }
      } catch (error: any) {
        console.error('AuthContext - Error en verificación inicial:', error);
        setError(error.message);
        clearSession();
      } finally {
        setInitialCheckComplete(true);
        setLoading(false);
      }
    };

    checkInitialSession();
  }, []);

  // Suscribirse a cambios de autenticación
  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('AuthContext - Cambio de estado de autenticación:', {
        event,
        hasSession: !!session,
        timestamp: new Date().toISOString()
      });

      if (!mounted) return;

      try {
        if (event === 'SIGNED_OUT') {
          console.log('AuthContext - Usuario cerró sesión');
          clearSession();
          return;
        }

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (!session) {
            console.error('AuthContext - Sesión no disponible después de SIGNED_IN/TOKEN_REFRESHED');
            throw new Error('Error de autenticación: sesión no disponible');
          }

          if (checkSessionExpiration(session)) {
            console.log('AuthContext - Sesión expirada en cambio de estado');
            clearSession();
            return;
          }

          // Obtener el rol del usuario
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('role, status')
            .eq('id', session.user.id)
            .single();

          if (userError) {
            console.error('AuthContext - Error al obtener rol de usuario:', userError);
            throw userError;
          }

          if (!userData) {
            console.error('AuthContext - No se encontró el usuario en la base de datos');
            throw new Error('Usuario no encontrado en la base de datos');
          }

          if (userData.status !== 'active') {
            console.error('AuthContext - Usuario no está activo:', userData.status);
            throw new Error('Usuario no está activo');
          }

          setUser(session.user);
          setUserRole(userData.role);
          setError(null);
          console.log('AuthContext - Sesión actualizada:', {
            email: session.user.email,
            role: userData.role,
            status: userData.status
          });
        }
      } catch (error: any) {
        console.error('AuthContext - Error en cambio de estado:', error);
        setError(error.message);
        clearSession();
      } finally {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Solo mostrar loading/error para rutas protegidas y después de la verificación inicial
  const isProtectedRoute = initialCheckComplete && 
    location.pathname.startsWith('/admin') && 
    !location.pathname.includes('/login') && 
    !location.pathname.includes('/setup') &&
    !location.pathname.includes('/verify-email');

  if (isProtectedRoute && loading) {
    console.log('AuthContext - Mostrando pantalla de carga para ruta protegida:', {
      path: location.pathname,
      initialCheckComplete,
      loading,
      hasUser: !!user,
      hasRole: !!userRole
    });
    return <LoadingScreen />;
  }

  if (isProtectedRoute && error) {
    console.log('AuthContext - Mostrando pantalla de error para ruta protegida:', {
      path: location.pathname,
      error,
      initialCheckComplete,
      hasUser: !!user,
      hasRole: !!userRole
    });
    return <ErrorScreen message={error} />;
  }

  // Si aún no se ha completado la verificación inicial, mostrar loading
  if (!initialCheckComplete) {
    console.log('AuthContext - Esperando verificación inicial');
    return <LoadingScreen />;
  }

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

      // Obtener el rol del usuario
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role, status')
        .eq('id', data.user.id)
        .single();

      if (userError) throw userError;

      if (!userData) {
        throw new Error('Usuario no encontrado en la base de datos');
      }

      if (userData.status !== 'active') {
        throw new Error('Usuario no está activo');
      }

      setUser(data.user);
      setUserRole(userData.role);
      setError(null);
    } catch (error: any) {
      setUser(null);
      setUserRole(null);
      throw error;
    } finally {
      setLoading(false);
    }
  };

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