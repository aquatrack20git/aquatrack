import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import type { User } from '@supabase/supabase-js';
import { Box, CircularProgress, Typography } from '@mui/material';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    console.log('AuthProvider - Device:', isMobile ? 'Mobile' : 'Desktop');
    console.log('AuthProvider - User Agent:', navigator.userAgent);
    console.log('AuthProvider - Initializing auth check');
    
    const checkUser = async () => {
      try {
        console.log('AuthProvider - Checking current session');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('AuthProvider - Session error:', sessionError);
          setError(`Error de sesión: ${sessionError.message}`);
          return;
        }

        if (!session) {
          console.log('AuthProvider - No active session found');
          setUser(null);
          return;
        }

        console.log('AuthProvider - Session found:', {
          user: session.user?.email,
          expires_at: session.expires_at
        });
        setUser(session.user);
      } catch (error: any) {
        console.error('AuthProvider - Error checking auth session:', error);
        setError(`Error al verificar la sesión: ${error.message}`);
      } finally {
        console.log('AuthProvider - Setting loading to false');
        setLoading(false);
      }
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('AuthProvider - Auth state changed:', {
        event,
        user: session?.user?.email,
        expires_at: session?.expires_at
      });
      setUser(session?.user ?? null);
      setError(null);
    });

    return () => {
      console.log('AuthProvider - Cleaning up auth subscription');
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    console.log('AuthProvider - Attempting login');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        console.error('AuthProvider - Login error:', error);
        throw error;
      }
      console.log('AuthProvider - Login successful');
    } catch (error) {
      console.error('AuthProvider - Error in login function:', error);
      throw error;
    }
  };

  const logout = async () => {
    console.log('AuthProvider - Attempting logout');
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('AuthProvider - Logout error:', error);
        throw error;
      }
      console.log('AuthProvider - Logout successful');
    } catch (error) {
      console.error('AuthProvider - Error in logout function:', error);
      throw error;
    }
  };

  console.log('AuthProvider - Rendering with state:', { 
    user: user ? `User: ${user.email}` : 'No user', 
    loading,
    error: error || 'No error'
  });

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
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