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
  Chip,
} from '@mui/material';
import { 
  Edit as EditIcon, 
  Delete as DeleteIcon, 
  Add as AddIcon,
} from '@mui/icons-material';
import { supabase } from '../../config/supabase';

interface Tariff {
  id: number;
  name: string;
  description: string | null;
  min_consumption: number;
  max_consumption: number | null;
  price_per_unit: number;
  max_units: number | null;
  fixed_charge: number;
  status: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

const TariffManagement: React.FC = () => {
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedTariff, setSelectedTariff] = useState<Tariff | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    min_consumption: 0,
    max_consumption: '',
    price_per_unit: 0,
    max_units: '',
    fixed_charge: 0,
    status: 'active',
    order_index: 0,
  });
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [previewConsumption, setPreviewConsumption] = useState<number>(30);
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    fetchTariffs();
  }, []);

  const fetchTariffs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tariffs')
        .select('*')
        .order('order_index', { ascending: true })
        .order('min_consumption', { ascending: true });

      if (error) throw error;
      setTariffs(data || []);
    } catch (error: any) {
      console.error('Error fetching tariffs:', error);
      showSnackbar('Error al cargar las tarifas', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (tariff?: Tariff) => {
    if (tariff) {
      setSelectedTariff(tariff);
      setFormData({
        name: tariff.name,
        description: tariff.description || '',
        min_consumption: tariff.min_consumption,
        max_consumption: tariff.max_consumption?.toString() || '',
        price_per_unit: tariff.price_per_unit,
        max_units: tariff.max_units?.toString() || '',
        fixed_charge: tariff.fixed_charge,
        status: tariff.status,
        order_index: tariff.order_index,
      });
    } else {
      setSelectedTariff(null);
      setFormData({
        name: '',
        description: '',
        min_consumption: 0,
        max_consumption: '',
        price_per_unit: 0,
        max_units: '',
        fixed_charge: 0,
        status: 'active',
        order_index: tariffs.length,
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedTariff(null);
    setFormData({
      name: '',
      description: '',
      min_consumption: 0,
      max_consumption: '',
      price_per_unit: 0,
      max_units: '',
      fixed_charge: 0,
      status: 'active',
      order_index: 0,
    });
  };

  const handleSubmit = async () => {
    try {
      if (!formData.name.trim()) {
        showSnackbar('El nombre de la tarifa es requerido', 'error');
        return;
      }

      if (formData.min_consumption < 0) {
        showSnackbar('El consumo mínimo no puede ser negativo', 'error');
        return;
      }

      if (formData.max_consumption && parseFloat(formData.max_consumption) <= formData.min_consumption) {
        showSnackbar('El consumo máximo debe ser mayor al mínimo', 'error');
        return;
      }

      if (formData.price_per_unit < 0 && formData.fixed_charge <= 0) {
        showSnackbar('Debe especificar precio por unidad o cargo fijo', 'error');
        return;
      }

      const tariffData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        min_consumption: formData.min_consumption,
        max_consumption: formData.max_consumption ? parseFloat(formData.max_consumption) : null,
        price_per_unit: formData.price_per_unit,
        max_units: formData.max_units ? parseFloat(formData.max_units) : null,
        fixed_charge: formData.fixed_charge,
        status: formData.status,
        order_index: formData.order_index,
      };

      if (selectedTariff) {
        const { error } = await supabase
          .from('tariffs')
          .update(tariffData)
          .eq('id', selectedTariff.id);

        if (error) throw error;
        showSnackbar('Tarifa actualizada exitosamente');
      } else {
        const { error } = await supabase
          .from('tariffs')
          .insert([tariffData]);

        if (error) throw error;
        showSnackbar('Tarifa creada exitosamente');
      }

      handleCloseDialog();
      fetchTariffs();
    } catch (error: any) {
      console.error('Error saving tariff:', error);
      showSnackbar(error.message || 'Error al guardar la tarifa', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta tarifa?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('tariffs')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showSnackbar('Tarifa eliminada exitosamente');
      fetchTariffs();
    } catch (error: any) {
      console.error('Error deleting tariff:', error);
      showSnackbar(error.message || 'Error al eliminar la tarifa', 'error');
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

  const calculateExample = (tariff: Tariff) => {
    if (tariff.fixed_charge > 0) {
      return `$${tariff.fixed_charge.toFixed(2)} fijo`;
    }
    const exampleConsumption = tariff.max_units || 10;
    const total = (exampleConsumption * tariff.price_per_unit).toFixed(2);
    return `${exampleConsumption} m³ × $${tariff.price_per_unit.toFixed(2)} = $${total}`;
  };

  const calculatePreview = async (testConsumption: number) => {
    try {
      const { calculateBilling } = await import('../../utils/billingUtils');
      return await calculateBilling(testConsumption);
    } catch (error) {
      console.error('Error calculating preview:', error);
      return null;
    }
  };

  const handlePreviewChange = async (value: number) => {
    setPreviewConsumption(value);
    if (value > 0) {
      setLoadingPreview(true);
      const result = await calculatePreview(value);
      setPreviewResult(result);
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    // Recalcular vista previa cuando cambien las tarifas
    if (previewConsumption > 0 && tariffs.length > 0 && !loading) {
      calculatePreview(previewConsumption).then(result => {
        setPreviewResult(result);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tariffs, loading]);

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
          Gestión de Tarifario
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Nueva Tarifa
        </Button>
      </Box>

      {/* Vista previa de cálculo */}
      <Paper sx={{ mb: 3, p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Vista Previa de Cálculo
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Ingresa un consumo de prueba para ver cómo se aplican las tarifas configuradas
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            label="Consumo de prueba (m³)"
            type="number"
            value={previewConsumption}
            onChange={(e) => handlePreviewChange(parseFloat(e.target.value) || 0)}
            inputProps={{ min: 0, step: 1 }}
            sx={{ minWidth: 200 }}
          />
          <Button
            variant="outlined"
            onClick={() => handlePreviewChange(previewConsumption)}
            disabled={loadingPreview}
          >
            Calcular
          </Button>
        </Box>
        {loadingPreview && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}
        {previewResult && !loadingPreview && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Resultado para {previewConsumption} m³:
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mt: 1 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">BASE</Typography>
                <Typography variant="body2" fontWeight="bold">${previewResult.base_amount.toFixed(2)}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Rango 16-20</Typography>
                <Typography variant="body2" fontWeight="bold">${previewResult.range_16_20_amount.toFixed(2)}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Rango 21-25</Typography>
                <Typography variant="body2" fontWeight="bold">${previewResult.range_21_25_amount.toFixed(2)}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Rango 26+</Typography>
                <Typography variant="body2" fontWeight="bold">${previewResult.range_26_plus_amount.toFixed(2)}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">TOTAL</Typography>
                <Typography variant="body2" fontWeight="bold" color="primary">
                  ${previewResult.tariff_total.toFixed(2)}
                </Typography>
              </Box>
            </Box>
            {previewResult.tariff_breakdown && previewResult.tariff_breakdown.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                  Desglose:
                </Typography>
                {previewResult.tariff_breakdown.map((item: any, index: number) => {
                  // Si es BASE con cargo fijo, mostrar diferente
                  const isFixedCharge = item.name === 'BASE' && item.units === 1 && item.unit_price === item.amount;
                  return (
                    <Typography key={index} variant="caption" display="block">
                      • {item.name}: {isFixedCharge 
                        ? `$${item.amount.toFixed(2)} (cargo fijo)`
                        : `${item.units} m³ × $${item.unit_price.toFixed(4)} = $${item.amount.toFixed(2)}`}
                    </Typography>
                  );
                })}
              </Box>
            )}
          </Box>
        )}
      </Paper>

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Orden</TableCell>
                <TableCell>Nombre</TableCell>
                <TableCell>Rango (m³)</TableCell>
                <TableCell>Precio/Unidad</TableCell>
                <TableCell>Máx. Unidades</TableCell>
                <TableCell>Cargo Fijo</TableCell>
                <TableCell>Ejemplo</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tariffs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                      No hay tarifas registradas
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                tariffs.map((tariff) => (
                  <TableRow key={tariff.id}>
                    <TableCell>{tariff.order_index}</TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {tariff.name}
                      </Typography>
                      {tariff.description && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {tariff.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {tariff.min_consumption}
                      {tariff.max_consumption ? ` - ${tariff.max_consumption}` : '+'}
                    </TableCell>
                    <TableCell>
                      {tariff.price_per_unit > 0 ? `$${tariff.price_per_unit.toFixed(4)}` : '-'}
                    </TableCell>
                    <TableCell>
                      {tariff.max_units ? tariff.max_units.toFixed(0) : '∞'}
                    </TableCell>
                    <TableCell>
                      {tariff.fixed_charge > 0 ? `$${tariff.fixed_charge.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {calculateExample(tariff)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={tariff.status === 'active' ? 'Activa' : 'Inactiva'}
                        size="small"
                        color={tariff.status === 'active' ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(tariff)}
                        color="primary"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(tariff.id)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={tariffs.length}
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
          {selectedTariff ? 'Editar Tarifa' : 'Nueva Tarifa'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              fullWidth
              label="Nombre de la Tarifa"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="Ej: BASE, Rango 16-20, Rango 21-25"
            />
            <TextField
              fullWidth
              label="Descripción"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              multiline
              rows={2}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                fullWidth
                label="Consumo Mínimo (m³)"
                type="number"
                value={formData.min_consumption}
                onChange={(e) => setFormData({ ...formData, min_consumption: parseFloat(e.target.value) || 0 })}
                required
                inputProps={{ min: 0, step: 0.01 }}
              />
              <TextField
                fullWidth
                label="Consumo Máximo (m³)"
                type="number"
                value={formData.max_consumption}
                onChange={(e) => setFormData({ ...formData, max_consumption: e.target.value })}
                helperText="Dejar vacío para sin límite"
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                fullWidth
                label="Precio por Unidad"
                type="number"
                value={formData.price_per_unit}
                onChange={(e) => setFormData({ ...formData, price_per_unit: parseFloat(e.target.value) || 0 })}
                inputProps={{ min: 0, step: 0.0001 }}
                helperText="Precio por m³ (ej: 0.20, 0.50, 1.00)"
              />
              <TextField
                fullWidth
                label="Máximo de Unidades"
                type="number"
                value={formData.max_units}
                onChange={(e) => setFormData({ ...formData, max_units: e.target.value })}
                helperText="Límite de m³ a cobrar (ej: 5 para rango 16-20)"
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                fullWidth
                label="Cargo Fijo"
                type="number"
                value={formData.fixed_charge}
                onChange={(e) => setFormData({ ...formData, fixed_charge: parseFloat(e.target.value) || 0 })}
                inputProps={{ min: 0, step: 0.01 }}
                helperText="Cargo fijo (ej: $2 para BASE)"
              />
              <TextField
                fullWidth
                label="Orden"
                type="number"
                value={formData.order_index}
                onChange={(e) => setFormData({ ...formData, order_index: parseInt(e.target.value, 10) || 0 })}
                helperText="Orden de aplicación"
                inputProps={{ min: 0 }}
              />
            </Box>
            <FormControl fullWidth>
              <InputLabel>Estado</InputLabel>
              <Select
                value={formData.status}
                label="Estado"
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <MenuItem value="active">Activa</MenuItem>
                <MenuItem value="inactive">Inactiva</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button onClick={handleSubmit} variant="contained" color="primary">
            {selectedTariff ? 'Actualizar' : 'Crear'}
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

export default TariffManagement;


