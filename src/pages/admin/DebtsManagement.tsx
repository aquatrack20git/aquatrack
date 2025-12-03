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

interface Debt {
  id: number;
  meter_id: string;
  period: string;
  amount: number;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface Meter {
  code_meter: string;
  location: string;
}

const DebtsManagement: React.FC = () => {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(getCurrentPeriod());
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    meter_id: '',
    period: getCurrentPeriod(),
    amount: 0,
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
      fetchDebts();
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

  const fetchDebts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('debts')
        .select('*')
        .eq('period', selectedPeriod)
        .order('meter_id');

      if (error) throw error;
      setDebts(data || []);
    } catch (error: any) {
      console.error('Error fetching debts:', error);
      showSnackbar('Error al cargar deudas', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (debt?: Debt) => {
    if (debt) {
      setSelectedDebt(debt);
      setFormData({
        meter_id: debt.meter_id,
        period: debt.period,
        amount: debt.amount,
        description: debt.description || '',
      });
    } else {
      setSelectedDebt(null);
      setFormData({
        meter_id: '',
        period: selectedPeriod,
        amount: 0,
        description: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedDebt(null);
    setFormData({
      meter_id: '',
      period: selectedPeriod,
      amount: 0,
      description: '',
    });
  };

  const handleSubmit = async () => {
    try {
      if (!formData.meter_id.trim()) {
        showSnackbar('El código del medidor es requerido', 'error');
        return;
      }

      if (formData.amount < 0) {
        showSnackbar('El monto no puede ser negativo', 'error');
        return;
      }

      const debtData = {
        meter_id: formData.meter_id.trim(),
        period: formData.period,
        amount: formData.amount,
        description: formData.description.trim() || null,
      };

      if (selectedDebt) {
        const { error } = await supabase
          .from('debts')
          .update(debtData)
          .eq('id', selectedDebt.id);

        if (error) throw error;
        showSnackbar('Deuda actualizada exitosamente');
      } else {
        const { error } = await supabase
          .from('debts')
          .insert([debtData]);

        if (error) {
          if (error.code === '23505') {
            throw new Error('Ya existe una deuda para este medidor en este período');
          }
          throw error;
        }
        showSnackbar('Deuda creada exitosamente');
      }

      handleCloseDialog();
      fetchDebts();
    } catch (error: any) {
      console.error('Error saving debt:', error);
      showSnackbar(error.message || 'Error al guardar la deuda', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta deuda?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('debts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showSnackbar('Deuda eliminada exitosamente');
      fetchDebts();
    } catch (error: any) {
      console.error('Error deleting debt:', error);
      showSnackbar(error.message || 'Error al eliminar la deuda', 'error');
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
          Gestión de Deudas
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
            Nueva Deuda
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
                <TableCell>Monto</TableCell>
                <TableCell>Descripción</TableCell>
                <TableCell>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {debts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                      No hay deudas registradas para este período
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                debts.map((debt) => {
                  const meter = meters.find(m => m.code_meter === debt.meter_id);
                  return (
                    <TableRow key={debt.id}>
                      <TableCell>{debt.meter_id}</TableCell>
                      <TableCell>{meter?.location || '-'}</TableCell>
                      <TableCell>{debt.period}</TableCell>
                      <TableCell>${debt.amount.toFixed(2)}</TableCell>
                      <TableCell>{debt.description || '-'}</TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDialog(debt)}
                          color="primary"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(debt.id)}
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
          count={debts.length}
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

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedDebt ? 'Editar Deuda' : 'Nueva Deuda'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Medidor</InputLabel>
              <Select
                value={formData.meter_id}
                label="Medidor"
                onChange={(e) => setFormData({ ...formData, meter_id: e.target.value })}
                disabled={!!selectedDebt}
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
            <TextField
              fullWidth
              label="Monto de Deuda"
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
              inputProps={{ min: 0, step: 0.01 }}
              required
            />
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
            {selectedDebt ? 'Actualizar' : 'Crear'}
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

export default DebtsManagement;

