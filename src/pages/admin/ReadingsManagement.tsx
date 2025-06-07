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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import { supabase } from '../../config/supabase';

interface Reading {
  id: string;
  meter_id: string;
  reading_date: string;
  value: number;
  status: string;
  created_at: string;
  meter?: {
    serial_number: string;
  };
}

interface Meter {
  id: string;
  serial_number: string;
}

const ReadingsManagement: React.FC = () => {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [open, setOpen] = useState(false);
  const [editingReading, setEditingReading] = useState<Reading | null>(null);
  const [formData, setFormData] = useState({
    meter_id: '',
    reading_date: '',
    value: '',
    status: 'pending',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  });

  useEffect(() => {
    fetchReadings();
    fetchMeters();
  }, []);

  const fetchReadings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('readings')
        .select(`
          *,
          meter:meters(serial_number)
        `)
        .order('reading_date', { ascending: false });

      if (error) throw error;
      setReadings(data || []);
    } catch (error: any) {
      console.error('Error fetching readings:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMeters = async () => {
    try {
      const { data, error } = await supabase
        .from('meters')
        .select('id, serial_number')
        .eq('status', 'active')
        .order('serial_number');

      if (error) throw error;
      setMeters(data || []);
    } catch (error: any) {
      console.error('Error fetching meters:', error);
      setError(error.message);
    }
  };

  const handleOpen = (reading?: Reading) => {
    if (reading) {
      setEditingReading(reading);
      setFormData({
        meter_id: reading.meter_id,
        reading_date: reading.reading_date,
        value: reading.value.toString(),
        status: reading.status,
      });
    } else {
      setEditingReading(null);
      setFormData({
        meter_id: '',
        reading_date: '',
        value: '',
        status: 'pending',
      });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingReading(null);
    setFormData({
      meter_id: '',
      reading_date: '',
      value: '',
      status: 'pending',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const readingData = {
        meter_id: formData.meter_id,
        reading_date: formData.reading_date,
        value: parseFloat(formData.value),
        status: formData.status,
      };

      if (editingReading) {
        const { error } = await supabase
          .from('readings')
          .update(readingData)
          .eq('id', editingReading.id);

        if (error) throw error;
        showSnackbar('Lectura actualizada exitosamente');
      } else {
        const { error } = await supabase
          .from('readings')
          .insert([readingData]);

        if (error) throw error;
        showSnackbar('Lectura creada exitosamente');
      }

      handleClose();
      fetchReadings();
    } catch (error: any) {
      console.error('Error saving reading:', error);
      setError(error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Está seguro de eliminar esta lectura?')) {
      try {
        const { error } = await supabase
          .from('readings')
          .delete()
          .eq('id', id);

        if (error) throw error;
        showSnackbar('Lectura eliminada exitosamente');
        fetchReadings();
      } catch (error: any) {
        console.error('Error deleting reading:', error);
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
        <Typography variant="h4">Gestión de Lecturas</Typography>
        <Button variant="contained" onClick={() => handleOpen()}>
          Nueva Lectura
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
              <TableCell>Medidor</TableCell>
              <TableCell>Fecha de Lectura</TableCell>
              <TableCell>Valor</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Fecha de Creación</TableCell>
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : readings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No hay lecturas registradas
                </TableCell>
              </TableRow>
            ) : (
              readings.map((reading) => (
                <TableRow key={reading.id}>
                  <TableCell>{reading.meter?.serial_number}</TableCell>
                  <TableCell>
                    {new Date(reading.reading_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{reading.value}</TableCell>
                  <TableCell>
                    {reading.status === 'pending' ? 'Pendiente' :
                     reading.status === 'approved' ? 'Aprobada' : 'Rechazada'}
                  </TableCell>
                  <TableCell>
                    {new Date(reading.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <IconButton onClick={() => handleOpen(reading)} color="primary">
                      <EditIcon />
                    </IconButton>
                    <IconButton onClick={() => handleDelete(reading.id)} color="error">
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
          {editingReading ? 'Editar Lectura' : 'Nueva Lectura'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <FormControl fullWidth margin="normal">
              <InputLabel>Medidor</InputLabel>
              <Select
                value={formData.meter_id}
                onChange={(e) => setFormData({ ...formData, meter_id: e.target.value })}
                label="Medidor"
                required
                disabled={!!editingReading}
              >
                {meters.map((meter) => (
                  <MenuItem key={meter.id} value={meter.id}>
                    {meter.serial_number}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Fecha de Lectura"
              type="date"
              value={formData.reading_date}
              onChange={(e) => setFormData({ ...formData, reading_date: e.target.value })}
              margin="normal"
              required
              InputLabelProps={{
                shrink: true,
              }}
            />
            <TextField
              fullWidth
              label="Valor"
              type="number"
              value={formData.value}
              onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              margin="normal"
              required
              inputProps={{
                step: "0.01",
                min: "0"
              }}
            />
            <FormControl fullWidth margin="normal">
              <InputLabel>Estado</InputLabel>
              <Select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                label="Estado"
                required
              >
                <MenuItem value="pending">Pendiente</MenuItem>
                <MenuItem value="approved">Aprobada</MenuItem>
                <MenuItem value="rejected">Rechazada</MenuItem>
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Cancelar</Button>
            <Button type="submit" variant="contained" color="primary">
              {editingReading ? 'Actualizar' : 'Guardar'}
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

export default ReadingsManagement; 