import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('AuthProvider - Iniciando verificación de sesión');
    
    const checkUser = async () => {
      try {
        console.log('AuthProvider - Verificando sesión actual');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('AuthProvider - Error al obtener sesión:', error);
          throw error;
        }
        
        console.log('AuthProvider - Estado de sesión:', { 
          hasSession: !!session, 
          userId: session?.user?.id 
        });

        if (session?.user) {
          setUser(session.user);
        }
      } catch (error) {
        console.error('AuthProvider - Error en checkUser:', error);
      } finally {
        console.log('AuthProvider - Finalizando verificación de sesión');
        setLoading(false);
      }
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('AuthProvider - Cambio en estado de autenticación:', { 
        event, 
        userId: session?.user?.id 
      });
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      console.log('AuthProvider - Limpiando suscripción');
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    console.log('AuthProvider - Iniciando login');
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error('AuthProvider - Error en login:', error);
        throw error;
      }

      console.log('AuthProvider - Login exitoso:', { userId: data.user.id });
      setUser(data.user);
    } catch (error: any) {
      console.error('AuthProvider - Error completo en login:', error);
      throw new Error(error.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    console.log('AuthProvider - Iniciando logout');
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('AuthProvider - Error en logout:', error);
        throw error;
      }
      console.log('AuthProvider - Logout exitoso');
      setUser(null);
    } catch (error: any) {
      console.error('AuthProvider - Error en logout:', error);
      throw new Error(error.message || 'Error al cerrar sesión');
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    isAuthenticated: !!user,
    loading,
    login,
    logout,
  };

  // Mostrar un indicador de carga simple
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        width: '100%',
        backgroundColor: '#f5f5f5'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #3498db',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }}></div>
          <style>
            {`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}
          </style>
          <p>Cargando aplicación...</p>
        </div>
      </div>
    );
  }

  console.log('AuthProvider - Renderizando con estado:', { 
    isAuthenticated: !!user, 
    loading, 
    userId: user?.id 
  });

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 