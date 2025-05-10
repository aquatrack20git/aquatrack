import { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { supabase } from '../config/supabase';
import type { Meter } from '../types';

const Meters = () => {
  const [meters, setMeters] = useState<Meter[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingMeter, setEditingMeter] = useState<Meter | null>(null);
  const [formData, setFormData] = useState({
    code_meter: '',
    location: '',
    description: '',
    status: 'active',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMeters();
  }, []);

  const fetchMeters = async () => {
    try {
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

  const handleOpenDialog = (meter?: Meter) => {
    if (meter) {
      setEditingMeter(meter);
      setFormData({
        code_meter: meter.code_meter,
        location: meter.location || '',
        description: meter.description || '',
        status: meter.status,
      });
    } else {
      setEditingMeter(null);
      setFormData({
        code_meter: '',
        location: '',
        description: '',
        status: 'active',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingMeter(null);
    setError(null);
  };

  const handleSubmit = async () => {
    try {
      if (editingMeter) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('No tienes permisos para editar medidores');
        }

        const { error } = await supabase
          .from('meters')
          .update({
            location: formData.location,
            description: formData.description,
            status: formData.status,
          })
          .eq('code_meter', editingMeter.code_meter);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('meters')
          .insert([{
            code_meter: formData.code_meter,
            location: formData.location,
            description: formData.description,
            status: formData.status,
            created_at: new Date().toISOString(),
          }]);

        if (error) throw error;
      }

      handleCloseDialog();
      fetchMeters();
    } catch (error: any) {
      console.error('Error saving meter:', error);
      setError(error.message);
    }
  };

  const handleDelete = async (code_meter: string) => {
    if (window.confirm('¿Está seguro de eliminar este medidor?')) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('No tienes permisos para eliminar medidores');
        }

        const { error } = await supabase
          .from('meters')
          .delete()
          .eq('code_meter', code_meter);

        if (error) throw error;
        fetchMeters();
      } catch (error: any) {
        console.error('Error deleting meter:', error);
        setError(error.message);
      }
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Medidores</Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={() => handleOpenDialog()}
        >
          Nuevo Medidor
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Código</TableCell>
              <TableCell>Ubicación</TableCell>
              <TableCell>Descripción</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {meters.map((meter) => (
              <TableRow key={meter.code_meter}>
                <TableCell>{meter.code_meter}</TableCell>
                <TableCell>{meter.location}</TableCell>
                <TableCell>{meter.description}</TableCell>
                <TableCell>{meter.status}</TableCell>
                <TableCell>
                  <IconButton
                    color="primary"
                    onClick={() => handleOpenDialog(meter)}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    color="error"
                    onClick={() => handleDelete(meter.code_meter)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openDialog} onClose={handleCloseDialog}>
        <DialogTitle>
          {editingMeter ? 'Editar Medidor' : 'Nuevo Medidor'}
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            fullWidth
            label="Código del medidor"
            value={formData.code_meter}
            onChange={(e) => setFormData({ ...formData, code_meter: e.target.value })}
            margin="normal"
            required
            disabled={!!editingMeter}
          />
          <TextField
            fullWidth
            label="Ubicación"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Descripción"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            margin="normal"
            multiline
            rows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button onClick={handleSubmit} variant="contained" color="primary">
            {editingMeter ? 'Guardar' : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Meters; 