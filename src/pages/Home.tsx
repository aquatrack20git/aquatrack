import { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  IconButton,
  InputAdornment,
} from '@mui/material';
import {
  WaterDrop as WaterDropIcon,
  PhotoCamera as PhotoCameraIcon,
  Comment as CommentIcon,
  Sync as SyncIcon,
  CloudOff as CloudOffIcon,
  CloudDone as CloudDoneIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  Numbers as NumbersIcon,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import { supabase } from '../config/supabase';
import { getCurrentPeriod } from '../utils/periodUtils';
import type { Meter, Reading } from '../types';
import banner from '../assets/images/banner.png';
import sello from '../assets/images/sello.png';

interface PendingPhoto {
  meterCode: string;
  file: File;
  timestamp: number;
}

interface PendingReading {
  meterCode: string;
  value: number;
  period: string;
  timestamp: number;
  photo?: File;
}

interface PendingComment {
  meterCode: string;
  notes: string;
  timestamp: number;
}

// Función para comprimir imagen
const compressImage = async (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              reject(new Error('Error al comprimir la imagen'));
            }
          },
          'image/jpeg',
          0.7
        );
      };
    };
    reader.onerror = (error) => reject(error);
  });
};

const Home = () => {
  const [meterCode, setMeterCode] = useState('');
  const [readingValue, setReadingValue] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [comment, setComment] = useState('');
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [pendingReadings, setPendingReadings] = useState<PendingReading[]>([]);
  const [pendingComments, setPendingComments] = useState<PendingComment[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');

  // Verificar estado de conexión
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Cargar datos pendientes del localStorage al iniciar
  useEffect(() => {
    const savedPhotos = localStorage.getItem('pendingPhotos');
    const savedReadings = localStorage.getItem('pendingReadings');
    const savedComments = localStorage.getItem('pendingComments');
    
    if (savedPhotos) {
      try {
        const parsedPhotos = JSON.parse(savedPhotos);
        setPendingPhotos(parsedPhotos);
      } catch (error) {
        console.error('Error al cargar fotos pendientes:', error);
      }
    }

    if (savedReadings) {
      try {
        const parsedReadings = JSON.parse(savedReadings);
        setPendingReadings(parsedReadings);
      } catch (error) {
        console.error('Error al cargar lecturas pendientes:', error);
      }
    }

    if (savedComments) {
      try {
        const parsedComments = JSON.parse(savedComments);
        setPendingComments(parsedComments);
      } catch (error) {
        console.error('Error al cargar comentarios pendientes:', error);
      }
    }
  }, []);

  // Guardar datos pendientes en localStorage cuando cambien
  useEffect(() => {
    localStorage.setItem('pendingPhotos', JSON.stringify(pendingPhotos));
    localStorage.setItem('pendingReadings', JSON.stringify(pendingReadings));
    localStorage.setItem('pendingComments', JSON.stringify(pendingComments));
  }, [pendingPhotos, pendingReadings, pendingComments]);

  const handlePhotoCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        const compressedFile = await compressImage(file);
        setPhoto(compressedFile);
      } catch (error) {
        console.error('Error al procesar la imagen:', error);
        toast.error('Error al procesar la imagen');
      }
    }
  };

  const saveReadingLocally = () => {
    if (!meterCode.trim() || !readingValue) {
      toast.error('Por favor complete todos los campos');
      return;
    }

    const value = parseInt(readingValue);
    if (isNaN(value)) {
      toast.error('El valor debe ser un número entero');
      return;
    }

    const pendingReading: PendingReading = {
      meterCode: meterCode.trim(),
      value,
      period: getCurrentPeriod(),
      timestamp: Date.now(),
      photo: photo || undefined
    };

    setPendingReadings(prev => [...prev, pendingReading]);
    toast.success('Lectura guardada localmente');
    
    // Limpiar formulario
    setMeterCode('');
    setReadingValue('');
    setPhoto(null);
  };

  const syncPendingData = async () => {
    if (pendingReadings.length === 0 && pendingPhotos.length === 0 && pendingComments.length === 0) {
      toast.info('No hay datos pendientes para sincronizar');
      return;
    }

    setSyncStatus('syncing');
    const failedReadings: PendingReading[] = [];
    const failedComments: PendingComment[] = [];

    // Sincronizar comentarios
    for (const comment of pendingComments) {
      try {
        const { error } = await supabase
          .from('comments')
          .insert([{
            meter_id_comment: comment.meterCode,
            notes: comment.notes
          }]);

        if (error) throw error;

        // Si todo salió bien, eliminar el comentario de las pendientes
        setPendingComments(prev => prev.filter(c => c.timestamp !== comment.timestamp));
      } catch (error) {
        console.error('Error al sincronizar comentario:', error);
        failedComments.push(comment);
      }
    }

    // Sincronizar lecturas
    for (const reading of pendingReadings) {
      try {
        // Verificar si existe el medidor
        const { data: existingMeter, error: meterCheckError } = await supabase
          .from('meters')
          .select('*')
          .eq('code_meter', reading.meterCode)
          .single();

        if (meterCheckError && meterCheckError.code !== 'PGRST116') {
          throw meterCheckError;
        }

        if (!existingMeter) {
          // Crear medidor si no existe
          const { error: meterError } = await supabase
            .from('meters')
            .insert([{
              code_meter: reading.meterCode,
              status: 'active'
            }]);

          if (meterError) throw meterError;
        }

        // Subir foto si existe
        let photoUrl = '';
        if (reading.photo) {
          try {
            console.log('Iniciando compresión de foto pendiente...');
            // Comprimir la foto antes de subirla
            const compressedPhoto = await compressImage(reading.photo);
            console.log('Foto pendiente comprimida exitosamente');
            
            const fileExt = compressedPhoto.name.split('.').pop();
            const fileName = `${reading.meterCode}-${reading.timestamp}.${fileExt}`;
            
            console.log('Intentando subir foto pendiente comprimida:', fileName);
            
            // Subir la foto al storage
            const { error: uploadError, data } = await supabase.storage
              .from('meter-photos')
              .upload(fileName, compressedPhoto, {
                cacheControl: '3600',
                upsert: true
              });

            if (uploadError) {
              console.error('Error al subir la foto pendiente:', uploadError);
              throw uploadError;
            }

            console.log('Foto pendiente subida exitosamente:', data);

            // Obtener la URL pública de la foto
            const { data: { publicUrl } } = supabase.storage
              .from('meter-photos')
              .getPublicUrl(fileName);

            photoUrl = publicUrl;
            console.log('URL pública de la foto pendiente:', photoUrl);
          } catch (photoError) {
            console.error('Error al procesar la foto pendiente:', photoError);
            toast.warning('La lectura se guardó pero hubo un error al subir la foto');
          }
        }

        // Verificar lectura existente
        const { data: existingReading, error: readingCheckError } = await supabase
          .from('readings')
          .select('*')
          .eq('meter_id', reading.meterCode)
          .eq('period', reading.period)
          .single();

        if (readingCheckError && readingCheckError.code !== 'PGRST116') {
          throw readingCheckError;
        }

        if (existingReading) {
          // Actualizar lectura existente
          const { error: updateError } = await supabase
            .from('readings')
            .update({
              value: reading.value,
              photo_url: photoUrl || existingReading.photo_url
            })
            .eq('id', existingReading.id);

          if (updateError) throw updateError;
        } else {
          // Crear nueva lectura
          const { error: readingError } = await supabase
            .from('readings')
            .insert([{
              meter_id: reading.meterCode,
              value: reading.value,
              photo_url: photoUrl,
              period: reading.period
            }]);

          if (readingError) {
            console.error('Error al crear lectura:', readingError);
            throw readingError;
          }
        }

        // Si todo salió bien, eliminar la lectura de las pendientes
        setPendingReadings(prev => prev.filter(r => r.timestamp !== reading.timestamp));
      } catch (error) {
        console.error('Error al sincronizar lectura:', error);
        failedReadings.push(reading);
      }
    }

    if (failedReadings.length === 0 && failedComments.length === 0) {
      toast.success('Todos los datos se sincronizaron correctamente');
      setSyncStatus('success');
    } else {
      if (failedReadings.length > 0) {
        setPendingReadings(failedReadings);
      }
      if (failedComments.length > 0) {
        setPendingComments(failedComments);
      }
      toast.error(`${failedReadings.length} lecturas y ${failedComments.length} comentarios no pudieron sincronizarse`);
      setSyncStatus('error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const period = getCurrentPeriod();
      
      // Validar que el valor sea un número entero
      const value = parseInt(readingValue);
      if (isNaN(value)) {
        throw new Error('El valor debe ser un número entero');
      }

      // Validar que el código del medidor no esté vacío
      if (!meterCode.trim()) {
        throw new Error('El código del medidor es requerido');
      }
      
      // Check if meter exists
      const { data: existingMeter, error: meterCheckError } = await supabase
        .from('meters')
        .select('*')
        .eq('code_meter', meterCode)
        .single();

      if (meterCheckError && meterCheckError.code !== 'PGRST116') {
        throw meterCheckError;
      }

      if (!existingMeter) {
        // Create new meter
        const { error: meterError } = await supabase
          .from('meters')
          .insert([{
            code_meter: meterCode.trim(),
            status: 'active'
          }]);

        if (meterError) throw meterError;
      }

      // Upload photo if exists
      let photoUrl = '';
      if (photo) {
        try {
          console.log('Iniciando compresión de foto...');
          // Comprimir la foto antes de subirla
          const compressedPhoto = await compressImage(photo);
          console.log('Foto comprimida exitosamente');
          
          const fileExt = compressedPhoto.name.split('.').pop();
          const fileName = `${meterCode}-${Date.now()}.${fileExt}`;
          
          console.log('Intentando subir foto comprimida:', fileName);
          
          // Subir la foto al storage
          const { error: uploadError, data } = await supabase.storage
            .from('meter-photos')
            .upload(fileName, compressedPhoto, {
              cacheControl: '3600',
              upsert: true
            });

          if (uploadError) {
            console.error('Error al subir la foto:', uploadError);
            throw uploadError;
          }

          console.log('Foto subida exitosamente:', data);

          // Obtener la URL pública de la foto
          const { data: { publicUrl } } = supabase.storage
            .from('meter-photos')
            .getPublicUrl(fileName);

          photoUrl = publicUrl;
          console.log('URL pública de la foto:', photoUrl);
        } catch (photoError) {
          console.error('Error al procesar la foto:', photoError);
          toast.warning('La lectura se guardó pero hubo un error al subir la foto');
        }
      }

      // Check for existing reading in the same period
      const { data: existingReading, error: readingCheckError } = await supabase
        .from('readings')
        .select('*')
        .eq('meter_id', meterCode)
        .eq('period', period)
        .single();

      if (readingCheckError && readingCheckError.code !== 'PGRST116') {
        throw readingCheckError;
      }

      if (existingReading) {
        // Update existing reading
        const { error: updateError } = await supabase
          .from('readings')
          .update({
            value: value,
            photo_url: photoUrl || existingReading.photo_url
          })
          .eq('id', existingReading.id);

        if (updateError) throw updateError;
      } else {
        // Create new reading
        const { error: readingError } = await supabase
          .from('readings')
          .insert([{
            meter_id: meterCode.trim(),
            value: value,
            photo_url: photoUrl,
            period
          }]);

        if (readingError) throw readingError;
      }

      toast.success('Lectura registrada exitosamente');
      setMeterCode('');
      setReadingValue('');
      setPhoto(null);
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al registrar la lectura');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCommentSubmit = async () => {
    try {
      if (!isOnline) {
        // Guardar comentario localmente
        const pendingComment: PendingComment = {
          meterCode: meterCode.trim(),
          notes: comment,
          timestamp: Date.now()
        };
        setPendingComments(prev => [...prev, pendingComment]);
        toast.success('Comentario guardado localmente');
        setComment('');
        setIsCommentDialogOpen(false);
        return;
      }

      const { error } = await supabase
        .from('comments')
        .insert([{
          meter_id_comment: meterCode,
          notes: comment
        }]);

      if (error) throw error;

      toast.success('Comentario guardado exitosamente');
      setComment('');
      setIsCommentDialogOpen(false);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al guardar el comentario');
    }
  };

  return (
    <Container 
      maxWidth="sm" 
      sx={{ 
        py: { xs: 2, sm: 4 },
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #e0f7fa 0%, #006064 100%)',
        transition: 'all 0.3s ease-in-out'
      }}
    >
      <Paper 
        elevation={3} 
        sx={{ 
          p: { xs: 2, sm: 3 },
          borderRadius: { xs: 0, sm: 2 },
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          transform: 'translateY(0)',
          transition: 'transform 0.3s ease-in-out',
          '&:hover': {
            transform: 'translateY(-5px)'
          }
        }}
      >
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center', 
          mb: 3,
          position: 'relative',
          width: '100%',
          gap: 2
        }}>
          <Box
            component="img"
            src={sello}
            alt="Sello AquaTrack"
            sx={{
              width: { xs: '80px', sm: '100px' },
              height: 'auto',
              filter: 'drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.1))',
              transition: 'transform 0.3s ease-in-out',
              display: 'block',
              margin: '0 auto',
              '&:hover': {
                transform: 'rotate(5deg) scale(1.1)'
              }
            }}
          />
          <Box
            component="img"
            src={banner}
            alt="Banner AquaTrack"
            sx={{
              width: '100%',
              maxWidth: { xs: '280px', sm: '400px' },
              height: 'auto',
              filter: 'drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.1))',
              transition: 'transform 0.3s ease-in-out',
              display: 'block',
              margin: '0 auto',
              '&:hover': {
                transform: 'scale(1.02)'
              }
            }}
          />
          <Typography 
            variant="h4" 
            component="h1" 
            gutterBottom 
            align="center"
            sx={{ 
              fontSize: { xs: '1.75rem', sm: '2.125rem' },
              mb: 0,
              textShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
              background: 'linear-gradient(45deg, #006064 30%, #0097a7 90%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontWeight: 700
            }}
          >
            AquaTrack
          </Typography>
        </Box>
        <Typography 
          variant="subtitle1" 
          gutterBottom 
          align="center"
          sx={{ 
            fontSize: { xs: '0.875rem', sm: '1rem' },
            mb: 4,
            color: 'text.secondary',
            letterSpacing: '0.5px'
          }}
        >
          Registro de consumo de agua
        </Typography>

        {!isOnline && (
          <Alert 
            severity="warning" 
            icon={<CloudOffIcon />}
            sx={{ 
              mb: 2,
              backgroundColor: 'rgba(255, 160, 0, 0.1)',
              '& .MuiAlert-icon': {
                color: 'warning.main'
              },
              animation: 'fadeIn 0.5s ease-in-out',
              '@keyframes fadeIn': {
                '0%': { opacity: 0, transform: 'translateY(-10px)' },
                '100%': { opacity: 1, transform: 'translateY(0)' }
              }
            }}
          >
            Estás trabajando sin conexión. Los datos se guardarán localmente.
          </Alert>
        )}

        {(pendingReadings.length > 0 || pendingPhotos.length > 0 || pendingComments.length > 0) && (
          <Alert 
            severity="info" 
            icon={<CloudDoneIcon />}
            sx={{ 
              mb: 2,
              backgroundColor: 'rgba(2, 136, 209, 0.1)',
              '& .MuiAlert-icon': {
                color: 'info.main'
              },
              animation: 'slideIn 0.5s ease-in-out',
              '@keyframes slideIn': {
                '0%': { opacity: 0, transform: 'translateX(-10px)' },
                '100%': { opacity: 1, transform: 'translateX(0)' }
              }
            }}
            action={
              <Button 
                color="inherit" 
                size="small" 
                onClick={syncPendingData}
                disabled={!isOnline || syncStatus === 'syncing'}
                startIcon={<SyncIcon />}
                sx={{ 
                  minWidth: { xs: 'auto', sm: '100px' },
                  px: { xs: 1, sm: 2 },
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.3)',
                    transform: 'scale(1.05)'
                  },
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                {syncStatus === 'syncing' ? 'Sincronizando...' : 'Sincronizar'}
              </Button>
            }
          >
            {pendingReadings.length} lectura(s) y {pendingComments.length} comentario(s) pendiente(s) de sincronizar
          </Alert>
        )}

        <Box 
          component="form" 
          onSubmit={(e) => {
            e.preventDefault();
            if (isOnline) {
              handleSubmit(e);
            } else {
              saveReadingLocally();
            }
          }} 
          sx={{ 
            mt: 3,
            '& .MuiTextField-root': {
              mb: { xs: 1, sm: 2 },
              transition: 'all 0.3s ease-in-out',
              '&:hover': {
                transform: 'translateY(-2px)'
              }
            }
          }}
        >
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Código del medidor"
                value={meterCode}
                onChange={(e) => setMeterCode(e.target.value)}
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <WaterDropIcon color="primary" />
                    </InputAdornment>
                  ),
                  style: { fontSize: '16px' }
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '&:hover fieldset': {
                      borderColor: 'primary.main',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: 'primary.main',
                      borderWidth: 2
                    }
                  }
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Valor de la lectura"
                type="number"
                value={readingValue}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || /^\d+$/.test(value)) {
                    setReadingValue(value);
                  }
                }}
                required
                InputProps={{ 
                  startAdornment: (
                    <InputAdornment position="start">
                      <NumbersIcon color="primary" />
                    </InputAdornment>
                  ),
                  style: { fontSize: '16px' }
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '&:hover fieldset': {
                      borderColor: 'primary.main',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: 'primary.main',
                      borderWidth: 2
                    }
                  }
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <Button
                variant="contained"
                component="label"
                fullWidth
                startIcon={<PhotoCameraIcon />}
                sx={{ 
                  py: { xs: 1.5, sm: 2 },
                  fontSize: { xs: '0.875rem', sm: '1rem' },
                  backgroundColor: 'secondary.main',
                  '&:hover': {
                    backgroundColor: 'secondary.dark',
                    transform: 'scale(1.02)'
                  },
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                Tomar foto
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoCapture}
                />
              </Button>
              {photo && (
                <Typography 
                  variant="body2" 
                  sx={{ 
                    mt: 1,
                    fontSize: { xs: '0.75rem', sm: '0.875rem' },
                    color: 'text.secondary',
                    animation: 'fadeIn 0.5s ease-in-out',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5
                  }}
                >
                  <PhotoCameraIcon fontSize="small" color="primary" />
                  Foto seleccionada: {photo.name}
                </Typography>
              )}
            </Grid>
            <Grid item xs={12}>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                disabled={isLoading}
                startIcon={<SaveIcon />}
                sx={{ 
                  py: { xs: 1.5, sm: 2 },
                  fontSize: { xs: '0.875rem', sm: '1rem' },
                  '&:hover': {
                    transform: 'scale(1.02)'
                  },
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                {isLoading ? 'Guardando...' : isOnline ? 'Guardar lectura' : 'Guardar localmente'}
              </Button>
            </Grid>
            <Grid item xs={12}>
              <Button
                variant="outlined"
                color="secondary"
                fullWidth
                onClick={() => setIsCommentDialogOpen(true)}
                startIcon={<CommentIcon />}
                sx={{ 
                  py: { xs: 1.5, sm: 2 },
                  fontSize: { xs: '0.875rem', sm: '1rem' },
                  borderColor: 'secondary.main',
                  color: 'secondary.main',
                  '&:hover': {
                    borderColor: 'secondary.dark',
                    backgroundColor: 'rgba(255, 143, 0, 0.04)',
                    transform: 'scale(1.02)'
                  },
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                Ingresar comentario
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Paper>

      <Dialog 
        open={isCommentDialogOpen} 
        onClose={() => setIsCommentDialogOpen(false)}
        fullScreen={window.innerWidth < 600}
        PaperProps={{
          sx: {
            borderRadius: { xs: 0, sm: 2 },
            background: 'rgba(255, 255, 255, 0.98)',
            animation: 'dialogFadeIn 0.3s ease-in-out',
            '@keyframes dialogFadeIn': {
              '0%': { opacity: 0, transform: 'scale(0.95)' },
              '100%': { opacity: 1, transform: 'scale(1)' }
            }
          }
        }}
      >
        <DialogTitle sx={{ 
          backgroundColor: 'primary.main',
          color: 'white',
          '& .MuiTypography-root': {
            fontWeight: 600
          },
          borderTopLeftRadius: { xs: 0, sm: 8 },
          borderTopRightRadius: { xs: 0, sm: 8 },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CommentIcon />
            Agregar comentario
          </Box>
          <IconButton
            edge="end"
            color="inherit"
            onClick={() => setIsCommentDialogOpen(false)}
            aria-label="close"
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <TextField
            fullWidth
            label="Código del medidor"
            value={meterCode}
            onChange={(e) => setMeterCode(e.target.value)}
            margin="normal"
            required
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <WaterDropIcon color="primary" />
                </InputAdornment>
              ),
              style: { fontSize: '16px' }
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                '&:hover fieldset': {
                  borderColor: 'primary.main',
                },
                '&.Mui-focused fieldset': {
                  borderColor: 'primary.main',
                  borderWidth: 2
                }
              }
            }}
          />
          <TextField
            fullWidth
            label="Comentario"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            margin="normal"
            multiline
            rows={4}
            required
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <CommentIcon color="primary" />
                </InputAdornment>
              ),
              style: { fontSize: '16px' }
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                '&:hover fieldset': {
                  borderColor: 'primary.main',
                },
                '&.Mui-focused fieldset': {
                  borderColor: 'primary.main',
                  borderWidth: 2
                }
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button 
            onClick={() => setIsCommentDialogOpen(false)}
            startIcon={<CloseIcon />}
            sx={{ 
              fontSize: { xs: '0.875rem', sm: '1rem' },
              color: 'text.secondary',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)'
              }
            }}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleCommentSubmit} 
            variant="contained" 
            color="primary"
            startIcon={<SaveIcon />}
            sx={{ 
              fontSize: { xs: '0.875rem', sm: '1rem' },
              '&:hover': {
                transform: 'scale(1.05)'
              },
              transition: 'all 0.2s ease-in-out'
            }}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Home; 