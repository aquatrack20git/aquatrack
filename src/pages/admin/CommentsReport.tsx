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
  CircularProgress,
} from '@mui/material';
import { Download as DownloadIcon } from '@mui/icons-material';
import { supabase } from '../../config/supabase';
import * as XLSX from 'xlsx';

interface Comment {
  id: number;
  meter_id_comment: string;
  notes: string;
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

const CommentsReport: React.FC = () => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [filters, setFilters] = useState({
    meter_id: '',
    start_date: '',
    end_date: '',
  });
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMeters();
    fetchComments();
  }, [filters]);

  const fetchMeters = async () => {
    try {
      const { data, error } = await supabase
        .from('meters')
        .select('code_meter, location')
        .order('code_meter');

      if (error) throw error;
      setMeters(data || []);
    } catch (error: any) {
      console.error('Error fetching meters:', error);
      showSnackbar(error.message || 'Error al cargar los medidores', 'error');
    }
  };

  const fetchComments = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('comments')
        .select(`
          *,
          meter:meters(code_meter, location)
        `)
        .order('created_at', { ascending: false });

      if (filters.meter_id) {
        query = query.eq('meter_id_comment', filters.meter_id);
      }
      if (filters.start_date) {
        query = query.gte('created_at', filters.start_date);
      }
      if (filters.end_date) {
        query = query.lte('created_at', filters.end_date);
      }

      const { data, error } = await query;

      if (error) throw error;
      setComments(data || []);
    } catch (error: any) {
      console.error('Error fetching comments:', error);
      showSnackbar(error.message || 'Error al cargar los comentarios', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name as string]: value,
    }));
  };

  const handleExport = () => {
    const data = comments.map(comment => ({
      'ID': comment.id,
      'Código Medidor': comment.meter.code_meter,
      'Ubicación': comment.meter.location,
      'Comentario': comment.notes,
      'Fecha': new Date(comment.created_at).toLocaleDateString(),
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Comentarios');
    XLSX.writeFile(wb, 'comentarios.xlsx');
  };

  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({
      open: true,
      message,
      severity,
    });
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
        <Typography variant="h4">Reporte de Comentarios</Typography>
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
          <Grid item xs={12} sm={6} md={4}>
            <FormControl fullWidth>
              <InputLabel>Medidor</InputLabel>
              <Select
                name="meter_id"
                value={filters.meter_id}
                onChange={handleFilterChange}
                label="Medidor"
              >
                <MenuItem value="">Todos</MenuItem>
                {meters.map((meter) => (
                  <MenuItem key={meter.code_meter} value={meter.code_meter}>
                    {meter.code_meter} - {meter.location}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
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
          <Grid item xs={12} sm={6} md={4}>
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
              <TableCell>Comentario</TableCell>
              <TableCell>Fecha</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {comments.map((comment) => (
              <TableRow key={comment.id}>
                <TableCell>{comment.id}</TableCell>
                <TableCell>{comment.meter.code_meter}</TableCell>
                <TableCell>{comment.meter.location}</TableCell>
                <TableCell>{comment.notes}</TableCell>
                <TableCell>{new Date(comment.created_at).toLocaleDateString()}</TableCell>
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

export default CommentsReport; 