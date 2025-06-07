import React, { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../config/supabase';

interface PermissionsContextType {
  canEdit: boolean;
  canDelete: boolean;
  canCreate: boolean;
  canView: boolean;
  canDownload: boolean;
  canFilter: boolean;
  isAdmin: boolean;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export const PermissionsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [userRole, setUserRole] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchUserRole = async () => {
      if (user) {
        const { data, error } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single();
        
        if (!error && data) {
          setUserRole(data.role);
        }
      }
    };

    fetchUserRole();
  }, [user]);

  const isAdmin = userRole === 'admin';

  const permissions: PermissionsContextType = {
    canEdit: isAdmin,
    canDelete: isAdmin,
    canCreate: isAdmin,
    canView: true, // Todos los usuarios pueden ver
    canDownload: true, // Todos los usuarios pueden descargar
    canFilter: true, // Todos los usuarios pueden filtrar
    isAdmin,
  };

  return (
    <PermissionsContext.Provider value={permissions}>
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