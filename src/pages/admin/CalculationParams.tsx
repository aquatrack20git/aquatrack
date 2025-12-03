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
  Switch,
  FormControlLabel,
  Chip,
  Tabs,
  Tab,
} from '@mui/material';
import { 
  Edit as EditIcon, 
  Delete as DeleteIcon, 
  Add as AddIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { supabase } from '../../config/supabase';

interface CalculationParam {
  id: number;
  param_key: string;
  param_name: string;
  param_value: string;
  param_type: string;
  description: string | null;
  category: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const categories = ['general', 'tariff', 'multas', 'mora', 'jardin', 'billing', 'other'];
const paramTypes = ['number', 'text', 'formula', 'boolean'];

const CalculationParams: React.FC = () => {
  const [params, setParams] = useState<CalculationParam[]>([]);
  const [filteredParams, setFilteredParams] = useState<CalculationParam[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedParam, setSelectedParam] = useState<CalculationParam | null>(null);
  const [formData, setFormData] = useState({
    param_key: '',
    param_name: '',
    param_value: '',
    param_type: 'number',
    description: '',
    category: 'general',
    is_active: true,
  });
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  });
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    fetchParams();
  }, []);

  useEffect(() => {
    filterParams();
  }, [params, selectedCategory]);

  const fetchParams = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('calculation_params')
        .select('*')
        .order('category', { ascending: true })
        .order('param_name', { ascending: true });

      if (error) throw error;
      setParams(data || []);
    } catch (error: any) {
      console.error('Error fetching calculation params:', error);
      showSnackbar('Error al cargar los parámetros', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filterParams = () => {
    if (selectedCategory === 'all') {
      setFilteredParams(params);
    } else {
      setFilteredParams(params.filter(p => p.category === selectedCategory));
    }
  };

  const handleOpenDialog = (param?: CalculationParam) => {
    if (param) {
      setSelectedParam(param);
      setFormData({
        param_key: param.param_key,
        param_name: param.param_name,
        param_value: param.param_value,
        param_type: param.param_type,
        description: param.description || '',
        category: param.category || 'general',
        is_active: param.is_active,
      });
    } else {
      setSelectedParam(null);
      setFormData({
        param_key: '',
        param_name: '',
        param_value: '',
        param_type: 'number',
        description: '',
        category: 'general',
        is_active: true,
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedParam(null);
    setFormData({
      param_key: '',
      param_name: '',
      param_value: '',
      param_type: 'number',
      description: '',
      category: 'general',
      is_active: true,
    });
  };

  const handleSubmit = async () => {
    try {
      if (!formData.param_key.trim()) {
        showSnackbar('La clave del parámetro es requerida', 'error');
        return;
      }

      if (!formData.param_name.trim()) {
        showSnackbar('El nombre del parámetro es requerido', 'error');
        return;
      }

      if (!formData.param_value.trim()) {
        showSnackbar('El valor del parámetro es requerido', 'error');
        return;
      }

      if (formData.param_type === 'number') {
        if (isNaN(parseFloat(formData.param_value))) {
          showSnackbar('El valor debe ser un número válido', 'error');
          return;
        }
      }

      if (formData.param_type === 'boolean') {
        if (!['true', 'false', '1', '0'].includes(formData.param_value.toLowerCase())) {
          showSnackbar('El valor booleano debe ser true/false o 1/0', 'error');
          return;
        }
      }

      const paramData = {
        param_key: formData.param_key.trim().toLowerCase().replace(/\s+/g, '_'),
        param_name: formData.param_name.trim(),
        param_value: formData.param_value.trim(),
        param_type: formData.param_type,
        description: formData.description.trim() || null,
        category: formData.category || null,
        is_active: formData.is_active,
      };

      if (selectedParam) {
        const { error } = await supabase
          .from('calculation_params')
          .update(paramData)
          .eq('id', selectedParam.id);

        if (error) throw error;
        showSnackbar('Parámetro actualizado exitosamente');
      } else {
        const { error } = await supabase
          .from('calculation_params')
          .insert([paramData]);

        if (error) {
          if (error.code === '23505') {
            throw new Error('Ya existe un parámetro con esta clave');
          }
          throw error;
        }
        showSnackbar('Parámetro creado exitosamente');
      }

      handleCloseDialog();
      fetchParams();
    } catch (error: any) {
      console.error('Error saving param:', error);
      showSnackbar(error.message || 'Error al guardar el parámetro', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este parámetro?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('calculation_params')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showSnackbar('Parámetro eliminado exitosamente');
      fetchParams();
    } catch (error: any) {
      console.error('Error deleting param:', error);
      showSnackbar(error.message || 'Error al eliminar el parámetro', 'error');
    }
  };

  const handleToggleActive = async (param: CalculationParam) => {
    try {
      const { error } = await supabase
        .from('calculation_params')
        .update({ is_active: !param.is_active })
        .eq('id', param.id);

      if (error) throw error;
      showSnackbar(`Parámetro ${!param.is_active ? 'activado' : 'desactivado'} exitosamente`);
      fetchParams();
    } catch (error: any) {
      console.error('Error toggling param:', error);
      showSnackbar('Error al cambiar el estado del parámetro', 'error');
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

  const getValuePreview = (param: CalculationParam) => {
    if (param.param_type === 'boolean') {
      return param.param_value === 'true' || param.param_value === '1' ? 'Sí' : 'No';
    }
    if (param.param_type === 'number') {
      const num = parseFloat(param.param_value);
      return num.toLocaleString('es-ES', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      });
    }
    return param.param_value.length > 50 
      ? `${param.param_value.substring(0, 50)}...` 
      : param.param_value;
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Parametrización de Cálculo
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Nuevo Parámetro
        </Button>
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={selectedCategory}
          onChange={(_, newValue) => setSelectedCategory(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Todos" value="all" />
          {categories.map((cat) => (
            <Tab key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)} value={cat} />
          ))}
        </Tabs>
      </Paper>

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Clave</TableCell>
                <TableCell>Nombre</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Valor</TableCell>
                <TableCell>Categoría</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredParams.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                      No hay parámetros registrados
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredParams.map((param) => (
                  <TableRow key={param.id}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium" fontFamily="monospace">
                        {param.param_key}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {param.param_name}
                      </Typography>
                      {param.description && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {param.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={param.param_type}
                        size="small"
                        color={param.param_type === 'formula' ? 'primary' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {getValuePreview(param)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={param.category || 'Sin categoría'}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={param.is_active}
                            onChange={() => handleToggleActive(param)}
                            size="small"
                          />
                        }
                        label={param.is_active ? 'Activo' : 'Inactivo'}
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(param)}
                        color="primary"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(param.id)}
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
      </Paper>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedParam ? 'Editar Parámetro' : 'Nuevo Parámetro'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              fullWidth
              label="Clave del Parámetro"
              value={formData.param_key}
              onChange={(e) => setFormData({ ...formData, param_key: e.target.value })}
              required
              disabled={!!selectedParam}
              helperText={selectedParam ? 'La clave no se puede modificar' : 'Ej: multas_reuniones, mora_percentage, jardin_amount'}
              inputProps={{ style: { fontFamily: 'monospace' } }}
            />
            <TextField
              fullWidth
              label="Nombre del Parámetro"
              value={formData.param_name}
              onChange={(e) => setFormData({ ...formData, param_name: e.target.value })}
              required
              placeholder="Ej: Multas por Reuniones, Porcentaje de Mora"
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Tipo</InputLabel>
                <Select
                  value={formData.param_type}
                  label="Tipo"
                  onChange={(e) => setFormData({ ...formData, param_type: e.target.value })}
                >
                  {paramTypes.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Categoría</InputLabel>
                <Select
                  value={formData.category}
                  label="Categoría"
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  {categories.map((cat) => (
                    <MenuItem key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <TextField
              fullWidth
              label="Valor"
              value={formData.param_value}
              onChange={(e) => setFormData({ ...formData, param_value: e.target.value })}
              required
              multiline={formData.param_type === 'formula' || formData.param_type === 'text'}
              rows={formData.param_type === 'formula' ? 4 : 1}
              helperText={
                formData.param_type === 'number' 
                  ? 'Ingrese un número (ej: 0, 10, 12.5)'
                  : formData.param_type === 'boolean'
                  ? 'Ingrese true/false o 1/0'
                  : formData.param_type === 'formula'
                  ? 'Ingrese la fórmula de cálculo'
                  : 'Ingrese el valor del parámetro'
              }
              inputProps={{ 
                style: formData.param_type === 'formula' ? { fontFamily: 'monospace' } : {}
              }}
            />
            <TextField
              fullWidth
              label="Descripción"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              multiline
              rows={2}
              helperText="Descripción opcional del parámetro"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
              }
              label="Parámetro activo"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button onClick={handleSubmit} variant="contained" color="primary" startIcon={<SaveIcon />}>
            {selectedParam ? 'Actualizar' : 'Crear'}
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

export default CalculationParams;


