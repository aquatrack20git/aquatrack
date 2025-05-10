import React, { useState } from 'react';
import {
  Box,
  Typography,
  Alert,
  TextField,
  Button,
  Paper,
  Container,
} from '@mui/material';
import { supabase } from '../../config/supabase';

const SetupAdmin: React.FC = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setMessage('');

    try {
      // Validaciones
      if (formData.password !== formData.confirmPassword) {
        throw new Error('Las contraseñas no coinciden');
      }

      if (formData.password.length < 6) {
        throw new Error('La contraseña debe tener al menos 6 caracteres');
      }

      console.log('Iniciando proceso de registro...');

      // Verificar si el usuario existe en la tabla de usuarios
      const { data: existingUser, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', formData.email)
        .maybeSingle();

      if (userError) {
        console.error('Error al verificar usuario en la tabla:', userError);
        throw new Error(`Error al verificar usuario existente: ${userError.message}`);
      }

      if (existingUser) {
        throw new Error('Este correo electrónico ya está registrado');
      }

      console.log('Creando usuario en auth...');

      // Crear el usuario en la autenticación de Supabase
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/admin/login`,
          data: {
            role: 'admin',
          },
        },
      });

      if (signUpError) {
        console.error('Error en signUp:', signUpError);
        throw new Error(`Error al crear usuario: ${signUpError.message}`);
      }

      if (!signUpData.user) {
        console.error('No se recibió el usuario en la respuesta de signUp');
        throw new Error('No se pudo crear el usuario');
      }

      console.log('Usuario creado en auth:', signUpData.user.id);

      // Crear el registro en la tabla de usuarios
      const { error: insertError } = await supabase
        .from('users')
        .insert([
          {
            id: signUpData.user.id,
            email: formData.email,
            full_name: 'Administrador',
            role: 'admin',
            status: 'active',
          },
        ]);

      if (insertError) {
        console.error('Error al crear usuario en la tabla:', insertError);
        throw new Error(`Error al crear usuario en la base de datos: ${insertError.message}`);
      }

      console.log('Usuario creado exitosamente en la tabla de usuarios');

      setStatus('success');
      setMessage('Por favor, revisa tu correo electrónico para confirmar tu cuenta. Una vez confirmada, podrás iniciar sesión.');
    } catch (error: any) {
      console.error('Error completo:', error);
      setStatus('error');
      setMessage(error.message || 'Error al crear el usuario administrador. Por favor, intenta nuevamente.');
    }
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 4 }}>
        <Paper sx={{ p: 4 }}>
          <Typography variant="h4" gutterBottom align="center">
            Configuración del Administrador
          </Typography>

          <form onSubmit={handleSubmit}>
            <TextField
              margin="normal"
              required
              fullWidth
              label="Correo electrónico"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              error={status === 'error' && message.includes('correo')}
              helperText={status === 'error' && message.includes('correo') ? message : ''}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              label="Contraseña"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleInputChange}
              error={status === 'error' && message.includes('contraseña')}
              helperText={status === 'error' && message.includes('contraseña') ? message : ''}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              label="Confirmar contraseña"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              error={status === 'error' && message.includes('coinciden')}
              helperText={status === 'error' && message.includes('coinciden') ? message : ''}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3 }}
              disabled={status === 'loading'}
            >
              {status === 'loading' ? 'Creando cuenta...' : 'Crear cuenta de administrador'}
            </Button>
          </form>

          {status === 'success' && (
            <Alert severity="success" sx={{ mt: 2 }}>
              {message}
            </Alert>
          )}

          {status === 'error' && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {message}
            </Alert>
          )}
        </Paper>
      </Box>
    </Container>
  );
};

export default SetupAdmin; 