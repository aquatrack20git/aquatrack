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
  MenuItem,
  Alert,
  Snackbar,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Image as ImageIcon } from '@mui/icons-material';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Reading, Meter } from '../types';
import { getCurrentPeriod } from '../utils/periodUtils';

const Readings = () => {
  const { isAuthenticated } = useAuth();
  const [readings, setReadings] = useState<Reading[]>([]);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingReading, setEditingReading] = useState<Reading | null>(null);
  const [formData, setFormData] = useState({
    meter_id: '',
    value: '',
    period: getCurrentPeriod(),
  });
  const [selectedPeriod, setSelectedPeriod] = useState(getCurrentPeriod());
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error'
  });

  useEffect(() => {
    fetchData();
  }, [selectedPeriod]);

  const fetchData = async () => {
    try {
      // Fetch meters
      const { data: metersData, error: metersError } = await supabase
        .from('meters')
        .select('code_meter, location, description, status, created_at')
        .order('code_meter');

      if (metersError) throw metersError;
      setMeters(metersData || []);

      // Fetch readings
      const { data: readingsData, error: readingsError } = await supabase
        .from('readings')
        .select('*')
        .eq('period', selectedPeriod)
        .order('created_at', { ascending: false });

      if (readingsError) throw readingsError;
      setReadings(readingsData || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      setError('Error al cargar los datos');
      showSnackbar('Error al cargar los datos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (reading?: Reading) => {
    if (!isAuthenticated) {
      showSnackbar('Debes iniciar sesión para realizar esta acción', 'error');
      return;
    }

    if (reading) {
      setEditingReading(reading);
      setFormData({
        meter_id: reading.meter_id,
        value: reading.value.toString(),
        period: reading.period,
      });
      if (reading.photo_url) {
        setImagePreview(reading.photo_url);
      }
    } else {
      setEditingReading(null);
      setFormData({
        meter_id: '',
        value: '',
        period: getCurrentPeriod(),
      });
      setImagePreview(null);
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingReading(null);
    setImagePreview(null);
    setError(null);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAuthenticated) {
      showSnackbar('Debes iniciar sesión para realizar esta acción', 'error');
      return;
    }

    const file = event.target.files?.[0];
    if (file) {
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${formData.meter_id}-${Date.now()}.${fileExt}`;
        const { error: uploadError, data } = await supabase.storage
          .from('meter-photos')
          .upload(fileName, file);

        if (uploadError) throw uploadError;
        setImagePreview(data.path);
      } catch (error: any) {
        console.error('Error uploading image:', error);
        setError('Error al subir la imagen');
        showSnackbar('Error al subir la imagen', 'error');
      }
    }
  };

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      showSnackbar('Debes iniciar sesión para realizar esta acción', 'error');
      return;
    }

    try {
      // Validar que el valor sea un número
      const value = parseFloat(formData.value);
      if (isNaN(value)) {
        throw new Error('El valor debe ser un número');
      }

      // Verificar que el medidor existe
      const { data: meter, error: meterError } = await supabase
        .from('meters')
        .select('code_meter')
        .eq('code_meter', formData.meter_id)
        .single();

      if (meterError) {
        throw new Error('El medidor seleccionado no existe');
      }

      if (editingReading) {
        const { error } = await supabase
          .from('readings')
          .update({
            value: value,
            photo_url: imagePreview,
            created_at: new Date().toISOString(),
          })
          .eq('id', editingReading.id);

        if (error) throw error;
        showSnackbar('Lectura actualizada exitosamente');
      } else {
        const { error } = await supabase
          .from('readings')
          .insert([{
            meter_id: formData.meter_id,
            value: value,
            photo_url: imagePreview,
            period: formData.period,
            created_at: new Date().toISOString(),
          }]);

        if (error) throw error;
        showSnackbar('Lectura guardada exitosamente');
      }

      handleCloseDialog();
      fetchData();
    } catch (error: any) {
      console.error('Error saving reading:', error);
      setError(error.message);
      showSnackbar(error.message || 'Error al guardar la lectura', 'error');
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({
      open: true,
      message,
      severity,
    });
  };

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Registro de Consumo de Agua
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <TextField
                select
                label="Período"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                sx={{ minWidth: 200 }}
              >
                {Array.from(new Set(readings.map(r => r.period))).map((period) => (
                  <MenuItem key={period} value={period}>
                    {period}
                  </MenuItem>
                ))}
              </TextField>
              <Button
                variant="contained"
                color="primary"
                onClick={() => handleOpenDialog()}
                disabled={!isAuthenticated}
              >
                Nueva Lectura
              </Button>
            </Box>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Medidor</TableCell>
                    <TableCell>Ubicación</TableCell>
                    <TableCell>Valor</TableCell>
                    <TableCell>Período</TableCell>
                    <TableCell>Fecha</TableCell>
                    <TableCell>Foto</TableCell>
                    <TableCell>Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {readings.map((reading) => (
                    <TableRow key={reading.id}>
                      <TableCell>{reading.meter_id}</TableCell>
                      <TableCell>
                        {meters.find(m => m.code_meter === reading.meter_id)?.location || '-'}
                      </TableCell>
                      <TableCell>{reading.value}</TableCell>
                      <TableCell>{reading.period}</TableCell>
                      <TableCell>
                        {new Date(reading.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {reading.photo_url && (
                          <IconButton
                            size="small"
                            onClick={() => window.open(reading.photo_url, '_blank')}
                          >
                            <ImageIcon />
                          </IconButton>
                        )}
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDialog(reading)}
                          disabled={!isAuthenticated}
                        >
                          <EditIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </Paper>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingReading ? 'Editar Lectura' : 'Nueva Lectura'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Código de Medidor"
              value={formData.meter_id}
              onChange={(e) => {
                // Convertir a mayúsculas y eliminar caracteres no permitidos
                const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                setFormData(prev => ({ ...prev, meter_id: value }));
              }}
              inputProps={{
                style: { textTransform: 'uppercase' },
                pattern: '[A-Z0-9]*',
                title: 'Solo se permiten letras mayúsculas y números',
                maxLength: 50
              }}
              error={!formData.meter_id || !meters.some(m => m.code_meter === formData.meter_id)}
              helperText={!formData.meter_id ? 'El código de medidor es requerido' : 
                         !meters.some(m => m.code_meter === formData.meter_id) ? 
                         'El código de medidor no existe' : ''}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Valor"
              type="number"
              value={formData.value}
              onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Período"
              value={formData.period}
              onChange={(e) => setFormData(prev => ({ ...prev, period: e.target.value }))}
              sx={{ mb: 2 }}
            />
            <Button
              variant="outlined"
              component="label"
              fullWidth
              sx={{ mb: 2 }}
            >
              Subir Foto
              <input
                type="file"
                hidden
                accept="image/*"
                onChange={handleImageUpload}
              />
            </Button>
            {imagePreview && (
              <Box sx={{ mb: 2 }}>
                <img
                  src={imagePreview}
                  alt="Preview"
                  style={{ maxWidth: '100%', maxHeight: 200 }}
                />
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button onClick={handleSubmit} variant="contained" color="primary">
            {editingReading ? 'Actualizar' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Readings; 