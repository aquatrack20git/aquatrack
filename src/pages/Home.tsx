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
  file: File | Blob;
  timestamp: number;
}

interface PendingReading {
  meterCode: string;
  value: number;
  period: string;
  timestamp: number;
  photo?: File;
  photoUrl?: string;
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

        // Validar tipo de archivo de manera más flexible
        const fileType = file.type.toLowerCase();
        const isImage = fileType.startsWith('image/');
        if (!isImage) {
          showSnackbar('Por favor, elige una imagen válida (JPG, PNG, WebP)', 'warning');
          return;
        }

        // Comprimir la imagen
        const compressedFile = await compressImage(file);
        setPhoto(compressedFile);

        // Si estamos offline, guardar la foto en pendingPhotos
        if (!isOnline) {
          // Crear un nombre de archivo seguro
          const fileName = `${meterCode.trim()}_${Date.now()}.jpg`;
          const newFile = new File([compressedFile], fileName, { type: 'image/jpeg' });
          
          const newPendingPhoto: PendingPhoto = {
            meterCode: meterCode.trim(),
            file: newFile,
            timestamp: Date.now()
          };
          
          setPendingPhotos(prev => [...prev, newPendingPhoto]);
          showSnackbar('Foto guardada localmente. Se sincronizará cuando vuelvas a tener conexión.', 'info');
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

      // Validar que se haya tomado una foto
      if (!photo) {
        showSnackbar('Por favor, toma una foto del medidor antes de guardar la lectura', 'warning');
        setIsLoading(false);
        return;
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
          photo: photo || undefined,
          photoUrl: photo ? URL.createObjectURL(photo) : undefined
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
      photo: photo || undefined,
      photoUrl: photo ? URL.createObjectURL(photo) : undefined
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
    let syncedReadings = 0;
    let syncedPhotos = 0;
    let syncedComments = 0;
    let errors = 0;
    let failedPhotos: { meterCode: string; timestamp: number; error: string }[] = [];
    let successfullySyncedPhotos: { meterCode: string; timestamp: number }[] = [];

    try {
      // Sincronizar fotos pendientes primero
      const photosToSync = [...pendingPhotos];
      console.log('Fotos pendientes a sincronizar:', photosToSync.length);

      // Ordenar fotos por medidor para mejor seguimiento
      photosToSync.sort((a, b) => a.meterCode.localeCompare(b.meterCode));

      // Intentar sincronizar cada foto hasta 3 veces
      for (const pendingPhoto of photosToSync) {
        let retryCount = 0;
        let success = false;
        let lastError = '';

        while (retryCount < 3 && !success) {
          try {
            // Verificar que el archivo existe y es válido
            if (!pendingPhoto.file || !(pendingPhoto.file instanceof File)) {
              lastError = 'Archivo de foto inválido';
              console.error('Foto inválida:', pendingPhoto);
              errors++;
              break;
            }

            const fileExt = pendingPhoto.file.name.split('.').pop() || 'jpg';
            const fileName = `${pendingPhoto.meterCode}_${pendingPhoto.timestamp}.${fileExt}`;
            
            console.log(`Intentando subir foto para medidor ${pendingPhoto.meterCode} (intento ${retryCount + 1}):`, fileName);
            
            // Primero intentar eliminar la foto si existe
            try {
              const { error: deleteError } = await supabase.storage
                .from('meter-photos')
                .remove([fileName]);
              
              if (deleteError) {
                console.log('No se pudo eliminar la foto existente, continuando con la subida:', deleteError);
              } else {
                console.log('Foto existente eliminada, procediendo con nueva subida');
              }
            } catch (deleteError) {
              console.log('Error al intentar eliminar foto existente, continuando con la subida:', deleteError);
            }
            
            // Intentar subir la foto con upsert forzado
            const { error: uploadError, data } = await supabase.storage
              .from('meter-photos')
              .upload(fileName, pendingPhoto.file, {
                cacheControl: '3600',
                upsert: true,
                duplex: 'half'
              });

            if (uploadError) {
              lastError = uploadError.message;
              console.error(`Error al subir foto para medidor ${pendingPhoto.meterCode} (intento ${retryCount + 1}):`, uploadError);
              if (uploadError.message.includes('bucket') || uploadError.message.includes('not found')) {
                showSnackbar('El bucket de fotos no está disponible. Por favor, contacta al administrador.', 'error');
                throw uploadError;
              }
              retryCount++;
              if (retryCount < 3) {
                console.log(`Reintentando subir foto para medidor ${pendingPhoto.meterCode} (intento ${retryCount + 1})...`);
                await new Promise(resolve => setTimeout(resolve, 2000)); // Aumentar tiempo de espera a 2 segundos
                continue;
              }
              errors++;
              break;
            }

            console.log('Foto subida exitosamente para medidor:', pendingPhoto.meterCode);

            // Obtener URL pública de la foto
            const { data: { publicUrl } } = supabase.storage
              .from('meter-photos')
              .getPublicUrl(fileName);

            console.log('URL pública generada para medidor:', pendingPhoto.meterCode);

            // Buscar la lectura asociada en la base de datos
            const { data: existingReading, error: readingError } = await supabase
              .from('readings')
              .select('*')
              .eq('meter_id', pendingPhoto.meterCode)
              .eq('created_at', new Date(pendingPhoto.timestamp).toISOString())
              .single();

            if (readingError && readingError.code !== 'PGRST116') {
              console.error('Error al buscar lectura:', readingError);
              lastError = readingError.message;
              retryCount++;
              if (retryCount < 3) {
                console.log(`Reintentando buscar lectura para medidor ${pendingPhoto.meterCode} (intento ${retryCount + 1})...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                continue;
              }
              errors++;
              break;
            }

            // Si la lectura existe, actualizar con la URL de la foto
            if (existingReading) {
              const { error: updateError } = await supabase
                .from('readings')
                .update({ photo_url: publicUrl })
                .match({ 
                  meter_id: pendingPhoto.meterCode,
                  created_at: new Date(pendingPhoto.timestamp).toISOString()
                });

              if (updateError) {
                lastError = updateError.message;
                console.error('Error al actualizar lectura con URL de foto para medidor:', pendingPhoto.meterCode, updateError);
                retryCount++;
                if (retryCount < 3) {
                  console.log(`Reintentando actualizar lectura para medidor ${pendingPhoto.meterCode} (intento ${retryCount + 1})...`);
                  await new Promise(resolve => setTimeout(resolve, 2000));
                  continue;
                }
                errors++;
                break;
              }
            } else {
              console.log('No se encontró la lectura asociada para medidor:', pendingPhoto.meterCode);
              // Intentar crear la lectura si no existe
              try {
                const { error: insertError } = await supabase
                  .from('readings')
                  .insert([{
                    meter_id: pendingPhoto.meterCode,
                    value: 0, // Valor por defecto
                    period: getCurrentPeriod(),
                    photo_url: publicUrl,
                    created_at: new Date(pendingPhoto.timestamp).toISOString()
                  }]);

                if (insertError) {
                  console.error('Error al crear lectura para foto:', insertError);
                } else {
                  console.log('Lectura creada para foto del medidor:', pendingPhoto.meterCode);
                }
              } catch (insertError) {
                console.error('Error al intentar crear lectura:', insertError);
              }
            }

            // Si llegamos aquí, la foto se sincronizó correctamente
            success = true;
            syncedPhotos++;
            successfullySyncedPhotos.push({
              meterCode: pendingPhoto.meterCode,
              timestamp: pendingPhoto.timestamp
            });
            showSnackbar(`Foto sincronizada exitosamente para medidor ${pendingPhoto.meterCode}`, 'success');

          } catch (error: any) {
            lastError = error.message || 'Error desconocido';
            console.error(`Error al sincronizar foto para medidor ${pendingPhoto.meterCode} (intento ${retryCount + 1}):`, error);
            retryCount++;
            if (retryCount < 3) {
              console.log(`Reintentando sincronización para medidor ${pendingPhoto.meterCode} (intento ${retryCount + 1})...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
              continue;
            }
            errors++;
          }
        }

        if (!success) {
          console.error(`No se pudo sincronizar la foto para medidor ${pendingPhoto.meterCode} después de ${retryCount} intentos`);
          failedPhotos.push({
            meterCode: pendingPhoto.meterCode,
            timestamp: pendingPhoto.timestamp,
            error: lastError
          });
          // Mostrar mensaje específico para esta foto
          showSnackbar(`No se pudo sincronizar la foto del medidor ${pendingPhoto.meterCode}. Error: ${lastError}`, 'warning');
        }
      }

      // Actualizar el estado de las fotos pendientes después de procesar todas las fotos
      if (successfullySyncedPhotos.length > 0) {
        setPendingPhotos(prev => {
          const updated = prev.filter(photo => 
            !successfullySyncedPhotos.some(synced => 
              synced.meterCode === photo.meterCode && 
              synced.timestamp === photo.timestamp
            )
          );
          // Actualizar localStorage con el nuevo estado
          localStorage.setItem('pendingPhotos', JSON.stringify(updated));
          console.log('Fotos pendientes actualizadas:', updated.length);
          return updated;
        });
      }

      // Sincronizar lecturas pendientes
      for (const reading of [...pendingReadings]) {
        try {
          // Validar que la lectura tenga los datos necesarios
          if (!reading.meterCode || typeof reading.value !== 'number' || !reading.period) {
            console.error('Lectura inválida:', reading);
            errors++;
            continue;
          }

          // Verificar si el medidor existe
          const { data: existingMeter, error: meterCheckError } = await supabase
            .from('meters')
            .select('*')
            .eq('code_meter', reading.meterCode)
            .single();

          if (meterCheckError && meterCheckError.code !== 'PGRST116') {
            throw meterCheckError;
          }

          // Crear medidor si no existe
          if (!existingMeter) {
            const { error: meterError } = await supabase
              .from('meters')
              .insert([{
                code_meter: reading.meterCode,
                status: 'active'
              }]);

            if (meterError) {
              console.error('Error al crear medidor:', meterError);
              errors++;
              continue;
            }
          }

          // Insertar lectura
          const { error: readingError } = await supabase
            .from('readings')
            .insert([{
              meter_id: reading.meterCode,
              value: reading.value,
              period: reading.period,
              photo_url: reading.photoUrl || '',
              created_at: new Date(reading.timestamp).toISOString()
            }]);

          if (readingError) {
            console.error('Error al insertar lectura:', readingError);
            errors++;
            continue;
          }

          syncedReadings++;
          showSnackbar(`Lectura sincronizada: ${reading.meterCode}`, 'success');
        } catch (error) {
          console.error('Error al sincronizar lectura:', error);
          errors++;
          // No removemos la lectura del array para intentar sincronizarla después
        }
      }

      // Sincronizar comentarios pendientes
      for (const comment of [...pendingComments]) {
        try {
          const { error: commentError } = await supabase
            .from('comments')
            .insert([{
              meter_id_comment: comment.meterCode,
              notes: comment.notes,
              created_at: new Date(comment.timestamp).toISOString()
            }]);

          if (commentError) {
            console.error('Error al insertar comentario:', commentError);
            errors++;
            continue;
          }

          syncedComments++;
          showSnackbar(`Comentario sincronizado: ${comment.meterCode}`, 'success');
        } catch (error) {
          console.error('Error al sincronizar comentario:', error);
          errors++;
        }
      }

      // Mostrar resumen de sincronización
      const totalSynced = syncedReadings + syncedPhotos + syncedComments;
      if (totalSynced > 0) {
        const message = [
          syncedReadings > 0 && `${syncedReadings} lectura${syncedReadings !== 1 ? 's' : ''}`,
          syncedPhotos > 0 && `${syncedPhotos} foto${syncedPhotos !== 1 ? 's' : ''}`,
          syncedComments > 0 && `${syncedComments} comentario${syncedComments !== 1 ? 's' : ''}`
        ].filter(Boolean).join(', ');

        showSnackbar(`¡Sincronización exitosa! Se sincronizaron ${message}`, 'success');
      }

      if (errors > 0) {
        // Agrupar errores por medidor
        const errorsByMeter = failedPhotos.reduce((acc, photo) => {
          if (!acc[photo.meterCode]) {
            acc[photo.meterCode] = [];
          }
          acc[photo.meterCode].push(photo.error);
          return acc;
        }, {} as Record<string, string[]>);

        // Crear mensaje detallado de errores
        const errorDetails = Object.entries(errorsByMeter)
          .map(([meterCode, errors]) => `Medidor ${meterCode}: ${errors.length} error(es)`)
          .join(', ');

        showSnackbar(`Se encontraron ${errors} error${errors !== 1 ? 'es' : ''} durante la sincronización. ${errorDetails}`, 'warning');
      }

      // Verificar estado final de fotos pendientes
      const remainingPhotos = pendingPhotos.length;
      console.log('Fotos pendientes restantes:', remainingPhotos);
      if (remainingPhotos > 0 || pendingReadings.length > 0 || pendingComments.length > 0) {
        // Agrupar fotos pendientes por medidor
        const pendingByMeter = pendingPhotos.reduce((acc, photo) => {
          if (!acc[photo.meterCode]) {
            acc[photo.meterCode] = { photos: 0, readings: 0, comments: 0 };
          }
          acc[photo.meterCode].photos++;
          return acc;
        }, {} as Record<string, { photos: number; readings: number; comments: number }>);

        // Agrupar lecturas pendientes por medidor
        pendingReadings.forEach(reading => {
          if (!pendingByMeter[reading.meterCode]) {
            pendingByMeter[reading.meterCode] = { photos: 0, readings: 0, comments: 0 };
          }
          pendingByMeter[reading.meterCode].readings++;
        });

        // Agrupar comentarios pendientes por medidor
        pendingComments.forEach(comment => {
          if (!pendingByMeter[comment.meterCode]) {
            pendingByMeter[comment.meterCode] = { photos: 0, readings: 0, comments: 0 };
          }
          pendingByMeter[comment.meterCode].comments++;
        });

        // Crear mensaje detallado de registros pendientes
        const pendingDetails = Object.entries(pendingByMeter)
          .map(([meterCode, counts]) => {
            const parts = [];
            if (counts.photos > 0) parts.push(`${counts.photos} foto${counts.photos !== 1 ? 's' : ''}`);
            if (counts.readings > 0) parts.push(`${counts.readings} lectura${counts.readings !== 1 ? 's' : ''}`);
            if (counts.comments > 0) parts.push(`${counts.comments} comentario${counts.comments !== 1 ? 's' : ''}`);
            return `Medidor ${meterCode}: ${parts.join(', ')}`;
          })
          .join('\n• ');

        const totalPending = remainingPhotos + pendingReadings.length + pendingComments.length;
        const message = `Quedan ${totalPending} registro${totalPending !== 1 ? 's' : ''} pendientes de sincronizar:\n• ${pendingDetails}`;

        showSnackbar(message, 'warning');
      }

    } catch (error) {
      console.error('Error durante la sincronización:', error);
      showSnackbar('Ups, hubo un problema durante la sincronización. Los datos se mantendrán guardados para intentarlo más tarde.', 'error');
    } finally {
      setSyncStatus('idle');
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

  const downloadPendingRecords = async () => {
    try {
      // Crear contenido del archivo txt
      let txtContent = 'REGISTROS PENDIENTES DE SINCRONIZACIÓN\n';
      txtContent += '=====================================\n\n';

      // Agrupar registros por medidor
      const recordsByMeter = pendingPhotos.reduce((acc, photo) => {
        if (!acc[photo.meterCode]) {
          acc[photo.meterCode] = { photos: [], readings: [], comments: [] };
        }
        acc[photo.meterCode].photos.push(photo);
        return acc;
      }, {} as Record<string, { photos: PendingPhoto[]; readings: PendingReading[]; comments: PendingComment[] }>);

      // Agregar lecturas pendientes
      pendingReadings.forEach(reading => {
        if (!recordsByMeter[reading.meterCode]) {
          recordsByMeter[reading.meterCode] = { photos: [], readings: [], comments: [] };
        }
        recordsByMeter[reading.meterCode].readings.push(reading);
      });

      // Agregar comentarios pendientes
      pendingComments.forEach(comment => {
        if (!recordsByMeter[comment.meterCode]) {
          recordsByMeter[comment.meterCode] = { photos: [], readings: [], comments: [] };
        }
        recordsByMeter[comment.meterCode].comments.push(comment);
      });

      // Generar contenido detallado por medidor
      Object.entries(recordsByMeter).forEach(([meterCode, records]) => {
        txtContent += `Medidor: ${meterCode}\n`;
        txtContent += '-------------------------------------\n';

        if (records.photos.length > 0) {
          txtContent += `\nFotos pendientes (${records.photos.length}):\n`;
          records.photos.forEach((photo, index) => {
            const fileName = `${photo.meterCode}_${new Date(photo.timestamp).toISOString().replace(/[:.]/g, '-')}.jpg`;
            txtContent += `${index + 1}. Fecha: ${new Date(photo.timestamp).toLocaleString()}\n`;
            txtContent += `   Nombre archivo: ${fileName}\n`;
            txtContent += `   Tamaño: ${(photo.file.size / 1024).toFixed(2)} KB\n\n`;
          });
        }

        if (records.readings.length > 0) {
          txtContent += `\nLecturas pendientes (${records.readings.length}):\n`;
          records.readings.forEach((reading, index) => {
            txtContent += `${index + 1}. Fecha: ${new Date(reading.timestamp).toLocaleString()}\n`;
            txtContent += `   Valor: ${reading.value}\n`;
            txtContent += `   Período: ${reading.period}\n\n`;
          });
        }

        if (records.comments.length > 0) {
          txtContent += `\nComentarios pendientes (${records.comments.length}):\n`;
          records.comments.forEach((comment, index) => {
            txtContent += `${index + 1}. Fecha: ${new Date(comment.timestamp).toLocaleString()}\n`;
            txtContent += `   Notas: ${comment.notes}\n\n`;
          });
        }

        txtContent += '\n=====================================\n\n';
      });

      // Crear y descargar archivo txt
      const txtBlob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
      const txtUrl = URL.createObjectURL(txtBlob);
      const txtLink = document.createElement('a');
      txtLink.href = txtUrl;
      txtLink.download = `registros_pendientes_${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(txtLink);
      txtLink.click();
      document.body.removeChild(txtLink);
      URL.revokeObjectURL(txtUrl);

      // Descargar fotos
      for (const photo of pendingPhotos) {
        try {
          // Crear un nombre de archivo seguro
          const fileName = `${photo.meterCode}_${new Date(photo.timestamp).toISOString().replace(/[:.]/g, '-')}.jpg`;
          
          // Convertir el archivo a blob
          const photoBlob = new Blob([await photo.file.arrayBuffer()], { type: 'image/jpeg' });
          const photoUrl = URL.createObjectURL(photoBlob);
          
          // Crear y simular clic en enlace de descarga
          const photoLink = document.createElement('a');
          photoLink.href = photoUrl;
          photoLink.download = fileName;
          document.body.appendChild(photoLink);
          photoLink.click();
          document.body.removeChild(photoLink);
          
          // Liberar URL
          URL.revokeObjectURL(photoUrl);
          
          // Esperar un momento entre descargas para evitar sobrecarga
          await new Promise(resolve => setTimeout(resolve, 500));
          
          console.log(`Foto descargada: ${fileName}`);
        } catch (error) {
          console.error(`Error al descargar foto para medidor ${photo.meterCode}:`, error);
          showSnackbar(`Error al descargar foto del medidor ${photo.meterCode}`, 'error');
        }
      }

      showSnackbar('Registros y fotos descargados exitosamente', 'success');
    } catch (error) {
      console.error('Error al descargar registros:', error);
      showSnackbar('Error al descargar los registros. Por favor, intenta nuevamente.', 'error');
    }
  };

  const downloadPendingPhotos = async () => {
    try {
      if (pendingPhotos.length === 0) {
        showSnackbar('No hay fotos pendientes para descargar', 'info');
        return;
      }

      // Crear contenido del archivo txt con solo información de fotos
      let txtContent = 'FOTOS PENDIENTES DE SINCRONIZACIÓN\n';
      txtContent += '=====================================\n\n';
      txtContent += `Total de fotos pendientes: ${pendingPhotos.length}\n\n`;

      // Agrupar fotos por medidor
      const photosByMeter = pendingPhotos.reduce((acc, photo) => {
        if (!acc[photo.meterCode]) {
          acc[photo.meterCode] = [];
        }
        acc[photo.meterCode].push(photo);
        return acc;
      }, {} as Record<string, PendingPhoto[]>);

      // Generar contenido detallado por medidor
      Object.entries(photosByMeter).forEach(([meterCode, photos]) => {
        txtContent += `Medidor: ${meterCode}\n`;
        txtContent += '-------------------------------------\n';
        txtContent += `\nFotos pendientes (${photos.length}):\n`;
        
        photos.forEach((photo, index) => {
          const fileName = `${photo.meterCode}_${new Date(photo.timestamp).toISOString().replace(/[:.]/g, '-')}.jpg`;
          txtContent += `${index + 1}. Fecha: ${new Date(photo.timestamp).toLocaleString()}\n`;
          txtContent += `   Nombre archivo: ${fileName}\n`;
          txtContent += `   Tamaño: ${(photo.file.size / 1024).toFixed(2)} KB\n`;
          txtContent += `   Estado: ${isOnline ? 'Pendiente de sincronización' : 'Guardada localmente'}\n\n`;
        });

        txtContent += '\n=====================================\n\n';
      });

      // Descargar fotos primero
      let downloadedCount = 0;
      let failedCount = 0;
      let failedPhotos: { meterCode: string; error: string }[] = [];
      
      for (const photo of pendingPhotos) {
        try {
          // Verificar que el archivo existe y tiene las propiedades necesarias
          if (!photo.file || typeof photo.file !== 'object') {
            console.error('Archivo de foto no existe o es inválido:', photo);
            failedPhotos.push({ meterCode: photo.meterCode, error: 'Archivo no encontrado o inválido' });
            failedCount++;
            continue;
          }

          // Verificar que el archivo tiene la propiedad type
          if (!('type' in photo.file)) {
            console.error('Archivo no tiene tipo definido:', photo.file);
            failedPhotos.push({ meterCode: photo.meterCode, error: 'Formato de archivo no válido' });
            failedCount++;
            continue;
          }

          // Verificar que el archivo es una imagen
          const fileType = String(photo.file.type).toLowerCase();
          const isImage = fileType.startsWith('image/');
          if (!isImage) {
            console.error('Archivo no es una imagen:', fileType);
            failedPhotos.push({ meterCode: photo.meterCode, error: 'El archivo no es una imagen válida' });
            failedCount++;
            continue;
          }

          // Crear un nombre de archivo seguro
          const fileName = `${photo.meterCode}_${new Date(photo.timestamp).toISOString().replace(/[:.]/g, '-')}.jpg`;
          
          // Convertir el archivo a blob si no lo es ya
          let photoBlob: Blob;
          try {
            if (photo.file instanceof File) {
              // Si es un File, convertirlo a Blob
              const arrayBuffer = await photo.file.arrayBuffer();
              photoBlob = new Blob([arrayBuffer], { type: 'image/jpeg' });
            } else if (photo.file instanceof Blob) {
              // Si ya es un Blob, usarlo directamente
              photoBlob = photo.file;
            } else {
              throw new Error('Formato de archivo no soportado');
            }
          } catch (error) {
            console.error('Error al procesar el archivo:', error);
            failedPhotos.push({ 
              meterCode: photo.meterCode, 
              error: `Error al procesar el archivo: ${error instanceof Error ? error.message : 'Error desconocido'}` 
            });
            failedCount++;
            continue;
          }

          // Crear URL del blob
          const photoUrl = URL.createObjectURL(photoBlob);
          
          // Crear y simular clic en enlace de descarga
          const photoLink = document.createElement('a');
          photoLink.href = photoUrl;
          photoLink.download = fileName;
          document.body.appendChild(photoLink);
          
          // Intentar descargar
          try {
            photoLink.click();
            downloadedCount++;
            showSnackbar(`Descargando foto ${downloadedCount} de ${pendingPhotos.length}...`, 'info');
          } catch (error) {
            console.error('Error al hacer clic en el enlace:', error);
            failedPhotos.push({ 
              meterCode: photo.meterCode, 
              error: `Error al iniciar la descarga: ${error instanceof Error ? error.message : 'Error desconocido'}` 
            });
            failedCount++;
          } finally {
            // Limpiar
            document.body.removeChild(photoLink);
            URL.revokeObjectURL(photoUrl);
          }
          
          // Esperar un momento entre descargas para evitar sobrecarga
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`Error al descargar foto para medidor ${photo.meterCode}:`, error);
          failedPhotos.push({ 
            meterCode: photo.meterCode, 
            error: error instanceof Error ? error.message : 'Error desconocido' 
          });
          failedCount++;
        }
      }

      // Después de descargar las fotos, descargar el archivo TXT
      const txtBlob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
      const txtUrl = URL.createObjectURL(txtBlob);
      const txtLink = document.createElement('a');
      txtLink.href = txtUrl;
      txtLink.download = `fotos_pendientes_${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(txtLink);
      txtLink.click();
      document.body.removeChild(txtLink);
      URL.revokeObjectURL(txtUrl);

      // Mostrar resumen final con detalles de errores
      if (failedCount > 0) {
        const errorDetails = failedPhotos
          .map(f => `Medidor ${f.meterCode}: ${f.error}`)
          .join('\n');
        showSnackbar(
          `Se descargaron ${downloadedCount} fotos, ${failedCount} fallaron.\nDetalles:\n${errorDetails}`, 
          'warning'
        );
      } else {
        showSnackbar(`Se descargaron ${downloadedCount} fotos exitosamente`, 'success');
      }
    } catch (error) {
      console.error('Error al descargar fotos:', error);
      showSnackbar(
        `Error al descargar las fotos: ${error instanceof Error ? error.message : 'Error desconocido'}`, 
        'error'
      );
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
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography>
                Tienes {pendingReadings.length} lectura{pendingReadings.length !== 1 ? 's' : ''}, {pendingPhotos.length} foto{pendingPhotos.length !== 1 ? 's' : ''} y {pendingComments.length} comentario{pendingComments.length !== 1 ? 's' : ''} pendientes de sincronizar.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {isOnline && (
                  <Button
                    startIcon={<SyncIcon />}
                    onClick={handleSync}
                    disabled={syncStatus === 'syncing'}
                    variant="contained"
                    size="small"
                  >
                    {syncStatus === 'syncing' ? 'Sincronizando...' : 'Sincronizar ahora'}
                  </Button>
                )}
                <Button
                  startIcon={<SaveIcon />}
                  onClick={downloadPendingRecords}
                  variant="outlined"
                  size="small"
                  color="primary"
                >
                  Descargar registros
                </Button>
                {pendingPhotos.length > 0 && (
                  <Button
                    startIcon={<PhotoCameraIcon />}
                    onClick={downloadPendingPhotos}
                    variant="outlined"
                    size="small"
                    color="secondary"
                  >
                    Descargar fotos
                  </Button>
                )}
              </Box>
            </Box>
          </Alert>
        )}

        <Box 
          component="form" 
          onSubmit={handleSubmit} 
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
                color={photo ? "success" : "secondary"}
                sx={{ 
                  py: { xs: 1.5, sm: 2 },
                  fontSize: { xs: '0.875rem', sm: '1rem' },
                  '&:hover': {
                    backgroundColor: photo ? 'success.dark' : 'secondary.dark',
                    transform: 'scale(1.02)'
                  },
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                {photo ? 'Foto tomada ✓' : 'Tomar foto'}
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
                    color: 'success.main',
                    animation: 'fadeIn 0.5s ease-in-out',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5
                  }}
                >
                  <PhotoCameraIcon fontSize="small" color="success" />
                  Foto seleccionada: {photo.name}
                </Typography>
              )}
            </Grid>
            <Grid item xs={12}>
              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={isLoading || !photo}
                sx={{ 
                  py: { xs: 1.5, sm: 2 },
                  fontSize: { xs: '0.875rem', sm: '1rem' },
                  '&:hover': {
                    transform: 'scale(1.02)'
                  },
                  transition: 'all 0.2s ease-in-out',
                  '&.Mui-disabled': {
                    backgroundColor: 'action.disabledBackground',
                    color: 'action.disabled'
                  }
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