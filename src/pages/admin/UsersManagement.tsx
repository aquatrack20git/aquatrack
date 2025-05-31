import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Alert,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import { supabase } from '../../config/supabase';
import { v4 as uuidv4 } from 'uuid';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  created_at: string;
}

const UsersManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    role: 'user',
    status: 'active',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        status: user.status,
      });
    } else {
      setEditingUser(null);
      setFormData({
        email: '',
        full_name: '',
        role: 'user',
        status: 'active',
      });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingUser(null);
    setFormData({
      email: '',
      full_name: '',
      role: 'user',
      status: 'active',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        const { error } = await supabase
          .from('users')
          .update({
            email: formData.email,
            full_name: formData.full_name,
            role: formData.role,
            status: formData.status,
          })
          .eq('id', editingUser.id);

        if (error) throw error;
        showSnackbar('Usuario actualizado exitosamente');
      } else {
        console.log('Iniciando creación de usuario...');
        console.log('Datos del formulario:', formData);

        // Verificar si el usuario ya existe en la tabla users
        const { data: existingUser, error: checkError } = await supabase
          .from('users')
          .select('id')
          .eq('email', formData.email)
          .maybeSingle();

        if (checkError) {
          console.error('Error al verificar usuario existente:', checkError);
          throw checkError;
        }

        if (existingUser) {
          console.log('Usuario ya existe en la tabla users:', existingUser);
          throw new Error('Este correo electrónico ya está registrado en el sistema');
        }

        console.log('Creando usuario en auth.users...');
        // Primero crear el usuario en auth.users
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: 'Temporal123!', // Contraseña temporal que el usuario deberá cambiar
          options: {
            data: {
              full_name: formData.full_name,
              role: formData.role,
            },
            emailRedirectTo: `${window.location.origin}/admin/login`
          }
        });

        if (authError) {
          console.error('Error detallado al crear usuario en auth:', authError);
          throw new Error(`Error al crear usuario de autenticación: ${authError.message}`);
        }

        if (!authData.user) {
          console.error('No se recibió el usuario en la respuesta de signUp');
          throw new Error('No se pudo crear el usuario de autenticación - respuesta vacía');
        }

        console.log('Usuario creado exitosamente en auth.users:', authData.user.id);

        // Esperar un momento para asegurar que el usuario se haya propagado en auth.users
        await new Promise(resolve => setTimeout(resolve, 1000));

        console.log('Intentando crear registro en la tabla users...');
        // Luego crear el registro en la tabla users
        const { error: dbError } = await supabase
          .from('users')
          .insert([{
            id: authData.user.id,
            email: formData.email,
            full_name: formData.full_name,
            role: formData.role,
            status: formData.status,
            created_at: new Date().toISOString()
          }]);

        if (dbError) {
          console.error('Error detallado al crear usuario en la tabla:', dbError);
          // Si falla la inserción en la tabla users, intentar eliminar el usuario de auth
          try {
            // En lugar de usar admin.deleteUser, usamos signOut para limpiar la sesión
            await supabase.auth.signOut();
            console.log('Sesión limpiada después del error');
          } catch (deleteError) {
            console.error('Error al intentar limpiar la sesión:', deleteError);
          }
          throw new Error(`Error al crear usuario en la base de datos: ${dbError.message}`);
        }

        console.log('Usuario creado exitosamente en la tabla users');
        showSnackbar('Usuario creado exitosamente. Se ha enviado un correo para confirmar la cuenta.');
      }
      handleClose();
      fetchUsers();
    } catch (error: any) {
      console.error('Error completo en handleSubmit:', error);
      showSnackbar(error.message || 'Error al guardar el usuario', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este usuario?')) {
      try {
        const { error } = await supabase
          .from('users')
          .delete()
          .eq('id', id);

        if (error) throw error;
        showSnackbar('Usuario eliminado exitosamente');
        fetchUsers();
      } catch (error: any) {
        console.error('Error deleting user:', error);
        showSnackbar(error.message || 'Error al eliminar el usuario', 'error');
      }
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({
      open: true,
      message,
      severity,
    });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Gestión de Usuarios</Typography>
        <Button variant="contained" onClick={() => handleOpen()}>
          Nuevo Usuario
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Email</TableCell>
              <TableCell>Nombre Completo</TableCell>
              <TableCell>Rol</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Fecha de Creación</TableCell>
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.full_name}</TableCell>
                <TableCell>{user.role}</TableCell>
                <TableCell>{user.status}</TableCell>
                <TableCell>
                  {new Date(user.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <IconButton onClick={() => handleOpen(user)} color="primary">
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => handleDelete(user.id)} color="error">
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <TextField
              fullWidth
              label="Email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              margin="normal"
              required
              type="email"
            />
            <TextField
              fullWidth
              label="Nombre Completo"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              margin="normal"
              required
            />
            <FormControl fullWidth margin="normal">
              <InputLabel>Rol</InputLabel>
              <Select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                label="Rol"
              >
                <MenuItem value="admin">Administrador</MenuItem>
                <MenuItem value="user">Usuario</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth margin="normal">
              <InputLabel>Estado</InputLabel>
              <Select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                label="Estado"
              >
                <MenuItem value="active">Activo</MenuItem>
                <MenuItem value="inactive">Inactivo</MenuItem>
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Cancelar</Button>
            <Button type="submit" variant="contained">
              {editingUser ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default UsersManagement; 