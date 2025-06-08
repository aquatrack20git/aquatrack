import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import theme from './theme';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/admin/Login';
import VerifyEmail from './pages/admin/VerifyEmail';
import ChangePassword from './pages/admin/ChangePassword';
import AdminLayout from './pages/admin/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import MetersManagement from './pages/admin/MetersManagement';
import ReadingsManagement from './pages/admin/ReadingsManagement';
import ReadingsReport from './pages/admin/ReadingsReport';
import CommentsReport from './pages/admin/CommentsReport';
import UsersManagement from './pages/admin/UsersManagement';

// Componente para rutas protegidas
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  console.log('ProtectedRoute - Estado:', { 
    isAuthenticated, 
    loading, 
    path: location.pathname,
    userId: user?.id 
  });

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
          <p>Verificando autenticación...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    console.log('ProtectedRoute - Redirigiendo a login');
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  console.log('ProtectedRoute - Acceso permitido');
  return <>{children}</>;
};

// Componente para rutas que requieren permisos de admin
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  const isAdmin = user?.user_metadata?.role === 'admin';

  console.log('AdminRoute - Estado:', { 
    isAdmin, 
    path: location.pathname,
    userId: user?.id 
  });

  if (!isAdmin) {
    console.log('AdminRoute - Redirigiendo a dashboard');
    return <Navigate to="/admin" replace />;
  }

  console.log('AdminRoute - Acceso permitido');
  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  const location = useLocation();
  console.log('AppRoutes - Ruta actual:', location.pathname);

  return (
    <Routes>
      {/* Rutas públicas */}
      <Route path="/admin/login" element={<Login />} />
      <Route path="/admin/verify-email" element={<VerifyEmail />} />
      <Route path="/admin/change-password" element={<ChangePassword />} />

      {/* Rutas protegidas con AdminLayout */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        {/* Rutas dentro del AdminLayout */}
        <Route index element={<Dashboard />} />
        <Route path="meters" element={<MetersManagement />} />
        <Route path="readings" element={<ReadingsManagement />} />
        <Route path="readings-report" element={<ReadingsReport />} />
        <Route path="comments-report" element={<CommentsReport />} />
        <Route
          path="users"
          element={
            <AdminRoute>
              <UsersManagement />
            </AdminRoute>
          }
        />
      </Route>

      {/* Redirección por defecto */}
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  console.log('App - Iniciando aplicación');
  
  return (
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
};

export default App;
