import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import { Box, CircularProgress, Typography } from '@mui/material';
import { Outlet, useLocation } from 'react-router-dom';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
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
      width: '100%',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      bgcolor: 'background.default',
      zIndex: 9999,
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
      width: '100%',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      bgcolor: 'background.default',
      zIndex: 9999,
      p: 2,
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

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;
    
    const checkUser = async () => {
      try {
        console.log('AuthContext - Verificando sesión actual');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('AuthContext - Error al obtener sesión:', sessionError);
          if (mounted) {
            setError(`Error de sesión: ${sessionError.message}`);
            setUser(null);
          }
          return;
        }

        if (mounted) {
          console.log('AuthContext - Estado de sesión:', { 
            hasSession: !!session, 
            userId: session?.user?.id 
          });
          setUser(session?.user ?? null);
          setError(null);
        }
      } catch (error: any) {
        console.error('AuthContext - Error al verificar sesión:', error);
        if (mounted) {
          setError(`Error al verificar la sesión: ${error.message}`);
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('AuthContext - Cambio en estado de autenticación:', { event, userId: session?.user?.id });
      if (mounted) {
        setUser(session?.user ?? null);
        setError(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      console.log('AuthContext - Iniciando login para:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error('AuthContext - Error en login:', error);
        throw error;
      }

      if (!data.session) {
        console.error('AuthContext - No se recibió sesión después del login');
        throw new Error('Error al iniciar sesión: No se pudo establecer la sesión');
      }

      console.log('AuthContext - Login exitoso:', { userId: data.user.id });
      setUser(data.user);
      setError(null);
    } catch (error: any) {
      console.error('AuthContext - Error completo en login:', error);
      setUser(null);
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
      setUser(null);
    } catch (error: any) {
      console.error('AuthContext - Error en logout:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Solo mostrar loading/error para rutas protegidas
  const isProtectedRoute = location.pathname.startsWith('/admin') && 
    !location.pathname.includes('/login') && 
    !location.pathname.includes('/setup');
  
  if (isProtectedRoute && loading) {
    return <LoadingScreen />;
  }

  if (isProtectedRoute && error) {
    return <ErrorScreen message={error} />;
  }

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
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