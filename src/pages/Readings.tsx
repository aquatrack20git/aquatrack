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
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Image as ImageIcon } from '@mui/icons-material';
import { supabase } from '../config/supabase';
import type { Reading, Meter } from '../types';
import { getCurrentPeriod } from '../utils/periodUtils';

const Readings = () => {
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
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (reading?: Reading) => {
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
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
      } catch (error) {
        console.error('Error uploading image:', error);
        setError('Error al subir la imagen');
      }
    }
  };

  const handleSubmit = async () => {
    try {
      // Validar que el valor sea un número
      const value = parseFloat(formData.value);
      if (isNaN(value)) {
        throw new Error('El valor debe ser un número');
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
      }

      handleCloseDialog();
      fetchData();
    } catch (error: any) {
      console.error('Error saving reading:', error);
      setError(error.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Está seguro de eliminar esta lectura?')) {
      try {
        const { error } = await supabase
          .from('readings')
          .delete()
          .eq('id', id);

        if (error) throw error;
        fetchData();
      } catch (error) {
        console.error('Error deleting reading:', error);
        setError('Error al eliminar la lectura');
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

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Lecturas</Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={() => handleOpenDialog()}
        >
          Nueva Lectura
        </Button>
      </Box>

      <Box mb={3}>
        <TextField
          select
          label="Período"
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
          fullWidth
        >
          {Array.from(new Set(readings.map(r => r.period))).map((period) => (
            <MenuItem key={period} value={period}>
              {period}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      {error && (
        <Box mb={3}>
          <Typography color="error">{error}</Typography>
        </Box>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Código Medidor</TableCell>
              <TableCell>Valor</TableCell>
              <TableCell>Período</TableCell>
              <TableCell>Foto</TableCell>
              <TableCell>Fecha</TableCell>
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {readings.map((reading) => (
              <TableRow key={reading.id}>
                <TableCell>{reading.meter_id}</TableCell>
                <TableCell>{reading.value}</TableCell>
                <TableCell>{reading.period}</TableCell>
                <TableCell>
                  {reading.photo_url && (
                    <IconButton
                      color="primary"
                      onClick={() => window.open(reading.photo_url, '_blank')}
                    >
                      <ImageIcon />
                    </IconButton>
                  )}
                </TableCell>
                <TableCell>
                  {new Date(reading.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <IconButton
                    color="primary"
                    onClick={() => handleOpenDialog(reading)}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    color="error"
                    onClick={() => handleDelete(reading.id)}
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
          {editingReading ? 'Editar Lectura' : 'Nueva Lectura'}
        </DialogTitle>
        <DialogContent>
          <TextField
            select
            fullWidth
            label="Medidor"
            value={formData.meter_id}
            onChange={(e) => setFormData({ ...formData, meter_id: e.target.value })}
            margin="normal"
            required
            disabled={!!editingReading}
          >
            {meters.map((meter) => (
              <MenuItem key={meter.code_meter} value={meter.code_meter}>
                {meter.code_meter} - {meter.location}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            label="Valor"
            type="number"
            value={formData.value}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                setFormData({ ...formData, value });
              }
            }}
            margin="normal"
            required
            inputProps={{ step: "any" }}
          />
          <TextField
            fullWidth
            label="Período"
            value={formData.period}
            onChange={(e) => setFormData({ ...formData, period: e.target.value })}
            margin="normal"
            required
            disabled={!!editingReading}
          />
          <Button
            variant="contained"
            component="label"
            fullWidth
            sx={{ mt: 2 }}
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
            <Box mt={2}>
              <img
                src={imagePreview}
                alt="Preview"
                style={{ maxWidth: '100%', maxHeight: '200px' }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button onClick={handleSubmit} variant="contained" color="primary">
            {editingReading ? 'Actualizar' : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Readings; 