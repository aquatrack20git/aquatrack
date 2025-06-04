import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../contexts/AuthContext';

const ChangePassword: React.FC = () => {
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validaciones
      if (formData.newPassword !== formData.confirmPassword) {
        throw new Error('Las contraseñas nuevas no coinciden');
      }

      if (formData.newPassword.length < 6) {
        throw new Error('La contraseña debe tener al menos 6 caracteres');
      }

      if (formData.newPassword === formData.currentPassword) {
        throw new Error('La nueva contraseña debe ser diferente a la actual');
      }

      // Verificar la contraseña actual
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: formData.currentPassword,
      });

      if (signInError) {
        throw new Error('La contraseña actual es incorrecta');
      }

      // Actualizar la contraseña
      const { error: updateError } = await supabase.auth.updateUser({
        password: formData.newPassword
      });

      if (updateError) {
        throw updateError;
      }

      // Actualizar el estado en la tabla de usuarios
      const { error: userUpdateError } = await supabase
        .from('users')
        .update({ requires_password_change: false })
        .eq('id', user?.id);

      if (userUpdateError) {
        throw userUpdateError;
      }

      // Redirigir al dashboard
      navigate('/admin/dashboard');
    } catch (error: any) {
      setError(error.message || 'Error al cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box sx={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Paper elevation={3} sx={{ padding: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <Typography variant="h5" component="h1" gutterBottom>
            Cambio de Contraseña Obligatorio
          </Typography>
          <Typography variant="body1" align="center" color="text.secondary" sx={{ mb: 3 }}>
            Por seguridad, debes cambiar tu contraseña antes de continuar.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
            <TextField
              margin="normal"
              required
              fullWidth
              label="Contraseña actual"
              name="currentPassword"
              type="password"
              value={formData.currentPassword}
              onChange={handleInputChange}
              disabled={loading}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              label="Nueva contraseña"
              name="newPassword"
              type="password"
              value={formData.newPassword}
              onChange={handleInputChange}
              disabled={loading}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              label="Confirmar nueva contraseña"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              disabled={loading}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3 }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Cambiar Contraseña'}
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default ChangePassword; 