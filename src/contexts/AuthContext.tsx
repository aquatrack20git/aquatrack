import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('AuthProvider - Initializing auth check');
    
    // Verificar sesión actual
    const checkUser = async () => {
      try {
        console.log('AuthProvider - Checking current session');
        const { data: { session } } = await supabase.auth.getSession();
        console.log('AuthProvider - Session check result:', session ? 'Session found' : 'No session');
        setUser(session?.user ?? null);
      } catch (error) {
        console.error('AuthProvider - Error checking auth session:', error);
      } finally {
        console.log('AuthProvider - Setting loading to false');
        setLoading(false);
      }
    };

    checkUser();

    // Suscribirse a cambios en la autenticación
    console.log('AuthProvider - Setting up auth state change subscription');
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('AuthProvider - Auth state changed:', event, session ? 'Session exists' : 'No session');
      setUser(session?.user ?? null);
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

  console.log('AuthProvider - Rendering with state:', { user: user ? 'User exists' : 'No user', loading });

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      login,
      logout,
      loading
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