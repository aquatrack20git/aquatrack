import React, { useState, useEffect } from 'react';
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

const Home: React.FC = () => {
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB en bytes
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
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'info' | 'warning'
  });

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

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    setSnackbar({
      open: true,
      message,
      severity
    });
  };

  const handlePhotoCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        // Validar tamaño máximo (5MB)
        if (file.size > MAX_FILE_SIZE) {
          showSnackbar('La foto es muy pesada. Por favor, elige una imagen más ligera (máximo 5MB)', 'warning');
          return;
        }

        // Validar tipo de archivo
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
          showSnackbar('Por favor, elige una imagen en formato JPG, PNG o WebP', 'warning');
          return;
        }

        const compressedFile = await compressImage(file);
        setPhoto(compressedFile);

        // Si estamos offline, guardar la foto en pendingPhotos
        if (!isOnline) {
          const newPendingPhoto: PendingPhoto = {
            meterCode: meterCode.trim(),
            file: compressedFile,
            timestamp: Date.now()
          };
          setPendingPhotos(prev => [...prev, newPendingPhoto]);
          showSnackbar('Foto guardada localmente. Se sincronizará cuando vuelvas a tener conexión', 'info');
        }
      } catch (error) {
        console.error('Error al procesar la imagen:', error);
        showSnackbar('Ups, hubo un problema al procesar la foto. ¿Podrías intentarlo de nuevo?', 'warning');
      }
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

      if (isOnline) {
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
          const fileExt = photo.name.split('.').pop();
          const fileName = `${meterCode}_${Date.now()}.${fileExt}`;
          try {
            console.log('Intentando subir archivo:', fileName);
            
            // Intentar subir directamente
            const { error: uploadError, data } = await supabase.storage
              .from('meter-photos')
              .upload(fileName, photo, {
                cacheControl: '3600',
                upsert: false
              });

            if (uploadError) {
              console.error('Error al subir archivo:', uploadError);
              if (uploadError.message.includes('bucket') || uploadError.message.includes('not found')) {
                throw new Error('El bucket de fotos no está disponible. Por favor, contacta al administrador para que cree el bucket "meter-photos" en Supabase.');
              }
              if (uploadError.message.includes('security policy')) {
                throw new Error('No tienes permisos para subir fotos. Por favor, contacta al administrador para verificar los permisos de acceso.');
              }
              throw uploadError;
            }

            console.log('Archivo subido exitosamente:', data);

            const { data: { publicUrl } } = supabase.storage
              .from('meter-photos')
              .getPublicUrl(fileName);

            console.log('URL pública generada:', publicUrl);
            photoUrl = publicUrl;
          } catch (error: any) {
            console.error('Error al subir la foto:', error);
            let mensajeError = (error instanceof Error) ? (error.message || "Error al subir la foto") : "Error al subir la foto";
            if (mensajeError.includes("BUCKET NOT FOUND") || mensajeError.includes("BUCKET NO FOUND")) {
               mensajeError = "EL BUCKET METER-PHOTOS NO EXISTE POR FAVOR CONTACTA AL ADMINISTRADOR";
            }
            showSnackbar(mensajeError, 'error');
            return;
          }
        }

        // Create reading
        const { error: readingError } = await supabase
          .from('readings')
          .insert([{
            meter_id: meterCode.trim(),
            value,
            period,
            photo_url: photoUrl,
            created_at: new Date().toISOString()
          }]);

        if (readingError) throw readingError;

        // Limpiar formulario
        setMeterCode('');
        setReadingValue('');
        setPhoto(null);
        showSnackbar('¡Listo! Tu lectura se guardó correctamente');
      } else {
        // Guardar lectura localmente
        const newReading: PendingReading = {
          meterCode: meterCode.trim(),
          value,
          period,
          timestamp: Date.now(),
          photo: photo || undefined
        };

        setPendingReadings(prev => [...prev, newReading]);
        
        // Si hay una foto, ya la guardamos en handlePhotoCapture
        // No necesitamos duplicarla aquí
        
        setMeterCode('');
        setReadingValue('');
        setPhoto(null);
        showSnackbar('¡Listo! Tu lectura se guardó y se sincronizará cuando vuelvas a tener conexión');
      }
    } catch (error: any) {
      console.error('Error al guardar la lectura:', error);
      showSnackbar(error.message || 'Ups, no pudimos guardar tu lectura. ¿Podrías intentarlo de nuevo?', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const saveReadingLocally = () => {
    if (!meterCode.trim() || !readingValue.trim()) {
      showSnackbar('Por favor, completa el código del medidor y el valor de la lectura', 'info');
      return;
    }

    const value = parseInt(readingValue);
    if (isNaN(value)) {
      showSnackbar('El valor de la lectura debe ser un número sin decimales', 'info');
      return;
    }

    const newReading: PendingReading = {
      meterCode: meterCode.trim(),
      value,
      period: getCurrentPeriod(),
      timestamp: Date.now(),
      photo: photo || undefined
    };

    setPendingReadings(prev => [...prev, newReading]);
    setMeterCode('');
    setReadingValue('');
    setPhoto(null);
    showSnackbar('¡Listo! Tu lectura se guardó y se sincronizará cuando vuelvas a tener conexión');
  };

  const handleSync = async () => {
    if (!isOnline) {
      showSnackbar('No hay conexión a internet. Tus datos se guardarán localmente', 'info');
      return;
    }

    setSyncStatus('syncing');
    try {
      // Sincronizar fotos pendientes primero
      for (const pendingPhoto of pendingPhotos) {
        const fileExt = pendingPhoto.file.name.split('.').pop();
        const fileName = `${pendingPhoto.meterCode}_${pendingPhoto.timestamp}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('meter-photos')
          .upload(fileName, pendingPhoto.file);

        if (uploadError) {
          let mensajeError = (uploadError instanceof Error) ? (uploadError.message || "Error al sincronizar") : "Error al sincronizar";
          if (mensajeError.includes("BUCKET NOT FOUND") || mensajeError.includes("BUCKET NO FOUND")) {
             mensajeError = "EL BUCKET METER-PHOTOS NO EXISTE POR FAVOR CONTACTA AL ADMINISTRADOR";
          }
          showSnackbar(mensajeError, 'error');
          throw uploadError;
        }
      }

      // Sincronizar lecturas pendientes
      for (const reading of pendingReadings) {
        const { error: meterError } = await supabase
          .from('meters')
          .insert([{
            code_meter: reading.meterCode,
            status: 'active'
          }])
          .select()
          .single();

        if (meterError && meterError.code !== '23505') { // Ignorar error de duplicado
          throw meterError;
        }

        let photoUrl = '';
        if (reading.photo) {
          const fileExt = reading.photo.name.split('.').pop();
          const fileName = `${reading.meterCode}_${reading.timestamp}.${fileExt}`;
          const { error: uploadError } = await supabase.storage
            .from('meter-photos')
            .upload(fileName, reading.photo);

          if (uploadError) {
            let mensajeError = (uploadError instanceof Error) ? (uploadError.message || "Error al sincronizar") : "Error al sincronizar";
            if (mensajeError.includes("BUCKET NOT FOUND") || mensajeError.includes("BUCKET NO FOUND")) {
               mensajeError = "EL BUCKET METER-PHOTOS NO EXISTE POR FAVOR CONTACTA AL ADMINISTRADOR";
            }
            showSnackbar(mensajeError, 'error');
            throw uploadError;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('meter-photos')
            .getPublicUrl(fileName);

          photoUrl = publicUrl;
        }

        const { error: readingError } = await supabase
          .from('readings')
          .insert([{
            meter_id: reading.meterCode,
            value: reading.value,
            period: reading.period,
            photo_url: photoUrl,
            created_at: new Date(reading.timestamp).toISOString()
          }]);

        if (readingError) throw readingError;
      }

      // Sincronizar comentarios pendientes
      for (const comment of pendingComments) {
        const { error: commentError } = await supabase
          .from('comments')
          .insert([{
            meter_id_comment: comment.meterCode,
            notes: comment.notes,
            created_at: new Date(comment.timestamp).toISOString()
          }]);

        if (commentError) throw commentError;
      }

      // Limpiar datos pendientes incluyendo fotos
      setPendingReadings([]);
      setPendingComments([]);
      setPendingPhotos([]);
      localStorage.removeItem('pendingReadings');
      localStorage.removeItem('pendingComments');
      localStorage.removeItem('pendingPhotos');

      setSyncStatus('success');
      showSnackbar('¡Perfecto! Todos tus datos se sincronizaron correctamente');
    } catch (error: any) {
      console.error('Error al sincronizar:', error);
      setSyncStatus('error');
      showSnackbar(error.message || 'Ups, hubo un problema al sincronizar. No te preocupes, tus datos están seguros', 'error');
    }
  };

  const handleCommentSubmit = async () => {
    if (!meterCode.trim() || !comment.trim()) {
      showSnackbar('Por favor, completa el código del medidor y tu comentario', 'info');
      return;
    }

    if (isOnline) {
      try {
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

        // Create comment
        const { error: commentError } = await supabase
          .from('comments')
          .insert([{
            meter_id_comment: meterCode.trim(),
            notes: comment.trim(),
            created_at: new Date().toISOString()
          }]);

        if (commentError) throw commentError;

        setMeterCode('');
        setComment('');
        setIsCommentDialogOpen(false);
        showSnackbar('¡Listo! Tu comentario se guardó correctamente');
      } catch (error: any) {
        console.error('Error al guardar el comentario:', error);
        showSnackbar('Ups, no pudimos guardar tu comentario. ¿Podrías intentarlo de nuevo?', 'warning');
      }
    } else {
      // Guardar comentario localmente
      const newComment: PendingComment = {
        meterCode: meterCode.trim(),
        notes: comment.trim(),
        timestamp: Date.now()
      };

      setPendingComments(prev => [...prev, newComment]);
      setMeterCode('');
      setComment('');
      setIsCommentDialogOpen(false);
      showSnackbar('¡Listo! Tu comentario se guardó y se sincronizará cuando vuelvas a tener conexión');
    }
  };

  const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          // Reducir dimensiones máximas para fotos de medidores
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          // Calcular nuevas dimensiones manteniendo la proporción
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

          // Asegurar que las dimensiones sean números enteros
          width = Math.floor(width);
          height = Math.floor(height);

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          // Mejorar la calidad de la imagen
          ctx!.imageSmoothingEnabled = true;
          ctx!.imageSmoothingQuality = 'high';
          
          ctx?.drawImage(img, 0, 0, width, height);

          // Ajustar la calidad de compresión según el tamaño original
          let quality = 0.8; // calidad por defecto
          if (file.size > 2 * 1024 * 1024) { // si es mayor a 2MB
            quality = 0.6; // mayor compresión
          } else if (file.size < 500 * 1024) { // si es menor a 500KB
            quality = 0.9; // menor compresión
          }

          canvas.toBlob(
            (blob) => {
              if (blob) {
                // Verificar el tamaño final
                if (blob.size > MAX_FILE_SIZE) {
                  // Si aún es muy grande, intentar con más compresión
                  canvas.toBlob(
                    (finalBlob) => {
                      if (finalBlob) {
                        const compressedFile = new File([finalBlob], file.name, {
                          type: 'image/jpeg',
                          lastModified: Date.now(),
                        });
                        resolve(compressedFile);
                      } else {
                        reject(new Error('Error al comprimir la imagen'));
                      }
                    },
                    'image/jpeg',
                    0.5 // compresión más agresiva
                  );
                } else {
                  const compressedFile = new File([blob], file.name, {
                    type: 'image/jpeg',
                    lastModified: Date.now(),
                  });
                  resolve(compressedFile);
                }
              } else {
                reject(new Error('Error al comprimir la imagen'));
              }
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = () => {
          reject(new Error('Error al cargar la imagen'));
        };
      };
      reader.onerror = () => {
        reject(new Error('Error al leer el archivo'));
      };
    });
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
          >
            Tienes {pendingReadings.length} lectura{pendingReadings.length !== 1 ? 's' : ''}, {pendingPhotos.length} foto{pendingPhotos.length !== 1 ? 's' : ''} y {pendingComments.length} comentario{pendingComments.length !== 1 ? 's' : ''} pendientes de sincronizar.
            {isOnline && (
              <Button
                startIcon={<SyncIcon />}
                onClick={handleSync}
                disabled={syncStatus === 'syncing'}
                sx={{ ml: 2 }}
              >
                {syncStatus === 'syncing' ? 'Sincronizando...' : 'Sincronizar ahora'}
              </Button>
            )}
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
                fullWidth
                disabled={isLoading}
                sx={{ 
                  py: { xs: 1.5, sm: 2 },
                  fontSize: { xs: '0.875rem', sm: '1rem' },
                  '&:hover': {
                    transform: 'scale(1.02)'
                  },
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                {isLoading ? 'Guardando...' : 'Guardar lectura'}
              </Button>
            </Grid>
            <Grid item xs={12}>
              <Button
                variant="outlined"
                fullWidth
                startIcon={<CommentIcon />}
                onClick={() => setIsCommentDialogOpen(true)}
                sx={{ 
                  py: { xs: 1.5, sm: 2 },
                  fontSize: { xs: '0.875rem', sm: '1rem' },
                  '&:hover': {
                    transform: 'scale(1.02)'
                  },
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                Agregar comentario
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
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button 
            onClick={() => setIsCommentDialogOpen(false)}
            sx={{ 
              mr: 1,
              '&:hover': {
                transform: 'scale(1.05)'
              },
              transition: 'all 0.2s ease-in-out'
            }}
          >
            Cancelar
          </Button>
          <Button 
            variant="contained" 
            onClick={handleCommentSubmit}
            sx={{ 
              '&:hover': {
                transform: 'scale(1.05)'
              },
              transition: 'all 0.2s ease-in-out'
            }}
          >
            Guardar comentario
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        sx={{
          '& .MuiAlert-root': {
            minWidth: '300px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            borderRadius: '8px',
            '& .MuiAlert-icon': {
              padding: '8px 0',
              marginRight: '12px'
            },
            '& .MuiAlert-message': {
              padding: '8px 0',
              fontSize: '14px',
              fontWeight: 500
            }
          }
        }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ 
            width: '100%',
            '&.MuiAlert-standardSuccess': {
              backgroundColor: 'rgba(46, 125, 50, 0.95)',
              color: 'white',
              '& .MuiAlert-icon': { color: 'white' }
            },
            '&.MuiAlert-standardError': {
              backgroundColor: 'rgba(211, 47, 47, 0.95)',
              color: 'white',
              '& .MuiAlert-icon': { color: 'white' }
            },
            '&.MuiAlert-standardWarning': {
              backgroundColor: 'rgba(237, 108, 2, 0.95)',
              color: 'white',
              '& .MuiAlert-icon': { color: 'white' }
            },
            '&.MuiAlert-standardInfo': {
              backgroundColor: 'rgba(2, 136, 209, 0.95)',
              color: 'white',
              '& .MuiAlert-icon': { color: 'white' }
            }
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default Home; 