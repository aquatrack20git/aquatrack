import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Box, CircularProgress } from '@mui/material';
import theme from './theme';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PermissionsProvider } from './contexts/PermissionsContext';

// Admin Pages
import AdminLayout from './pages/admin/AdminLayout';
import Login from './pages/admin/Login';
import Dashboard from './pages/admin/Dashboard';
import MetersManagement from './pages/admin/MetersManagement';
import ReadingsManagement from './pages/admin/ReadingsManagement';
import ReadingsReport from './pages/admin/ReadingsReport';
import CommentsReport from './pages/admin/CommentsReport';
import UsersManagement from './pages/admin/UsersManagement';
import VerifyEmail from './pages/admin/VerifyEmail';
import ChangePassword from './pages/admin/ChangePassword';

// Protected Routes
import ProtectedAdminRoute from './components/ProtectedAdminRoute';

// Componente para manejar el estado de carga de la autenticación
const AuthCheck: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { loading } = useAuth();
  const location = useLocation();

  // Si estamos en una ruta pública, mostrar el contenido directamente
  const isPublicRoute = ['/admin/login', '/admin/verify-email', '/admin/change-password'].includes(location.pathname);
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Si está cargando, mostrar un indicador de carga
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <PermissionsProvider>
          <Router>
            <AuthCheck>
              <Routes>
                {/* Rutas públicas */}
                <Route path="/admin/login" element={<Login />} />
                <Route path="/admin/verify-email" element={<VerifyEmail />} />
                <Route path="/admin/change-password" element={<ChangePassword />} />

                {/* Rutas protegidas con AdminLayout */}
                <Route path="/admin" element={<AdminLayout><Navigate to="/admin/dashboard" replace /></AdminLayout>} />
                
                {/* Rutas que requieren autenticación pero no necesariamente permisos de admin */}
                <Route path="/admin/dashboard" element={<AdminLayout><Dashboard /></AdminLayout>} />
                <Route path="/admin/meters" element={<AdminLayout><MetersManagement /></AdminLayout>} />
                <Route path="/admin/readings" element={<AdminLayout><ReadingsManagement /></AdminLayout>} />
                <Route path="/admin/readings-report" element={<AdminLayout><ReadingsReport /></AdminLayout>} />
                <Route path="/admin/comments" element={<AdminLayout><CommentsReport /></AdminLayout>} />

                {/* Rutas que requieren permisos de admin */}
                <Route path="/admin/users" element={
                  <AdminLayout>
                    <ProtectedAdminRoute>
                      <UsersManagement />
                    </ProtectedAdminRoute>
                  </AdminLayout>
                } />

                {/* Redirección por defecto */}
                <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
              </Routes>
            </AuthCheck>
          </Router>
        </PermissionsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
