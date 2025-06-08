import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../config/supabase';

interface PermissionsContextType {
  isAdmin: boolean;
  loading: boolean;
  canCreate: (module: string) => boolean;
  canEdit: (module: string) => boolean;
  canDelete: (module: string) => boolean;
  canView: (module: string) => boolean;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export const PermissionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (user) {
        try {
          const { data, error } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single();
          
          if (!error && data) {
            setUserRole(data.role);
          }
        } catch (error) {
          console.error('Error fetching user role:', error);
        }
      }
      setLoading(false);
    };

    fetchUserRole();
  }, [user]);

  const isAdmin = userRole === 'admin';

  const canCreate = (module: string): boolean => {
    if (!userRole) return false;
    return isAdmin;
  };

  const canEdit = (module: string): boolean => {
    if (!userRole) return false;
    return isAdmin;
  };

  const canDelete = (module: string): boolean => {
    if (!userRole) return false;
    return isAdmin;
  };

  const canView = (module: string): boolean => {
    if (!userRole) return false;
    return true; // Todos los usuarios autenticados pueden ver
  };

  if (loading) {
    return null; // O un componente de carga si lo prefieres
  }

  return (
    <PermissionsContext.Provider
      value={{
        isAdmin,
        loading,
        canCreate,
        canEdit,
        canDelete,
        canView,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissions = () => {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
}; 