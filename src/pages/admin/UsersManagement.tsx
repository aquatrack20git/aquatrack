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
  Tooltip,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon, Download as DownloadIcon } from '@mui/icons-material';
import { supabase } from '../../config/supabase';
import { usePermissions } from '../../contexts/PermissionsContext';
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
  const { canCreate, canEdit, canDelete, canDownload } = usePermissions();
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
            emailRedirectTo: `${window.location.origin}/admin/verify-email`
          }
        });

        if (authError) {
          console.error('Error al crear usuario en auth:', authError);
          throw new Error(`Error al crear usuario: ${authError.message}`);
        }

        if (!authData.user) {
          throw new Error('No se pudo crear el usuario');
        }

        // Crear el registro en la tabla de usuarios
        const { error: insertError } = await supabase
          .from('users')
          .insert([
            {
            id: authData.user.id,
            email: formData.email,
            full_name: formData.full_name,
            role: formData.role,
              status: 'pending', // El usuario estará pendiente hasta que verifique su email
            },
          ]);

        if (insertError) {
          console.error('Error al crear usuario en la tabla:', insertError);
          throw new Error(`Error al crear usuario en la base de datos: ${insertError.message}`);
        }

        showSnackbar('Usuario creado exitosamente. Se ha enviado un correo de verificación.');
      handleClose();
      fetchUsers();
      }
    } catch (error: any) {
      console.error('Error completo en handleSubmit:', error);
      showSnackbar(error.message || 'Error al guardar el usuario', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este usuario?')) {
      try {
        // Primero eliminar el usuario de la tabla users
        const { error } = await supabase
          .from('users')
          .delete()
          .eq('id', id);

        if (error) {
          console.error('Error al eliminar usuario de la tabla users:', error);
          throw new Error('Error al eliminar el usuario de la base de datos');
        }

        // Luego eliminar el usuario de auth.users usando la API pública
        const { error: authError } = await supabase.rpc('delete_user', { user_id: id });
        
        if (authError) {
          console.error('Error al eliminar usuario de auth:', authError);
          // Si falla la eliminación en auth.users, intentamos restaurar el usuario en la tabla users
          const { error: restoreError } = await supabase
            .from('users')
            .insert([{ id, email: users.find(u => u.id === id)?.email }]);
          
          if (restoreError) {
            console.error('Error al restaurar usuario en la tabla users:', restoreError);
          }
          throw new Error('Error al eliminar el usuario del sistema de autenticación');
        }

        showSnackbar('Usuario eliminado exitosamente');
        fetchUsers();
      } catch (error: any) {
        console.error('Error deleting user:', error);
        showSnackbar(error.message || 'Error al eliminar el usuario', 'error');
      }
    }
  };

  const handleDownload = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Convertir datos a CSV
      const headers = ['ID', 'Email', 'Nombre Completo', 'Rol', 'Estado', 'Fecha de Creación'];
      const csvData = data.map(user => [
        user.id,
        user.email,
        user.full_name,
        user.role === 'admin' ? 'Administrador' : 'Usuario',
        user.status === 'active' ? 'Activo' : 'Inactivo',
        new Date(user.created_at).toLocaleString()
      ]);

      const csvContent = [
        headers.join(','),
        ...csvData.map(row => row.join(','))
      ].join('\n');

      // Crear y descargar archivo
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `usuarios_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error: any) {
      console.error('Error al descargar usuarios:', error);
      setError(error.message);
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" component="h1">
          Gestión de Usuarios
        </Typography>
        <Box>
          {canDownload && (
            <Tooltip title="Descargar usuarios">
              <IconButton onClick={handleDownload} color="primary">
                <DownloadIcon />
              </IconButton>
            </Tooltip>
          )}
          {canCreate && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpen()}
              sx={{ ml: 1 }}
            >
              Nuevo Usuario
            </Button>
          )}
        </Box>
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
              {(canEdit || canDelete) && <TableCell>Acciones</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No hay usuarios registrados
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.full_name}</TableCell>
                  <TableCell>{user.role === 'admin' ? 'Administrador' : 'Usuario'}</TableCell>
                  <TableCell>{user.status === 'active' ? 'Activo' : 'Inactivo'}</TableCell>
                  <TableCell>
                    {new Date(user.created_at).toLocaleString()}
                  </TableCell>
                  {(canEdit || canDelete) && (
                    <TableCell>
                      {canEdit && (
                        <Tooltip title="Editar usuario">
                          <IconButton
                            size="small"
                            onClick={() => handleOpen(user)}
                            color="primary"
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      {canDelete && (
                        <Tooltip title="Eliminar usuario">
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(user.id)}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
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