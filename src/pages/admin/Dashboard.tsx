import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  WaterDrop as WaterDropIcon,
  Speed as SpeedIcon,
  Comment as CommentIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface DashboardData {
  totalMeters: number;
  totalReadings: number;
  totalComments: number;
  recentReadings: {
    id: number;
    meter_id: string;
    value: number;
    period: string;
    created_at: string;
    meter: {
      code_meter: string;
      location: string;
    };
  }[];
  metersWithIssues: {
    code_meter: string;
    location: string;
    status: string;
  }[];
}

const Dashboard: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setError(null);

      // Obtener total de medidores
      const { data: metersData, error: metersError } = await supabase
        .from('meters')
        .select('code_meter');

      if (metersError) throw metersError;

      // Obtener total de lecturas
      const { data: readingsData, error: readingsError } = await supabase
        .from('readings')
        .select('id');

      if (readingsError) throw readingsError;

      // Obtener total de comentarios
      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select('id');

      if (commentsError) throw commentsError;

      // Obtener lecturas recientes
      const { data: recentReadings, error: recentReadingsError } = await supabase
        .from('readings')
        .select(`
          *,
          meter:meters(code_meter, location)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentReadingsError) throw recentReadingsError;

      // Obtener medidores con problemas
      const { data: metersWithIssues, error: metersWithIssuesError } = await supabase
        .from('meters')
        .select('code_meter, location, status')
        .neq('status', 'active')
        .limit(5);

      if (metersWithIssuesError) throw metersWithIssuesError;

      setData({
        totalMeters: metersData?.length || 0,
        totalReadings: readingsData?.length || 0,
        totalComments: commentsData?.length || 0,
        recentReadings: recentReadings || [],
        metersWithIssues: metersWithIssues || [],
      });
    } catch (error: any) {
      console.error('Error al cargar datos:', error);
      setError(error.message || 'Error al cargar los datos del dashboard');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>

      {/* Tarjetas de resumen */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, display: 'flex', alignItems: 'center' }}>
            <WaterDropIcon sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
            <Box>
              <Typography variant="h6">Total Medidores</Typography>
              <Typography variant="h4">{data.totalMeters}</Typography>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, display: 'flex', alignItems: 'center' }}>
            <SpeedIcon sx={{ fontSize: 40, color: 'success.main', mr: 2 }} />
            <Box>
              <Typography variant="h6">Total Lecturas</Typography>
              <Typography variant="h4">{data.totalReadings}</Typography>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, display: 'flex', alignItems: 'center' }}>
            <CommentIcon sx={{ fontSize: 40, color: 'info.main', mr: 2 }} />
            <Box>
              <Typography variant="h6">Total Comentarios</Typography>
              <Typography variant="h4">{data.totalComments}</Typography>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, display: 'flex', alignItems: 'center' }}>
            <WarningIcon sx={{ fontSize: 40, color: 'warning.main', mr: 2 }} />
            <Box>
              <Typography variant="h6">Medidores con Problemas</Typography>
              <Typography variant="h4">{data.metersWithIssues.length}</Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Lecturas recientes */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Lecturas Recientes
        </Typography>
        <Grid container spacing={2}>
          {data.recentReadings.map((reading) => (
            <Grid item xs={12} sm={6} md={4} key={reading.id}>
              <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                <Typography variant="subtitle1">
                  Medidor: {reading.meter.code_meter}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Ubicación: {reading.meter.location}
                </Typography>
                <Typography variant="body2">
                  Valor: {reading.value} m³
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Período: {reading.period}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Fecha: {new Date(reading.created_at).toLocaleDateString()}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Paper>

      {/* Medidores con problemas */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Medidores con Problemas
        </Typography>
        <Grid container spacing={2}>
          {data.metersWithIssues.map((meter) => (
            <Grid item xs={12} sm={6} md={4} key={meter.code_meter}>
              <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                <Typography variant="subtitle1">
                  Código: {meter.code_meter}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Ubicación: {meter.location}
                </Typography>
                <Typography variant="body2" color="error">
                  Estado: {meter.status}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Paper>
    </Box>
  );
};

export default Dashboard; 