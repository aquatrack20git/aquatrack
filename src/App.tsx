import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, Typography, Alert, useMediaQuery, CircularProgress } from '@mui/material';
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
import ChangePassword from './pages/admin/ChangePassword';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Readings from './pages/Readings';
import VerifyEmail from './pages/admin/VerifyEmail';

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

// Lista de rutas válidas protegidas
const validProtectedRoutes = [
  '/admin/dashboard',
  '/admin/meters',
  '/admin/users',
  '/admin/readings',
  '/admin/reports/readings',
  '/admin/reports/comments',
  '/admin/change-password'
];

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading, error } = useAuth();
  const location = useLocation();
  const isMobile = useMediaQuery('(max-width:600px)');
  
  useEffect(() => {
    console.log('PrivateRoute - Estado de autenticación:', { 
      isAuthenticated, 
      loading, 
      error,
      path: location.pathname,
      isMobile,
      timestamp: new Date().toISOString()
    });
  }, [isAuthenticated, loading, error, location.pathname, isMobile]);

  // Verificar si la ruta actual es válida
  const isValidRoute = validProtectedRoutes.some(route => location.pathname === route);
  
  if (error) {
    console.log('PrivateRoute - Mostrando pantalla de error:', error);
    return <ErrorScreen message={error} />;
  }
  
  if (loading) {
    console.log('PrivateRoute - Mostrando pantalla de carga');
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
    console.log('PrivateRoute - Redirigiendo a login desde:', location.pathname);
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  // Si la ruta no es válida, redirigir al dashboard
  if (!isValidRoute) {
    console.log('PrivateRoute - Ruta protegida no válida detectada:', location.pathname);
    return <Navigate to="/admin/dashboard" replace />;
  }
  
  console.log('PrivateRoute - Renderizando contenido protegido');
  return <>{children}</>;
};

// Componente para las rutas de administración
const AdminRoutes = () => {
  const location = useLocation();
  const { isAuthenticated, loading } = useAuth();
  
  console.log('AdminRoutes - Estado actual:', {
    path: location.pathname,
    isAuthenticated,
    loading,
    timestamp: new Date().toISOString()
  });

  // Lista de rutas públicas que no requieren autenticación
  const publicRoutes = ['/admin/login', '/admin/setup', '/admin/verify-email'];

  // Si estamos en /admin o /admin/, redirigir según el estado de autenticación
  if (location.pathname === '/admin' || location.pathname === '/admin/') {
    console.log('AdminRoutes - Redirigiendo desde /admin');
    if (!isAuthenticated && !loading) {
      console.log('AdminRoutes - Redirigiendo a login (no autenticado)');
      return <Navigate to="/admin/login" replace />;
    }
    console.log('AdminRoutes - Redirigiendo a dashboard (autenticado)');
    return <Navigate to="/admin/dashboard" replace />;
  }

  // Verificar si la ruta actual es una ruta pública válida
  const isPublicRoute = publicRoutes.some(route => location.pathname === route);

  // Si no está autenticado y no está en una ruta pública, redirigir a login
  if (!isAuthenticated && !loading && !isPublicRoute) {
    console.log('AdminRoutes - Redirigiendo a login desde:', location.pathname);
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  // Si está autenticado y está intentando acceder a una ruta pública, redirigir al dashboard
  if (isAuthenticated && !loading && isPublicRoute) {
    console.log('AdminRoutes - Redirigiendo al dashboard desde ruta pública:', location.pathname);
    return <Navigate to="/admin/dashboard" replace />;
  }

  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route path="setup" element={<SetupAdmin />} />
      <Route path="verify-email" element={<VerifyEmail />} />
      <Route path="change-password" element={<ChangePassword />} />
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
      {/* Ruta 404 para rutas de admin no encontradas */}
      <Route path="*" element={<Navigate to="/admin/login" replace />} />
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
    </ThemeProvider>
  );
}

export default App;
