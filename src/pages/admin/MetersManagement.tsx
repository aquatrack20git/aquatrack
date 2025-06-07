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
  CircularProgress,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import { supabase } from '../../config/supabase';

interface Meter {
  id: string;
  serial_number: string;
  brand: string;
  model: string;
  installation_date: string;
  status: string;
  created_at: string;
}

const MetersManagement: React.FC = () => {
  const [meters, setMeters] = useState<Meter[]>([]);
  const [open, setOpen] = useState(false);
  const [editingMeter, setEditingMeter] = useState<Meter | null>(null);
  const [formData, setFormData] = useState({
    serial_number: '',
    brand: '',
    model: '',
    installation_date: '',
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
    fetchMeters();
  }, []);

  const fetchMeters = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('meters')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMeters(data || []);
    } catch (error: any) {
      console.error('Error fetching meters:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (meter?: Meter) => {
    if (meter) {
      setEditingMeter(meter);
      setFormData({
        serial_number: meter.serial_number,
        brand: meter.brand,
        model: meter.model,
        installation_date: meter.installation_date,
        status: meter.status,
      });
    } else {
      setEditingMeter(null);
      setFormData({
        serial_number: '',
        brand: '',
        model: '',
        installation_date: '',
        status: 'active',
      });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingMeter(null);
    setFormData({
      serial_number: '',
      brand: '',
      model: '',
      installation_date: '',
      status: 'active',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingMeter) {
        const { error } = await supabase
          .from('meters')
          .update({
            serial_number: formData.serial_number,
            brand: formData.brand,
            model: formData.model,
            installation_date: formData.installation_date,
            status: formData.status,
          })
          .eq('id', editingMeter.id);

        if (error) throw error;
        showSnackbar('Medidor actualizado exitosamente');
      } else {
        const { error } = await supabase
          .from('meters')
          .insert([{
            serial_number: formData.serial_number,
            brand: formData.brand,
            model: formData.model,
            installation_date: formData.installation_date,
            status: formData.status,
          }]);

        if (error) throw error;
        showSnackbar('Medidor creado exitosamente');
      }

      handleClose();
      fetchMeters();
    } catch (error: any) {
      console.error('Error saving meter:', error);
      setError(error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Está seguro de eliminar este medidor?')) {
      try {
        const { error } = await supabase
          .from('meters')
          .delete()
          .eq('id', id);

        if (error) throw error;
        showSnackbar('Medidor eliminado exitosamente');
        fetchMeters();
      } catch (error: any) {
        console.error('Error deleting meter:', error);
        setError(error.message);
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

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Gestión de Medidores</Typography>
        <Button variant="contained" onClick={() => handleOpen()}>
          Nuevo Medidor
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
              <TableCell>Número de Serie</TableCell>
              <TableCell>Marca</TableCell>
              <TableCell>Modelo</TableCell>
              <TableCell>Fecha de Instalación</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Fecha de Creación</TableCell>
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : meters.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  No hay medidores registrados
                </TableCell>
              </TableRow>
            ) : (
              meters.map((meter) => (
                <TableRow key={meter.id}>
                  <TableCell>{meter.serial_number}</TableCell>
                  <TableCell>{meter.brand}</TableCell>
                  <TableCell>{meter.model}</TableCell>
                  <TableCell>
                    {new Date(meter.installation_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{meter.status === 'active' ? 'Activo' : 'Inactivo'}</TableCell>
                  <TableCell>
                    {new Date(meter.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <IconButton onClick={() => handleOpen(meter)} color="primary">
                      <EditIcon />
                    </IconButton>
                    <IconButton onClick={() => handleDelete(meter.id)} color="error">
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingMeter ? 'Editar Medidor' : 'Nuevo Medidor'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <TextField
              fullWidth
              label="Número de Serie"
              value={formData.serial_number}
              onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Marca"
              value={formData.brand}
              onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Modelo"
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Fecha de Instalación"
              type="date"
              value={formData.installation_date}
              onChange={(e) => setFormData({ ...formData, installation_date: e.target.value })}
              margin="normal"
              required
              InputLabelProps={{
                shrink: true,
              }}
            />
            <TextField
              fullWidth
              select
              label="Estado"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              margin="normal"
              required
            >
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Cancelar</Button>
            <Button type="submit" variant="contained" color="primary">
              {editingMeter ? 'Actualizar' : 'Guardar'}
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

export default MetersManagement; 