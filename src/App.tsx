import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
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

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading } = useAuth();
  console.log('PrivateRoute - Auth State:', { isAuthenticated, loading });
  
  if (loading) {
    console.log('PrivateRoute - Loading state, showing nothing');
    return null;
  }
  
  console.log('PrivateRoute - Rendering:', isAuthenticated ? 'Protected Content' : 'Redirect to Login');
  return isAuthenticated ? <>{children}</> : <Navigate to="/admin/login" />;
};

function App() {
  console.log('App - Initializing');
  
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/admin/login" element={<Login />} />
            <Route path="/admin/setup" element={<SetupAdmin />} />
            <Route
              path="/admin"
              element={
                <PrivateRoute>
                  <AdminLayout />
                </PrivateRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="meters" element={<MetersManagement />} />
              <Route path="users" element={<UsersManagement />} />
              <Route path="readings" element={<ReadingsManagement />} />
              <Route path="reports/readings" element={<ReadingsReport />} />
              <Route path="reports/comments" element={<CommentsReport />} />
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
      <ToastContainer
        position="top-center"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </ThemeProvider>
  );
}

export default App;
