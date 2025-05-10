import { useEffect, useState } from 'react';
import {
  Grid,
  Paper,
  Typography,
  Box,
  CircularProgress,
} from '@mui/material';
import {
  WaterDrop as WaterDropIcon,
  List as ListIcon,
  Comment as CommentIcon,
} from '@mui/icons-material';
import { supabase } from '../config/supabase';
import { getCurrentPeriod } from '../utils/periodUtils';

interface DashboardStats {
  totalMeters: number;
  activeMeters: number;
  totalReadings: number;
  totalComments: number;
  currentPeriodReadings: number;
  currentPeriodConsumption: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalMeters: 0,
    activeMeters: 0,
    totalReadings: 0,
    totalComments: 0,
    currentPeriodReadings: 0,
    currentPeriodConsumption: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const currentPeriod = getCurrentPeriod();

        // Get total meters
        const { count: totalMeters } = await supabase
          .from('meters')
          .select('*', { count: 'exact', head: true });

        // Get active meters
        const { count: activeMeters } = await supabase
          .from('meters')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active');

        // Get total readings
        const { count: totalReadings } = await supabase
          .from('readings')
          .select('*', { count: 'exact', head: true });

        // Get total comments
        const { count: totalComments } = await supabase
          .from('comments')
          .select('*', { count: 'exact', head: true });

        // Get current period readings
        const { count: currentPeriodReadings } = await supabase
          .from('readings')
          .select('*', { count: 'exact', head: true })
          .eq('period', currentPeriod);

        // Calculate current period consumption
        const { data: currentPeriodData } = await supabase
          .from('readings')
          .select('value')
          .eq('period', currentPeriod);

        const currentPeriodConsumption = currentPeriodData?.reduce(
          (acc, reading) => acc + Number(reading.value),
          0
        ) || 0;

        setStats({
          totalMeters: totalMeters || 0,
          activeMeters: activeMeters || 0,
          totalReadings: totalReadings || 0,
          totalComments: totalComments || 0,
          currentPeriodReadings: currentPeriodReadings || 0,
          currentPeriodConsumption,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

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
        Dashboard
      </Typography>
      <Typography variant="subtitle1" gutterBottom>
        Período actual: {getCurrentPeriod()}
      </Typography>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} sm={6} md={4}>
          <Paper sx={{ p: 2 }}>
            <Box display="flex" alignItems="center">
              <WaterDropIcon color="primary" sx={{ mr: 1 }} />
              <Box>
                <Typography variant="h6">Medidores</Typography>
                <Typography variant="h4">{stats.totalMeters}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {stats.activeMeters} activos
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Paper sx={{ p: 2 }}>
            <Box display="flex" alignItems="center">
              <ListIcon color="primary" sx={{ mr: 1 }} />
              <Box>
                <Typography variant="h6">Lecturas</Typography>
                <Typography variant="h4">{stats.totalReadings}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {stats.currentPeriodReadings} en período actual
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Paper sx={{ p: 2 }}>
            <Box display="flex" alignItems="center">
              <CommentIcon color="primary" sx={{ mr: 1 }} />
              <Box>
                <Typography variant="h6">Comentarios</Typography>
                <Typography variant="h4">{stats.totalComments}</Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Consumo del Período Actual
            </Typography>
            <Typography variant="h3" color="primary">
              {stats.currentPeriodConsumption.toLocaleString()} m³
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard; 