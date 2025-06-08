import React, { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Snackbar,
} from '@mui/material';
import { Download as DownloadIcon } from '@mui/icons-material';
import { supabase } from '../../config/supabase';
import * as XLSX from 'xlsx';

interface Reading {
  id: number;
  meter_id: string;
  value: number;
  period: string;
  photo_url: string;
  created_at: string;
  meter: {
    code_meter: string;
    location: string;
  };
}

interface Meter {
  code_meter: string;
  location: string;
}

const ReadingsReport: React.FC = () => {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [filters, setFilters] = useState({
    meter_id: '',
    period: '',
    start_date: '',
    end_date: '',
  });
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  });

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
      if (filters.start_date) {
        query = query.gte('created_at', filters.start_date);
      }
      if (filters.end_date) {
        query = query.lte('created_at', filters.end_date);
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
    setSnackbar({
      open: true,
      message,
      severity,
    });
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Reporte de Lecturas</Typography>
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={handleExport}
        >
          Exportar a Excel
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              name="meter_id"
              label="Buscar Medidor"
              value={filters.meter_id}
              onChange={handleFilterChange}
              placeholder="Buscar por código o ubicación"
              fullWidth
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              name="period"
              label="Período"
              value={filters.period}
              onChange={handleFilterChange}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              name="start_date"
              label="Fecha Inicio"
              type="date"
              value={filters.start_date}
              onChange={handleFilterChange}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              name="end_date"
              label="Fecha Fin"
              type="date"
              value={filters.end_date}
              onChange={handleFilterChange}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
        </Grid>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Código Medidor</TableCell>
              <TableCell>Ubicación</TableCell>
              <TableCell>Valor</TableCell>
              <TableCell>Período</TableCell>
              <TableCell>Fecha</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {readings.map((reading) => (
              <TableRow key={reading.id}>
                <TableCell>{reading.id}</TableCell>
                <TableCell>{reading.meter?.code_meter || 'Medidor no encontrado'}</TableCell>
                <TableCell>{reading.meter?.location || '-'}</TableCell>
                <TableCell>{reading.value}</TableCell>
                <TableCell>{reading.period}</TableCell>
                <TableCell>{new Date(reading.created_at).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

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

export default ReadingsReport; 