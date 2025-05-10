import { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  TextField,
  Button,
  CircularProgress,
  MenuItem,
} from '@mui/material';
import { supabase } from '../config/supabase';
import type { Reading, Meter } from '../types';

interface ReportData {
  totalConsumption: number;
  averageConsumption: number;
  maxConsumption: number;
  minConsumption: number;
  readingsCount: number;
  metersWithReadings: number;
}

const Reports = () => {
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [periods, setPeriods] = useState<string[]>([]);
  const [reportData, setReportData] = useState<ReportData>({
    totalConsumption: 0,
    averageConsumption: 0,
    maxConsumption: 0,
    minConsumption: 0,
    readingsCount: 0,
    metersWithReadings: 0,
  });

  useEffect(() => {
    fetchPeriods();
  }, []);

  useEffect(() => {
    if (selectedPeriod) {
      fetchReportData();
    }
  }, [selectedPeriod]);

  const fetchPeriods = async () => {
    try {
      const { data, error } = await supabase
        .from('readings')
        .select('period')
        .order('period', { ascending: false });

      if (error) throw error;

      const uniquePeriods = Array.from(new Set(data.map(r => r.period)));
      setPeriods(uniquePeriods);
      if (uniquePeriods.length > 0) {
        setSelectedPeriod(uniquePeriods[0]);
      }
    } catch (error) {
      console.error('Error fetching periods:', error);
    }
  };

  const fetchReportData = async () => {
    setLoading(true);
    try {
      // Fetch readings for the selected period
      const { data: readings, error: readingsError } = await supabase
        .from('readings')
        .select('*')
        .eq('period', selectedPeriod);

      if (readingsError) throw readingsError;

      // Calculate statistics
      const values = readings.map(r => Number(r.value));
      const totalConsumption = values.reduce((sum, val) => sum + val, 0);
      const averageConsumption = values.length > 0 ? totalConsumption / values.length : 0;
      const maxConsumption = Math.max(...values);
      const minConsumption = Math.min(...values);
      const uniqueMeters = new Set(readings.map(r => r.meter_id));

      setReportData({
        totalConsumption,
        averageConsumption,
        maxConsumption,
        minConsumption,
        readingsCount: readings.length,
        metersWithReadings: uniqueMeters.size,
      });
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const { data: readings, error: readingsError } = await supabase
        .from('readings')
        .select(`
          *,
          meters (
            code_meter,
            location,
            description
          )
        `)
        .eq('period', selectedPeriod);

      if (readingsError) throw readingsError;

      // Create CSV content
      const headers = ['Código Medidor', 'Ubicación', 'Valor', 'Fecha', 'Foto'];
      const rows = readings.map(r => [
        r.meters.code_meter,
        r.meters.location,
        r.value,
        new Date(r.created_at).toLocaleDateString(),
        r.photo_url || ''
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `reporte-${selectedPeriod}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exporting report:', error);
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
      <Typography variant="h4" gutterBottom>
        Reportes
      </Typography>

      <Box mb={3}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              select
              fullWidth
              label="Período"
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
            >
              {periods.map((period) => (
                <MenuItem key={period} value={period}>
                  {period}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleExport}
              fullWidth
            >
              Exportar a CSV
            </Button>
          </Grid>
        </Grid>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Consumo Total
            </Typography>
            <Typography variant="h4" color="primary">
              {reportData.totalConsumption.toLocaleString()} m³
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Consumo Promedio
            </Typography>
            <Typography variant="h4" color="primary">
              {reportData.averageConsumption.toFixed(2)} m³
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Consumo Máximo
            </Typography>
            <Typography variant="h4" color="primary">
              {reportData.maxConsumption.toLocaleString()} m³
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Consumo Mínimo
            </Typography>
            <Typography variant="h4" color="primary">
              {reportData.minConsumption.toLocaleString()} m³
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Total de Lecturas
            </Typography>
            <Typography variant="h4" color="primary">
              {reportData.readingsCount}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Medidores con Lecturas
            </Typography>
            <Typography variant="h4" color="primary">
              {reportData.metersWithReadings}
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Reports; 