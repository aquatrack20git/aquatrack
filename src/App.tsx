import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme';
import { AuthProvider } from './contexts/AuthContext';
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

const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <PermissionsProvider>
          <Router>
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
          </Router>
        </PermissionsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
