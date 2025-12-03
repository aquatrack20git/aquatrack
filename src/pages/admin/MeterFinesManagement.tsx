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
  TablePagination,
} from '@mui/material';
import { 
  Edit as EditIcon, 
  Delete as DeleteIcon, 
  Add as AddIcon,
} from '@mui/icons-material';
import { supabase } from '../../config/supabase';
import { getCurrentPeriod } from '../../utils/periodUtils';

interface MeterFine {
  id: number;
  meter_id: string;
  period: string;
  fines_reuniones: number;
  fines_mingas: number;
  mora_percentage: number;
  mora_amount: number;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface Meter {
  code_meter: string;
  location: string;
}

const MeterFinesManagement: React.FC = () => {
  const [fines, setFines] = useState<MeterFine[]>([]);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedFine, setSelectedFine] = useState<MeterFine | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(getCurrentPeriod());
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    meter_id: '',
    period: getCurrentPeriod(),
    fines_reuniones: 0,
    fines_mingas: 0,
    mora_percentage: 0,
    mora_amount: 0,
    description: '',
  });
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  useEffect(() => {
    fetchMeters();
    fetchPeriods();
  }, []);

  useEffect(() => {
    if (selectedPeriod) {
      fetchFines();
    }
  }, [selectedPeriod]);

  const fetchMeters = async () => {
    try {
      const { data, error } = await supabase
        .from('meters')
        .select('code_meter, location')
        .eq('status', 'active')
        .order('code_meter');

      if (error) throw error;
      setMeters(data || []);
    } catch (error: any) {
      console.error('Error fetching meters:', error);
      showSnackbar('Error al cargar medidores', 'error');
    }
  };

  const fetchPeriods = async () => {
    try {
      const { data, error } = await supabase
        .from('readings')
        .select('period')
        .order('period', { ascending: false });

      if (error) throw error;

      const uniquePeriods = [...new Set(data?.map(r => r.period) || [])].sort();
      setAvailablePeriods(uniquePeriods);
    } catch (error: any) {
      console.error('Error fetching periods:', error);
    }
  };

  const fetchFines = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('meter_fines')
        .select('*')
        .eq('period', selectedPeriod)
        .order('meter_id');

      if (error) throw error;
      setFines(data || []);
    } catch (error: any) {
      console.error('Error fetching fines:', error);
      showSnackbar('Error al cargar multas', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (fine?: MeterFine) => {
    if (fine) {
      setSelectedFine(fine);
      setFormData({
        meter_id: fine.meter_id,
        period: fine.period,
        fines_reuniones: fine.fines_reuniones,
        fines_mingas: fine.fines_mingas,
        mora_percentage: fine.mora_percentage,
        mora_amount: fine.mora_amount,
        description: fine.description || '',
      });
    } else {
      setSelectedFine(null);
      setFormData({
        meter_id: '',
        period: selectedPeriod,
        fines_reuniones: 0,
        fines_mingas: 0,
        mora_percentage: 0,
        mora_amount: 0,
        description: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedFine(null);
    setFormData({
      meter_id: '',
      period: selectedPeriod,
      fines_reuniones: 0,
      fines_mingas: 0,
      mora_percentage: 0,
      mora_amount: 0,
      description: '',
    });
  };

  const handleSubmit = async () => {
    try {
      if (!formData.meter_id.trim()) {
        showSnackbar('El código del medidor es requerido', 'error');
        return;
      }

      // Obtener deuda para calcular mora si es porcentaje
      let calculatedMora = formData.mora_amount;
      if (formData.mora_percentage > 0) {
        const { data: debtData } = await supabase
          .from('debts')
          .select('amount')
          .eq('meter_id', formData.meter_id)
          .eq('period', formData.period)
          .single();

        const debtAmount = debtData?.amount || 0;
        calculatedMora = debtAmount * (formData.mora_percentage / 100);
      }

      const fineData = {
        meter_id: formData.meter_id.trim(),
        period: formData.period,
        fines_reuniones: formData.fines_reuniones,
        fines_mingas: formData.fines_mingas,
        mora_percentage: formData.mora_percentage,
        mora_amount: calculatedMora,
        description: formData.description.trim() || null,
      };

      if (selectedFine) {
        const { error } = await supabase
          .from('meter_fines')
          .update(fineData)
          .eq('id', selectedFine.id);

        if (error) throw error;
        showSnackbar('Multas actualizadas exitosamente');
      } else {
        const { error } = await supabase
          .from('meter_fines')
          .insert([fineData]);

        if (error) {
          if (error.code === '23505') {
            throw new Error('Ya existen multas para este medidor en este período');
          }
          throw error;
        }
        showSnackbar('Multas creadas exitosamente');
      }

      handleCloseDialog();
      fetchFines();
    } catch (error: any) {
      console.error('Error saving fine:', error);
      showSnackbar(error.message || 'Error al guardar las multas', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar estas multas?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('meter_fines')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showSnackbar('Multas eliminadas exitosamente');
      fetchFines();
    } catch (error: any) {
      console.error('Error deleting fine:', error);
      showSnackbar(error.message || 'Error al eliminar las multas', 'error');
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
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4" component="h1">
          Gestión de Multas y Mora por Medidor
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Período</InputLabel>
            <Select
              value={selectedPeriod}
              label="Período"
              onChange={(e) => setSelectedPeriod(e.target.value)}
            >
              {availablePeriods.map((period) => (
                <MenuItem key={period} value={period}>
                  {period}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Nueva Multa
          </Button>
        </Box>
      </Box>

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Medidor</TableCell>
                <TableCell>Ubicación</TableCell>
                <TableCell>Período</TableCell>
                <TableCell>Multas Reuniones</TableCell>
                <TableCell>Multas Mingas</TableCell>
                <TableCell>Mora %</TableCell>
                <TableCell>Mora Monto</TableCell>
                <TableCell>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {fines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                      No hay multas registradas para este período
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                fines.map((fine) => {
                  const meter = meters.find(m => m.code_meter === fine.meter_id);
                  return (
                    <TableRow key={fine.id}>
                      <TableCell>{fine.meter_id}</TableCell>
                      <TableCell>{meter?.location || '-'}</TableCell>
                      <TableCell>{fine.period}</TableCell>
                      <TableCell>${fine.fines_reuniones.toFixed(2)}</TableCell>
                      <TableCell>${fine.fines_mingas.toFixed(2)}</TableCell>
                      <TableCell>{fine.mora_percentage.toFixed(2)}%</TableCell>
                      <TableCell>${fine.mora_amount.toFixed(2)}</TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDialog(fine)}
                          color="primary"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(fine.id)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={fines.length}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </Paper>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedFine ? 'Editar Multas y Mora' : 'Nueva Multa y Mora'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Medidor</InputLabel>
              <Select
                value={formData.meter_id}
                label="Medidor"
                onChange={(e) => setFormData({ ...formData, meter_id: e.target.value })}
                disabled={!!selectedFine}
              >
                {meters.map((meter) => (
                  <MenuItem key={meter.code_meter} value={meter.code_meter}>
                    {meter.code_meter} - {meter.location}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Período</InputLabel>
              <Select
                value={formData.period}
                label="Período"
                onChange={(e) => setFormData({ ...formData, period: e.target.value })}
              >
                {availablePeriods.map((period) => (
                  <MenuItem key={period} value={period}>
                    {period}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                fullWidth
                label="Multas por Reuniones"
                type="number"
                value={formData.fines_reuniones}
                onChange={(e) => setFormData({ ...formData, fines_reuniones: parseFloat(e.target.value) || 0 })}
                inputProps={{ min: 0, step: 0.01 }}
              />
              <TextField
                fullWidth
                label="Multas por Mingas"
                type="number"
                value={formData.fines_mingas}
                onChange={(e) => setFormData({ ...formData, fines_mingas: parseFloat(e.target.value) || 0 })}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                fullWidth
                label="Porcentaje de Mora"
                type="number"
                value={formData.mora_percentage}
                onChange={(e) => {
                  const percentage = parseFloat(e.target.value) || 0;
                  setFormData({ 
                    ...formData, 
                    mora_percentage: percentage,
                    mora_amount: 0 // Se calculará automáticamente
                  });
                }}
                inputProps={{ min: 0, max: 100, step: 0.01 }}
                helperText="Porcentaje sobre la deuda"
              />
              <TextField
                fullWidth
                label="Monto de Mora (Manual)"
                type="number"
                value={formData.mora_amount}
                onChange={(e) => {
                  setFormData({ 
                    ...formData, 
                    mora_amount: parseFloat(e.target.value) || 0,
                    mora_percentage: 0 // Si se ingresa monto manual, porcentaje = 0
                  });
                }}
                inputProps={{ min: 0, step: 0.01 }}
                helperText="O ingrese monto fijo (sobrescribe porcentaje)"
              />
            </Box>
            <TextField
              fullWidth
              label="Descripción"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              multiline
              rows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button onClick={handleSubmit} variant="contained" color="primary">
            {selectedFine ? 'Actualizar' : 'Crear'}
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

export default MeterFinesManagement;

