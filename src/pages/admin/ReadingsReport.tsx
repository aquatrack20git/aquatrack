import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TablePagination,
  ButtonGroup,
  TextField,
} from '@mui/material';
import {
  FileDownload as FileDownloadIcon,
  PictureAsPdf as PdfIcon,
} from '@mui/icons-material';
import { supabase } from '../../config/supabase';
import * as XLSX from 'xlsx';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import ProtectedAdminRoute from '../../components/ProtectedAdminRoute';

interface Reading {
  id: number;
  meter_id: string;
  value: number;
  period: string;
  created_at: string;
  photo_url?: string;
  meter?: {
    code_meter: string;
    location: string;
  };
  previous_reading?: number;
  consumption?: number;
}

interface Filters {
  meter_id: string;
  period: string;
}

const ReadingsReport: React.FC = () => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const permissions = usePermissions();
  const [readings, setReadings] = useState<Reading[]>([]);
  const [filteredReadings, setFilteredReadings] = useState<Reading[]>([]);
  const [meters, setMeters] = useState<Array<{ code_meter: string; location: string }>>([]);
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([]);
  const [filters, setFilters] = useState<Filters>({
    meter_id: '',
    period: '',
  });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMeters();
    fetchReadings();
  }, [filters]);

  const fetchMeters = async () => {
    try {
      const { data, error } = await supabase
        .from('meters')
        .select('code_meter, location')
        .order('code_meter');

      if (error) throw error;
      setMeters(data || []);
    } catch (error) {
      console.error('Error fetching meters:', error);
      showSnackbar('Error al cargar los medidores', 'error');
    }
  };

  const fetchReadings = async () => {
    try {
      let query = supabase
        .from('readings')
        .select(`
          *,
          meter:meters(code_meter, location)
        `)
        .order('created_at', { ascending: false });

      if (filters.period) {
        query = query.eq('period', filters.period);
      }
      if (filters.meter_id) {
        query = query.eq('meter_id', filters.meter_id);
      }

      const { data, error } = await query;

      if (error) throw error;

      const filteredData = data?.filter(reading => {
        if (!filters.meter_id) return true;
        const searchTerm = filters.meter_id.toLowerCase();
        return (
          reading.meter?.code_meter?.toLowerCase().includes(searchTerm) ||
          reading.meter?.location?.toLowerCase().includes(searchTerm)
        );
      }) || [];

      setReadings(filteredData);
      setFilteredReadings(filteredData);
    } catch (error) {
      console.error('Error fetching readings:', error);
      showSnackbar('Error al cargar las lecturas', 'error');
    }
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleExport = () => {
    const data = readings.map(reading => ({
      'ID': reading.id,
      'Código Medidor': reading.meter.code_meter,
      'Ubicación': reading.meter.location,
      'Valor': reading.value,
      'Período': reading.period,
      'Fecha': new Date(reading.created_at).toLocaleDateString(),
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lecturas');
    XLSX.writeFile(wb, 'lecturas.xlsx');
  };

  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setError(message);
  };

  const handleChangePage = (event: React.MouseEvent<HTMLButtonElement> | null, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  if (authLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <ProtectedAdminRoute>
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4">Reporte de Lecturas</Typography>
          <ButtonGroup variant="outlined">
            <Button
              startIcon={<FileDownloadIcon />}
              onClick={handleExport}
            >
              Excel
            </Button>
            <Button
              startIcon={<PdfIcon />}
              onClick={() => {}}
            >
              PDF
            </Button>
          </ButtonGroup>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Paper sx={{ p: 2, mb: 3 }}>
          <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
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
                {meters.map((meter) => (
                  <MenuItem key={meter.code_meter} value={meter.code_meter}>
                    {meter.code_meter}
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

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Medidor</TableCell>
                <TableCell>Ubicación</TableCell>
                <TableCell>Lectura Anterior</TableCell>
                <TableCell>Lectura Actual</TableCell>
                <TableCell>Consumo</TableCell>
                <TableCell>Período</TableCell>
                <TableCell>Fecha</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredReadings
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((reading) => (
                  <TableRow key={reading.id}>
                    <TableCell>{reading.meter?.code_meter || 'Medidor no encontrado'}</TableCell>
                    <TableCell>{reading.meter?.location || '-'}</TableCell>
                    <TableCell>{reading.previous_reading || '-'}</TableCell>
                    <TableCell>{reading.value}</TableCell>
                    <TableCell>
                      {reading.consumption !== null && reading.consumption !== undefined
                        ? reading.consumption
                        : '-'}
                    </TableCell>
                    <TableCell>{reading.period}</TableCell>
                    <TableCell>
                      {new Date(reading.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
          <TablePagination
            rowsPerPageOptions={[10, 25, 50, 100]}
            component="div"
            count={filteredReadings.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            labelRowsPerPage="Registros por página"
          />
        </TableContainer>
      </Box>
    </ProtectedAdminRoute>
  );
};

export default ReadingsReport; 