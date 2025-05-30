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
  code_meter: string;
  location: string;
  description: string;
  status: string;
  created_at: string;
  identification: string | null;
  email: string | null;
  contact_number: string | null;
}

const MetersManagement: React.FC = () => {
  const [meters, setMeters] = useState<Meter[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedMeter, setSelectedMeter] = useState<Meter | null>(null);
  const [formData, setFormData] = useState({
    code_meter: '',
    location: '',
    description: '',
    status: 'active',
    identification: '',
    email: '',
    contact_number: '',
  });
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMeters();
  }, []);

  const fetchMeters = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('meters')
        .select('*')
        .order('code_meter', { ascending: true });

      if (error) {
        console.error('Error fetching meters:', error);
        throw new Error(error.message);
      }

      setMeters(data || []);
    } catch (error: any) {
      console.error('Error completo:', error);
      showSnackbar(error.message || 'Error al cargar los medidores', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (meter?: Meter) => {
    if (meter) {
      setSelectedMeter(meter);
      setFormData({
        code_meter: meter.code_meter,
        location: meter.location,
        description: meter.description,
        status: meter.status,
        identification: meter.identification || '',
        email: meter.email || '',
        contact_number: meter.contact_number || '',
      });
    } else {
      setSelectedMeter(null);
      setFormData({
        code_meter: '',
        location: '',
        description: '',
        status: 'active',
        identification: '',
        email: '',
        contact_number: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedMeter(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async () => {
    try {
      if (selectedMeter) {
        // Actualizar medidor existente
        const { error } = await supabase
          .from('meters')
          .update({
            location: formData.location,
            description: formData.description,
            status: formData.status,
            identification: formData.identification,
            email: formData.email,
            contact_number: formData.contact_number,
          })
          .eq('code_meter', selectedMeter.code_meter);

        if (error) throw error;
        showSnackbar('Medidor actualizado exitosamente');
      } else {
        // Crear nuevo medidor
        const { error } = await supabase
          .from('meters')
          .insert([{
            code_meter: formData.code_meter,
            location: formData.location,
            description: formData.description,
            status: formData.status,
            identification: formData.identification,
            email: formData.email,
            contact_number: formData.contact_number,
            created_at: new Date().toISOString(),
          }]);

        if (error) throw error;
        showSnackbar('Medidor creado exitosamente');
      }

      handleCloseDialog();
      fetchMeters();
    } catch (error: any) {
      console.error('Error saving meter:', error);
      showSnackbar(error.message || 'Error al guardar el medidor', 'error');
    }
  };

  const handleDelete = async (code_meter: string) => {
    if (window.confirm('¿Está seguro de eliminar este medidor?')) {
      try {
        const { error } = await supabase
          .from('meters')
          .delete()
          .eq('code_meter', code_meter);

        if (error) throw error;
        showSnackbar('Medidor eliminado exitosamente');
        fetchMeters();
      } catch (error: any) {
        console.error('Error deleting meter:', error);
        showSnackbar(error.message || 'Error al eliminar el medidor', 'error');
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
        <Typography variant="h4">Gestión de Medidores</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
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
              <TableCell>Apellidos y Nombres</TableCell>
              <TableCell>Identificación</TableCell>
              <TableCell>Correo</TableCell>
              <TableCell>Contacto</TableCell>
              <TableCell>Ubicación</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Fecha de Creación</TableCell>
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {meters.map((meter) => (
              <TableRow key={meter.code_meter}>
                <TableCell>{meter.code_meter}</TableCell>
                <TableCell>{meter.description}</TableCell>
                <TableCell>{meter.identification || '-'}</TableCell>
                <TableCell>{meter.email || '-'}</TableCell>
                <TableCell>{meter.contact_number || '-'}</TableCell>
                <TableCell>{meter.location}</TableCell>
                <TableCell>{meter.status}</TableCell>
                <TableCell>{new Date(meter.created_at).toLocaleDateString()}</TableCell>
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

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedMeter ? 'Editar Medidor' : 'Nuevo Medidor'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              name="code_meter"
              label="Código del Medidor"
              value={formData.code_meter}
              onChange={handleInputChange}
              fullWidth
              required
              disabled={!!selectedMeter}
            />
            <TextField
              name="location"
              label="Ubicación"
              value={formData.location}
              onChange={handleInputChange}
              fullWidth
              required
            />
            <TextField
              name="description"
              label="Apellidos y Nombres"
              value={formData.description}
              onChange={handleInputChange}
              fullWidth
              multiline
              rows={3}
            />
            <TextField
              name="identification"
              label="Identificación (DNI/RUC)"
              value={formData.identification}
              onChange={handleInputChange}
              fullWidth
              inputProps={{ maxLength: 20 }}
            />
            <TextField
              name="email"
              label="Correo Electrónico"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              fullWidth
              inputProps={{ maxLength: 255 }}
            />
            <TextField
              name="contact_number"
              label="Número de Contacto"
              value={formData.contact_number}
              onChange={handleInputChange}
              fullWidth
              inputProps={{ maxLength: 20 }}
            />
            <TextField
              name="status"
              label="Estado"
              value={formData.status}
              onChange={handleInputChange}
              fullWidth
              required
              select
              SelectProps={{ native: true }}
            >
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
              <option value="maintenance">En Mantenimiento</option>
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button onClick={handleSubmit} variant="contained">
            {selectedMeter ? 'Actualizar' : 'Crear'}
          </Button>
        </DialogActions>
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