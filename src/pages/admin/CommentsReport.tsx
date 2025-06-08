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
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { 
  Download as DownloadIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { supabase } from '../../config/supabase';
import * as XLSX from 'xlsx';
import { usePermissions } from '../../contexts/PermissionsContext';
import ProtectedAdminRoute from '../../components/ProtectedAdminRoute';

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
  const permissions = usePermissions();
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
  const [openDialog, setOpenDialog] = useState(false);
  const [editingComment, setEditingComment] = useState<Comment | null>(null);
  const [formData, setFormData] = useState({
    notes: '',
  });

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

  const handleSelectChange = (e: SelectChangeEvent<string>) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleOpenDialog = (comment?: Comment) => {
    if (!permissions.isAuthenticated) {
      showSnackbar('Debes iniciar sesión para realizar esta acción', 'error');
      return;
    }

    if (comment) {
      setEditingComment(comment);
      setFormData({
        notes: comment.notes,
      });
    } else {
      setEditingComment(null);
      setFormData({
        notes: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingComment(null);
    setFormData({ notes: '' });
  };

  const handleSubmit = async () => {
    if (!permissions.isAuthenticated) {
      showSnackbar('Debes iniciar sesión para realizar esta acción', 'error');
      return;
    }

    try {
      if (editingComment) {
        const { error } = await supabase
          .from('comments')
          .update({
            notes: formData.notes,
            created_at: new Date().toISOString(),
          })
          .eq('id', editingComment.id);

        if (error) throw error;
        showSnackbar('Comentario actualizado exitosamente');
      }

      handleCloseDialog();
      fetchComments();
    } catch (error: any) {
      console.error('Error saving comment:', error);
      showSnackbar(error.message || 'Error al guardar el comentario', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!permissions.isAuthenticated) {
      showSnackbar('Debes iniciar sesión para realizar esta acción', 'error');
      return;
    }

    if (window.confirm('¿Está seguro de eliminar este comentario?')) {
      try {
        const { error } = await supabase
          .from('comments')
          .delete()
          .eq('id', id);

        if (error) throw error;
        showSnackbar('Comentario eliminado exitosamente');
        fetchComments();
      } catch (error: any) {
        console.error('Error deleting comment:', error);
        showSnackbar(error.message || 'Error al eliminar el comentario', 'error');
      }
    }
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
    <ProtectedAdminRoute>
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
                  onChange={handleSelectChange}
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
                onChange={handleInputChange}
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
                onChange={handleInputChange}
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
                {(permissions.canEdit('comments') || permissions.canDelete('comments')) && (
                  <TableCell>Acciones</TableCell>
                )}
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
                  {(permissions.canEdit('comments') || permissions.canDelete('comments')) && (
                    <TableCell>
                      {permissions.canEdit('comments') && (
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDialog(comment)}
                        >
                          <EditIcon />
                        </IconButton>
                      )}
                      {permissions.canDelete('comments') && (
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(comment.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
          <DialogTitle>
            {editingComment ? 'Editar Comentario' : 'Nuevo Comentario'}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <TextField
                fullWidth
                label="Comentario"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                multiline
                rows={4}
                sx={{ mb: 2 }}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancelar</Button>
            <Button onClick={handleSubmit} variant="contained" color="primary">
              {editingComment ? 'Guardar' : 'Crear'}
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
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
    </ProtectedAdminRoute>
  );
};

export default CommentsReport; 