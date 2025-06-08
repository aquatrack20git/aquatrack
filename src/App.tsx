import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
  const { isAuthenticated, loading } = useAuth();

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
          <div className="spinner" style={{ marginBottom: '1rem' }}></div>
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Rutas públicas */}
            <Route path="/admin/login" element={<Login />} />
            <Route path="/admin/verify-email" element={<VerifyEmail />} />
            <Route path="/admin/change-password" element={<ChangePassword />} />

            {/* Rutas protegidas */}
            <Route path="/admin" element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="meters" element={<MetersManagement />} />
              <Route path="readings" element={<ReadingsManagement />} />
              <Route path="readings-report" element={<ReadingsReport />} />
              <Route path="comments-report" element={<CommentsReport />} />
              <Route path="users" element={<UsersManagement />} />
            </Route>

            {/* Redirección por defecto */}
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
};

export default App;
