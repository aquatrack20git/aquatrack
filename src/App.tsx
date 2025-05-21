import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ToastContainer } from 'react-toastify';
import { Box, Typography, Alert, useMediaQuery, CircularProgress } from '@mui/material';
import 'react-toastify/dist/ReactToastify.css';
import { useEffect } from 'react';
import Home from './pages/Home';
import theme from './theme';
import AdminLayout from './pages/admin/AdminLayout';
import Login from './pages/admin/Login';
import Dashboard from './pages/admin/Dashboard';
import MetersManagement from './pages/admin/MetersManagement';
import UsersManagement from './pages/admin/UsersManagement';
import ReadingsManagement from './pages/admin/ReadingsManagement';
import ReadingsReport from './pages/admin/ReadingsReport';
import CommentsReport from './pages/admin/CommentsReport';
import SetupAdmin from './pages/admin/SetupAdmin';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Readings from './pages/Readings';

const ErrorScreen = ({ message }: { message: string }) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      p: 3,
      textAlign: 'center',
      backgroundColor: 'background.default',
    }}
  >
    <Alert severity="error" sx={{ mb: 2, maxWidth: 600, width: '100%' }}>
      {message}
    </Alert>
    <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
      Por favor, intenta recargar la página o contacta al administrador si el problema persiste.
    </Typography>
    <Typography variant="body2" color="text.secondary">
      Si el problema persiste, intenta:
      <ul style={{ textAlign: 'left', marginTop: '8px' }}>
        <li>Limpiar la caché del navegador</li>
        <li>Usar el modo incógnito</li>
        <li>Actualizar el navegador a la última versión</li>
      </ul>
    </Typography>
  </Box>
);

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading, error } = useAuth();
  const location = useLocation();
  const isMobile = useMediaQuery('(max-width:600px)');
  
  useEffect(() => {
    console.log('PrivateRoute - Auth State:', { 
      isAuthenticated, 
      loading, 
      error,
      path: location.pathname,
      isMobile
    });
  }, [isAuthenticated, loading, error, location.pathname, isMobile]);
  
  if (error) {
    return <ErrorScreen message={error} />;
  }
  
  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: 'background.default'
        }}
      >
        <CircularProgress />
      </Box>
    );
  }
  
  if (!isAuthenticated) {
    console.log('PrivateRoute - Redirecting to login');
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }
  
  return <>{children}</>;
};

// Componente para las rutas de administración
const AdminRoutes = () => {
  const location = useLocation();
  const { isAuthenticated, loading } = useAuth();
  
  // Si estamos en /admin o /admin/, redirigir a /admin/dashboard
  if (location.pathname === '/admin' || location.pathname === '/admin/') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  // Si no está autenticado y no está en login o setup, redirigir a login
  if (!isAuthenticated && !loading && !location.pathname.includes('/admin/login') && !location.pathname.includes('/admin/setup')) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route path="setup" element={<SetupAdmin />} />
      <Route
        element={
          <PrivateRoute>
            <AdminLayout />
          </PrivateRoute>
        }
      >
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="meters" element={<MetersManagement />} />
        <Route path="users" element={<UsersManagement />} />
        <Route path="readings" element={<ReadingsManagement />} />
        <Route path="reports/readings" element={<ReadingsReport />} />
        <Route path="reports/comments" element={<CommentsReport />} />
        <Route index element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  );
};

function App() {
  const isMobile = useMediaQuery('(max-width:600px)');
  
  useEffect(() => {
    console.log('App - Initializing', {
      isMobile,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    });
  }, [isMobile]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Routes>
          {/* Rutas públicas */}
          <Route path="/" element={<Home />} />
          <Route path="/readings" element={<Readings />} />
          
          {/* Rutas de administración */}
          <Route path="/admin/*" element={<AdminRoutes />} />

          {/* Ruta 404 */}
          <Route path="*" element={<ErrorScreen message="Página no encontrada" />} />
        </Routes>
      </AuthProvider>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
        style={{ 
          fontSize: '14px',
          zIndex: 9999
        }}
        toastClassName="custom-toast"
        bodyClassName="custom-toast-body"
        closeButton={true}
        limit={1}
      />
    </ThemeProvider>
  );
}

export default App;
