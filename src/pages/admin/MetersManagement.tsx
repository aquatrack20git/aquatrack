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
  ButtonGroup,
} from '@mui/material';
import { 
  Edit as EditIcon, 
  Delete as DeleteIcon, 
  Add as AddIcon,
  FileDownload as FileDownloadIcon,
  PictureAsPdf as PdfIcon,
} from '@mui/icons-material';
import { supabase } from '../../config/supabase';
import * as XLSX from 'xlsx';

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
  const [filteredMeters, setFilteredMeters] = useState<Meter[]>([]);
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
  const [filters, setFilters] = useState({
    search: '',
    status: '',
  });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  useEffect(() => {
    fetchMeters();
  }, []);

  useEffect(() => {
    // Filtrar medidores cuando cambian los filtros
    const filtered = meters.filter(meter => {
      const searchTerm = filters.search.toLowerCase().trim();
      if (!searchTerm && !filters.status) {
        return true; // Si no hay filtros, mostrar todos
      }

      const matchesSearch = !searchTerm || 
        (meter.code_meter && meter.code_meter.toLowerCase().includes(searchTerm)) ||
        (meter.description && meter.description.toLowerCase().includes(searchTerm)) ||
        (meter.identification && meter.identification.toLowerCase().includes(searchTerm)) ||
        (meter.email && meter.email.toLowerCase().includes(searchTerm)) ||
        (meter.location && meter.location.toLowerCase().includes(searchTerm));
      
      const matchesStatus = !filters.status || meter.status === filters.status;
      
      return matchesSearch && matchesStatus;
    });

    // Resetear la página cuando cambian los filtros
    setPage(0);
    setFilteredMeters(filtered);
  }, [filters, meters]);

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

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const exportToExcel = () => {
    // Preparar los datos para exportar
    const exportData = filteredMeters.map(meter => ({
      'Código': meter.code_meter,
      'Apellidos y Nombres': meter.description,
      'Identificación': meter.identification || '-',
      'Correo': meter.email || '-',
      'Contacto': meter.contact_number || '-',
      'Ubicación': meter.location,
      'Estado': meter.status,
      'Fecha de Creación': new Date(meter.created_at).toLocaleDateString(),
    }));

    // Crear una nueva hoja de cálculo
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Medidores');

    // Ajustar el ancho de las columnas
    const wscols = [
      { wch: 15 }, // Código
      { wch: 40 }, // Apellidos y Nombres
      { wch: 20 }, // Identificación
      { wch: 30 }, // Correo
      { wch: 15 }, // Contacto
      { wch: 40 }, // Ubicación
      { wch: 15 }, // Estado
      { wch: 20 }, // Fecha de Creación
    ];
    ws['!cols'] = wscols;

    // Generar el archivo Excel
    const fileName = `Medidores_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const exportToPDF = () => {
    // Crear una ventana nueva para el PDF
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showSnackbar('No se pudo abrir la ventana de impresión. Por favor, verifica que los bloqueadores de ventanas emergentes estén desactivados.', 'error');
      return;
    }

    // Crear el contenido HTML
    const content = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Reporte de Medidores</title>
          <style>
            body { font-family: Arial, sans-serif; }
            h1 { text-align: center; color: #333; }
            .date { text-align: right; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
            th { background-color: #f5f5f5; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            @media print {
              @page { size: landscape; margin: 1cm; }
              body { margin: 0; }
              table { page-break-inside: auto; }
              tr { page-break-inside: avoid; page-break-after: auto; }
            }
          </style>
        </head>
        <body>
          <h1>Reporte de Medidores</h1>
          <div class="date">Generado el: ${new Date().toLocaleDateString()}</div>
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Apellidos y Nombres</th>
                <th>Identificación</th>
                <th>Correo</th>
                <th>Contacto</th>
                <th>Ubicación</th>
                <th>Estado</th>
                <th>Fecha de Creación</th>
              </tr>
            </thead>
            <tbody>
              ${filteredMeters.map(meter => `
                <tr>
                  <td>${meter.code_meter}</td>
                  <td>${meter.description}</td>
                  <td>${meter.identification || '-'}</td>
                  <td>${meter.email || '-'}</td>
                  <td>${meter.contact_number || '-'}</td>
                  <td>${meter.location}</td>
                  <td>${meter.status}</td>
                  <td>${new Date(meter.created_at).toLocaleDateString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              };
            };
          </script>
        </body>
      </html>
    `;

    // Escribir el contenido y abrir el diálogo de impresión
    printWindow.document.write(content);
    printWindow.document.close();
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
        <Box display="flex" gap={2}>
          <ButtonGroup variant="outlined">
            <Button
              startIcon={<FileDownloadIcon />}
              onClick={exportToExcel}
              title="Exportar a Excel"
            >
              Excel
            </Button>
            <Button
              startIcon={<PdfIcon />}
              onClick={exportToPDF}
              title="Exportar a PDF"
            >
              PDF
            </Button>
          </ButtonGroup>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Nuevo Medidor
          </Button>
        </Box>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
          <TextField
            label="Buscar"
            value={filters.search}
            onChange={(e) => {
              const value = e.target.value;
              setFilters(prev => ({ ...prev, search: value }));
            }}
            placeholder="Buscar por código, nombres, identificación, etc."
            sx={{ minWidth: 300 }}
            InputProps={{
              autoComplete: 'off',
            }}
          />
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Estado</InputLabel>
            <Select
              value={filters.status}
              onChange={(e) => {
                const value = e.target.value;
                setFilters(prev => ({ ...prev, status: value }));
              }}
              label="Estado"
            >
              <MenuItem value="">Todos</MenuItem>
              <MenuItem value="active">Activo</MenuItem>
              <MenuItem value="inactive">Inactivo</MenuItem>
              <MenuItem value="maintenance">En Mantenimiento</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            onClick={() => {
              setFilters({ search: '', status: '' });
              setPage(0);
            }}
          >
            Limpiar filtros
          </Button>
        </Box>
      </Paper>

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1">
          Total de medidores: {filteredMeters.length}
        </Typography>
      </Box>

      {filteredMeters.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No se encontraron medidores que coincidan con los criterios de búsqueda.
          </Typography>
        </Paper>
      ) : (
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
              {filteredMeters
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((meter) => (
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
          <TablePagination
            rowsPerPageOptions={[10, 25, 50, 100]}
            component="div"
            count={filteredMeters.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            labelRowsPerPage="Filas por página"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
          />
        </TableContainer>
      )}

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