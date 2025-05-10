import { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  CircularProgress,
  MenuItem,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { supabase } from '../config/supabase';
import type { Comment, Meter } from '../types';

const Comments = () => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingComment, setEditingComment] = useState<Comment | null>(null);
  const [formData, setFormData] = useState({
    meter_id_comment: '',
    notes: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch meters
      const { data: metersData, error: metersError } = await supabase
        .from('meters')
        .select('*')
        .order('code_meter');

      if (metersError) throw metersError;
      setMeters(metersData || []);

      // Fetch comments
      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select('*')
        .order('created_at', { ascending: false });

      if (commentsError) throw commentsError;
      setComments(commentsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (comment?: Comment) => {
    if (comment) {
      setEditingComment(comment);
      setFormData({
        meter_id_comment: comment.meter_id_comment,
        notes: comment.notes,
      });
    } else {
      setEditingComment(null);
      setFormData({
        meter_id_comment: '',
        notes: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingComment(null);
  };

  const handleSubmit = async () => {
    try {
      if (editingComment) {
        const { error } = await supabase
          .from('comments')
          .update({
            notes: formData.notes,
          })
          .eq('id', editingComment.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('comments')
          .insert([{
            meter_id_comment: formData.meter_id_comment,
            notes: formData.notes,
            created_at: new Date().toISOString(),
          }]);

        if (error) throw error;
      }

      handleCloseDialog();
      fetchData();
    } catch (error) {
      console.error('Error saving comment:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Está seguro de eliminar este comentario?')) {
      try {
        const { error } = await supabase
          .from('comments')
          .delete()
          .eq('id', id);

        if (error) throw error;
        fetchData();
      } catch (error) {
        console.error('Error deleting comment:', error);
      }
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
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Comentarios</Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={() => handleOpenDialog()}
        >
          Nuevo Comentario
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Código Medidor</TableCell>
              <TableCell>Comentario</TableCell>
              <TableCell>Fecha</TableCell>
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {comments.map((comment) => (
              <TableRow key={comment.id}>
                <TableCell>{comment.meter_id_comment}</TableCell>
                <TableCell>{comment.notes}</TableCell>
                <TableCell>
                  {new Date(comment.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <IconButton
                    color="primary"
                    onClick={() => handleOpenDialog(comment)}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    color="error"
                    onClick={() => handleDelete(comment.id)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
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
          <TextField
            select
            fullWidth
            label="Medidor"
            value={formData.meter_id_comment}
            onChange={(e) => setFormData({ ...formData, meter_id_comment: e.target.value })}
            margin="normal"
            required
            disabled={!!editingComment}
          >
            {meters.map((meter) => (
              <MenuItem key={meter.code_meter} value={meter.code_meter}>
                {meter.code_meter} - {meter.location}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            label="Comentario"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            margin="normal"
            multiline
            rows={4}
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button onClick={handleSubmit} variant="contained" color="primary">
            {editingComment ? 'Guardar' : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Comments; 