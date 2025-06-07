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
  Tooltip,
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
  Image as ImageIcon,
  FileDownload as FileDownloadIcon,
  Assessment as AssessmentIcon,
  PictureAsPdf as PdfIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { supabase } from '../../config/supabase';
import * as XLSX from 'xlsx';
import { usePermissions } from '../../contexts/PermissionsContext';

interface Reading {
  id: string;
  meter_id: string;
  reading_date: string;
  value: number;
  status: string;
  created_at: string;
  meter?: {
    serial_number: string;
    location: string;
  };
}

interface Meter {
  code_meter: string;
  location: string;
}

const ReadingsManagement: React.FC = () => {
  const { canCreate, canEdit, canDelete, canDownload } = usePermissions();
  const [readings, setReadings] = useState<Reading[]>([]);
  const [filteredReadings, setFilteredReadings] = useState<Reading[]>([]);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [editingReading, setEditingReading] = useState<Reading | null>(null);
  const [formData, setFormData] = useState({
    meter_id: '',
    reading_date: new Date().toISOString().split('T')[0],
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
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    meter_id: '',
    period: '',
  });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [printContent, setPrintContent] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        if (isMounted) {
          setLoading(true);
          setError(null);
          await Promise.all([fetchMeters(), fetchReadings()]);
        }
      } catch (error: any) {
        if (isMounted) {
          setError(error.message);
          showSnackbar(error.message || 'Error al cargar los datos', 'error');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
      // Reiniciar estados
      setReadings([]);
      setFilteredReadings([]);
      setMeters([]);
      setAvailablePeriods([]);
      setOpen(false);
      setEditingReading(null);
      setFormData({
        meter_id: '',
        reading_date: new Date().toISOString().split('T')[0],
        value: '',
        status: 'pending',
      });
      setError(null);
      setSelectedImage(null);
      setFilters({
        meter_id: '',
        period: '',
      });
      setPage(0);
      setRowsPerPage(25);
      setPrintContent(null);
    };
  }, []);

  useEffect(() => {
    // Filtrar lecturas cuando cambian los filtros
    const filtered = readings.filter(reading => {
      const meterCode = reading.meter?.code_meter?.toLowerCase() || '';
      const meterLocation = reading.meter?.location?.toLowerCase() || '';
      const searchTerm = filters.meter_id.toLowerCase();
      
      const matchesMeter = !filters.meter_id || 
        meterCode.includes(searchTerm) ||
        meterLocation.includes(searchTerm);
      const matchesPeriod = !filters.period || reading.period.toUpperCase().includes(filters.period.toUpperCase());
      return matchesMeter && matchesPeriod;
    });
    setFilteredReadings(filtered);
  }, [filters, readings]);

  useEffect(() => {
    // Extraer periodos únicos de las lecturas
    const periods = [...new Set(readings.map(r => r.period))].sort((a, b) => {
      const [mesA, añoA] = a.split(' ');
      const [mesB, añoB] = b.split(' ');
      const meses: Record<string, number> = {
        'ENERO': 1, 'FEBRERO': 2, 'MARZO': 3, 'ABRIL': 4, 'MAYO': 5, 'JUNIO': 6,
        'JULIO': 7, 'AGOSTO': 8, 'SEPTIEMBRE': 9, 'OCTUBRE': 10, 'NOVIEMBRE': 11, 'DICIEMBRE': 12
      };
      const numMesA = meses[mesA];
      const numMesB = meses[mesB];
      const numAñoA = parseInt(añoA);
      const numAñoB = parseInt(añoB);
      
      if (numAñoA !== numAñoB) return numAñoB - numAñoA;
      return numMesB - numMesA;
    });
    setAvailablePeriods(periods);
  }, [readings]);

  const fetchMeters = async () => {
    try {
      const { data, error } = await supabase
        .from('meters')
        .select('code_meter, location')
        .order('code_meter');

      if (error) throw error;
      setMeters(data || []);
    } catch (error: any) {
      setError(error.message);
    }
  };

  const fetchReadings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('readings')
        .select(`
          *,
          meter:meters(code_meter, location)
        `)
        .order('reading_date', { ascending: false });

      if (error) throw error;
      setReadings(data || []);
      setFilteredReadings(data || []);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (reading?: Reading) => {
    if (reading) {
      setEditingReading(reading);
      setFormData({
        meter_id: reading.meter_id,
        reading_date: reading.reading_date.split('T')[0],
        value: reading.value.toString(),
        status: reading.status,
      });
    } else {
      setEditingReading(null);
      setFormData({
        meter_id: '',
        reading_date: new Date().toISOString().split('T')[0],
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
      reading_date: new Date().toISOString().split('T')[0],
      value: '',
      status: 'pending',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingReading) {
        const { error } = await supabase
          .from('readings')
          .update({
            meter_id: formData.meter_id,
            reading_date: formData.reading_date,
            value: parseFloat(formData.value),
            status: formData.status,
          })
          .eq('id', editingReading.id);

        if (error) throw error;
        showSnackbar('Lectura actualizada exitosamente');
      } else {
        const { error } = await supabase
          .from('readings')
          .insert([{
            meter_id: formData.meter_id,
            reading_date: formData.reading_date,
            value: parseFloat(formData.value),
            status: formData.status,
            created_at: new Date().toISOString(),
          }]);

        if (error) throw error;
        showSnackbar('Lectura registrada exitosamente');
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

  const handleDownload = async () => {
    try {
      const { data, error } = await supabase
        .from('readings')
        .select(`
          *,
          meter:meters(serial_number, location)
        `)
        .order('reading_date', { ascending: false });

      if (error) throw error;

      // Convertir datos a CSV
      const headers = ['ID', 'Medidor', 'Ubicación', 'Fecha', 'Valor', 'Estado', 'Fecha de Registro'];
      const csvData = data.map(reading => [
        reading.id,
        reading.meter?.serial_number || 'N/A',
        reading.meter?.location || 'N/A',
        new Date(reading.reading_date).toLocaleDateString(),
        reading.value,
        reading.status === 'approved' ? 'Aprobado' : 'Pendiente',
        new Date(reading.created_at).toLocaleString()
      ]);

      const csvContent = [
        headers.join(','),
        ...csvData.map(row => row.join(','))
      ].join('\n');

      // Crear y descargar archivo
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `lecturas_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error: any) {
      console.error('Error al descargar lecturas:', error);
      setError(error.message);
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({
      open: true,
      message,
      severity,
    });
  };

  const handleImageClick = (photoUrl: string) => {
    setSelectedImage(photoUrl);
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
    const exportData = filteredReadings.map(reading => ({
      'Medidor': reading.meter.code_meter,
      'Lectura Anterior': reading.previous_reading || '-',
      'Lectura Actual': reading.value,
      'Consumo': reading.consumption !== null && reading.consumption !== undefined ? reading.consumption : '-',
      'Período': reading.period,
      'Fecha': new Date(reading.created_at).toLocaleDateString(),
      'Ubicación': reading.meter.location,
    }));

    // Crear una nueva hoja de cálculo
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lecturas');

    // Generar el archivo Excel
    const fileName = `Lecturas_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const exportConsumptionReport = () => {
    // Agrupar lecturas por período y calcular consumos totales
    const consumptionByPeriod = filteredReadings.reduce((acc: Record<string, { total: number, count: number }>, reading) => {
      if (reading.consumption !== null && reading.consumption !== undefined) {
        if (!acc[reading.period]) {
          acc[reading.period] = { total: 0, count: 0 };
        }
        acc[reading.period].total += reading.consumption;
        acc[reading.period].count += 1;
      }
      return acc;
    }, {});

    // Convertir a array y ordenar por período
    const reportData = Object.entries(consumptionByPeriod)
      .map(([period, data]) => ({
        'Período': period,
        'Consumo Total': data.total.toFixed(2),
        'Cantidad de Medidores': data.count
      }))
      .sort((a, b) => {
        const [mesA, añoA] = a['Período'].split(' ');
        const [mesB, añoB] = b['Período'].split(' ');
        const meses: Record<string, number> = {
          'ENERO': 1, 'FEBRERO': 2, 'MARZO': 3, 'ABRIL': 4, 'MAYO': 5, 'JUNIO': 6,
          'JULIO': 7, 'AGOSTO': 8, 'SEPTIEMBRE': 9, 'OCTUBRE': 10, 'NOVIEMBRE': 11, 'DICIEMBRE': 12
        };
        const numMesA = meses[mesA];
        const numMesB = meses[mesB];
        const numAñoA = parseInt(añoA);
        const numAñoB = parseInt(añoB);
        
        if (numAñoA !== numAñoB) return numAñoB - numAñoA;
        return numMesB - numMesA;
      });

    // Crear una nueva hoja de cálculo
    const ws = XLSX.utils.json_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Consumo por Período');

    // Ajustar el ancho de las columnas
    const wscols = [
      { wch: 15 }, // Período
      { wch: 15 }, // Consumo Total
      { wch: 20 }, // Cantidad de Medidores
    ];
    ws['!cols'] = wscols;

    // Generar el archivo Excel
    const fileName = `Reporte_Consumo_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const exportToPdf = () => {
    // Obtener los datos filtrados
    const data = filteredReadings.map(reading => ({
      medidor: reading.meter?.code_meter || 'Medidor no encontrado',
      lecturaAnterior: reading.previous_reading || '-',
      lecturaActual: reading.value,
      consumo: reading.consumption !== null && reading.consumption !== undefined ? reading.consumption : '-',
      periodo: reading.period,
      fecha: new Date(reading.created_at).toLocaleDateString(),
      ubicacion: reading.meter?.location || '-'
    }));

    // Crear el contenido HTML para imprimir
    const content = `
      <div class="print-content">
        <div class="header">
          <div class="title">Reporte de Lecturas</div>
          <div class="date">Generado el: ${new Date().toLocaleDateString()}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Medidor</th>
              <th>Lectura Anterior</th>
              <th>Lectura Actual</th>
              <th>Consumo</th>
              <th>Período</th>
              <th>Fecha</th>
              <th>Ubicación</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(row => `
              <tr>
                <td>${row.medidor}</td>
                <td>${row.lecturaAnterior}</td>
                <td>${row.lecturaActual}</td>
                <td>${row.consumo}</td>
                <td>${row.periodo}</td>
                <td>${row.fecha}</td>
                <td>${row.ubicacion}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    // Agregar estilos de impresión al documento
    const style = document.createElement('style');
    style.textContent = `
      @media print {
        body * {
          visibility: hidden;
        }
        .print-content, .print-content * {
          visibility: visible;
        }
        .print-content {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
        }
        .header {
          text-align: center;
          margin-bottom: 20px;
        }
        .title {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 10px;
        }
        .date {
          font-size: 14px;
          color: #666;
          margin-bottom: 20px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
          font-size: 12px;
        }
        th {
          background-color: #f5f5f5 !important;
          font-weight: bold;
        }
        tr:nth-child(even) {
          background-color: #f9f9f9 !important;
        }
        @page {
          size: landscape;
          margin: 1cm;
        }
      }
    `;
    document.head.appendChild(style);

    // Crear un div temporal para el contenido de impresión
    const printDiv = document.createElement('div');
    printDiv.innerHTML = content;
    document.body.appendChild(printDiv);

    // Imprimir
    window.print();

    // Limpiar después de imprimir
    document.body.removeChild(printDiv);
    document.head.removeChild(style);
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
        <Typography variant="h4">Registro de Lecturas</Typography>
        <Box display="flex" gap={2}>
          <ButtonGroup variant="outlined">
            <Button
              startIcon={<FileDownloadIcon />}
              onClick={exportToExcel}
            >
              Excel
            </Button>
            <Button
              startIcon={<PdfIcon />}
              onClick={exportToPdf}
            >
              PDF
            </Button>
          </ButtonGroup>
          <Button
            variant="outlined"
            startIcon={<AssessmentIcon />}
            onClick={exportConsumptionReport}
          >
            Reporte de Consumo
          </Button>
          {canDownload && (
            <Tooltip title="Descargar lecturas">
              <IconButton onClick={handleDownload} color="primary">
                <DownloadIcon />
              </IconButton>
            </Tooltip>
          )}
          {canCreate && (
            <Button variant="contained" onClick={() => handleOpen()}>
              Nueva Lectura
            </Button>
          )}
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Controles de búsqueda */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" gap={2} alignItems="center">
          <TextField
            label="Buscar Medidor"
            value={filters.meter_id}
            onChange={(e) => setFilters({ ...filters, meter_id: e.target.value })}
            placeholder="Buscar por código o ubicación"
            sx={{ minWidth: 200 }}
          />
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Período</InputLabel>
            <Select
              value={filters.period}
              onChange={(e) => setFilters({ ...filters, period: e.target.value })}
              label="Período"
            >
              <MenuItem value="">Todos</MenuItem>
              {availablePeriods.map((period) => (
                <MenuItem key={period} value={period}>
                  {period}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            onClick={() => setFilters({ meter_id: '', period: '' })}
          >
            Limpiar filtros
          </Button>
        </Box>
      </Paper>

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1">
          Total de registros: {filteredReadings.length}
        </Typography>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Medidor</TableCell>
              <TableCell>Lectura Anterior</TableCell>
              <TableCell>Lectura Actual</TableCell>
              <TableCell>Consumo</TableCell>
              <TableCell>Período</TableCell>
              <TableCell>Foto</TableCell>
              <TableCell>Fecha</TableCell>
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredReadings
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((reading) => (
                <TableRow key={reading.id}>
                  <TableCell>{reading.meter?.code_meter || 'Medidor no encontrado'}</TableCell>
                  <TableCell>{reading.previous_reading || '-'}</TableCell>
                  <TableCell>{reading.value}</TableCell>
                  <TableCell>{reading.consumption !== null && reading.consumption !== undefined ? reading.consumption : '-'}</TableCell>
                  <TableCell>{reading.period}</TableCell>
                  <TableCell>
                    {reading.photo_url ? (
                      <IconButton
                        onClick={() => handleImageClick(reading.photo_url)}
                        color="primary"
                      >
                        <ImageIcon />
                      </IconButton>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Sin foto
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(reading.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {(canEdit || canDelete) && (
                      <>
                        {canEdit && (
                          <Tooltip title="Editar lectura">
                            <IconButton
                              size="small"
                              onClick={() => handleOpen(reading)}
                              color="primary"
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                        {canDelete && (
                          <Tooltip title="Eliminar lectura">
                            <IconButton
                              size="small"
                              onClick={() => handleDelete(reading.id)}
                              color="error"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100, 200]}
          component="div"
          count={filteredReadings.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="Registros por página"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
        />
      </TableContainer>

      {/* Diálogo para crear/editar lectura */}
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
              >
                {meters.map((meter) => (
                  <MenuItem key={meter.code_meter} value={meter.code_meter}>
                    {meter.code_meter}
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
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              fullWidth
              label="Valor"
              type="number"
              value={formData.value}
              onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              margin="normal"
              required
              inputProps={{ step: "0.01" }}
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
                <MenuItem value="approved">Aprobado</MenuItem>
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

      {/* Diálogo para mostrar la imagen */}
      <Dialog
        open={!!selectedImage}
        onClose={() => setSelectedImage(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogContent>
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Lectura"
              style={{
                width: '100%',
                height: 'auto',
                maxHeight: '80vh',
                objectFit: 'contain',
              }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedImage(null)}>Cerrar</Button>
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

export default ReadingsManagement; 