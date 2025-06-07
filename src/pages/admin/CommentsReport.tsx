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
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import { supabase } from '../../config/supabase';

interface Comment {
  id: string;
  meter_id: string;
  comment: string;
  status: string;
  created_at: string;
  meter?: {
    serial_number: string;
  };
}

interface Meter {
  id: string;
  serial_number: string;
}

const CommentsReport: React.FC = () => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [open, setOpen] = useState(false);
  const [editingComment, setEditingComment] = useState<Comment | null>(null);
  const [formData, setFormData] = useState({
    meter_id: '',
    comment: '',
    status: 'pending',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  });

  useEffect(() => {
    fetchComments();
    fetchMeters();
  }, []);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          meter:meters(serial_number)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setComments(data || []);
    } catch (error: any) {
      console.error('Error fetching comments:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMeters = async () => {
    try {
      const { data, error } = await supabase
        .from('meters')
        .select('id, serial_number')
        .eq('status', 'active')
        .order('serial_number');

      if (error) throw error;
      setMeters(data || []);
    } catch (error: any) {
      console.error('Error fetching meters:', error);
      setError(error.message);
    }
  };

  const handleOpen = (comment?: Comment) => {
    if (comment) {
      setEditingComment(comment);
      setFormData({
        meter_id: comment.meter_id,
        comment: comment.comment,
        status: comment.status,
      });
    } else {
      setEditingComment(null);
      setFormData({
        meter_id: '',
        comment: '',
        status: 'pending',
      });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingComment(null);
    setFormData({
      meter_id: '',
      comment: '',
      status: 'pending',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingComment) {
        const { error } = await supabase
          .from('comments')
          .update({
            meter_id: formData.meter_id,
            comment: formData.comment,
            status: formData.status,
          })
          .eq('id', editingComment.id);

        if (error) throw error;
        showSnackbar('Comentario actualizado exitosamente');
      } else {
        const { error } = await supabase
          .from('comments')
          .insert([{
            meter_id: formData.meter_id,
            comment: formData.comment,
            status: formData.status,
          }]);

        if (error) throw error;
        showSnackbar('Comentario creado exitosamente');
      }

      handleClose();
      fetchComments();
    } catch (error: any) {
      console.error('Error saving comment:', error);
      setError(error.message);
    }
  };

  const handleDelete = async (id: string) => {
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
        setError(error.message);
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

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Gestión de Comentarios</Typography>
        <Button variant="contained" onClick={() => handleOpen()}>
          Nuevo Comentario
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Medidor</TableCell>
              <TableCell>Comentario</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Fecha de Creación</TableCell>
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : comments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  No hay comentarios registrados
                </TableCell>
              </TableRow>
            ) : (
              comments.map((comment) => (
                <TableRow key={comment.id}>
                  <TableCell>{comment.meter?.serial_number}</TableCell>
                  <TableCell>{comment.comment}</TableCell>
                  <TableCell>
                    {comment.status === 'pending' ? 'Pendiente' :
                     comment.status === 'approved' ? 'Aprobado' : 'Rechazado'}
                  </TableCell>
                  <TableCell>
                    {new Date(comment.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <IconButton onClick={() => handleOpen(comment)} color="primary">
                      <EditIcon />
                    </IconButton>
                    <IconButton onClick={() => handleDelete(comment.id)} color="error">
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingComment ? 'Editar Comentario' : 'Nuevo Comentario'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <TextField
              fullWidth
              select
              label="Medidor"
              value={formData.meter_id}
              onChange={(e) => setFormData({ ...formData, meter_id: e.target.value })}
              margin="normal"
              required
              disabled={!!editingComment}
            >
              {meters.map((meter) => (
                <MenuItem key={meter.id} value={meter.id}>
                  {meter.serial_number}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth
              label="Comentario"
              value={formData.comment}
              onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
              margin="normal"
              required
              multiline
              rows={4}
            />
            <TextField
              fullWidth
              select
              label="Estado"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              margin="normal"
              required
            >
              <MenuItem value="pending">Pendiente</MenuItem>
              <MenuItem value="approved">Aprobado</MenuItem>
              <MenuItem value="rejected">Rechazado</MenuItem>
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Cancelar</Button>
            <Button type="submit" variant="contained" color="primary">
              {editingComment ? 'Actualizar' : 'Guardar'}
            </Button>
          </DialogActions>
        </form>
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

export default CommentsReport; 