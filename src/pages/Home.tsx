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

        // Si estamos offline, guardar la foto en pendingPhotos sin mostrar mensaje
        if (!isOnline) {
          const newPendingPhoto: PendingPhoto = {
            meterCode: meterCode.trim(),
            file: compressedFile,
            timestamp: Date.now()
          };
          setPendingPhotos(prev => [...prev, newPendingPhoto]);
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
    let syncedReadings = 0;
    let syncedPhotos = 0;
    let syncedComments = 0;
    let errors = 0;

    try {
      // Sincronizar fotos pendientes primero
      const photosToSync = [...pendingPhotos];
      console.log('Fotos pendientes a sincronizar:', photosToSync.length);

      // Intentar sincronizar cada foto hasta 3 veces
      for (const pendingPhoto of photosToSync) {
        let retryCount = 0;
        let success = false;

        while (retryCount < 3 && !success) {
          try {
            // Verificar que el archivo existe y es válido
            if (!pendingPhoto.file || !(pendingPhoto.file instanceof File)) {
              console.error('Foto inválida:', pendingPhoto);
              errors++;
              break;
            }

            const fileExt = pendingPhoto.file.name.split('.').pop() || 'jpg';
            const fileName = `${pendingPhoto.meterCode}_${pendingPhoto.timestamp}.${fileExt}`;
            
            console.log(`Intentando subir foto (intento ${retryCount + 1}):`, fileName);
            
            // Intentar subir la foto
            const { error: uploadError, data } = await supabase.storage
              .from('meter-photos')
              .upload(fileName, pendingPhoto.file, {
                cacheControl: '3600',
                upsert: true
              });

            if (uploadError) {
              console.error(`Error al subir foto (intento ${retryCount + 1}):`, uploadError);
              if (uploadError.message.includes('bucket') || uploadError.message.includes('not found')) {
                showSnackbar('El bucket de fotos no está disponible. Por favor, contacta al administrador.', 'error');
                throw uploadError;
              }
              retryCount++;
              if (retryCount < 3) {
                console.log(`Reintentando subir foto (intento ${retryCount + 1})...`);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Esperar 1 segundo antes de reintentar
                continue;
              }
              errors++;
              break;
            }

            console.log('Foto subida exitosamente:', data);

            // Obtener URL pública de la foto
            const { data: { publicUrl } } = supabase.storage
              .from('meter-photos')
              .getPublicUrl(fileName);

            console.log('URL pública generada:', publicUrl);

            // Buscar la lectura asociada
            const readingToUpdate = pendingReadings.find(r => 
              r.meterCode === pendingPhoto.meterCode && 
              r.timestamp === pendingPhoto.timestamp
            );

            if (readingToUpdate) {
              // Actualizar la lectura en la base de datos con la URL de la foto
              const { error: updateError } = await supabase
                .from('readings')
                .update({ photo_url: publicUrl })
                .match({ 
                  meter_id: readingToUpdate.meterCode,
                  created_at: new Date(readingToUpdate.timestamp).toISOString()
                });

              if (updateError) {
                console.error('Error al actualizar lectura con URL de foto:', updateError);
                retryCount++;
                if (retryCount < 3) {
                  console.log(`Reintentando actualizar lectura (intento ${retryCount + 1})...`);
                  await new Promise(resolve => setTimeout(resolve, 1000));
                  continue;
                }
                errors++;
                break;
              }
            }

            // Si llegamos aquí, la foto se sincronizó correctamente
            success = true;
            syncedPhotos++;
            showSnackbar(`Foto sincronizada: ${pendingPhoto.meterCode}`, 'success');

            // Actualizar el estado de las fotos pendientes inmediatamente
            setPendingPhotos(prev => {
              const updated = prev.filter(photo => 
                !(photo.meterCode === pendingPhoto.meterCode && 
                  photo.timestamp === pendingPhoto.timestamp)
              );
              // Actualizar localStorage con el nuevo estado
              localStorage.setItem('pendingPhotos', JSON.stringify(updated));
              return updated;
            });

          } catch (error) {
            console.error(`Error al sincronizar foto (intento ${retryCount + 1}):`, error);
            retryCount++;
            if (retryCount < 3) {
              console.log(`Reintentando sincronización (intento ${retryCount + 1})...`);
              await new Promise(resolve => setTimeout(resolve, 1000));
              continue;
            }
            errors++;
          }
        }

        if (!success) {
          console.error(`No se pudo sincronizar la foto después de ${retryCount} intentos:`, pendingPhoto);
          // Mostrar mensaje específico para esta foto
          showSnackbar(`No se pudo sincronizar la foto del medidor ${pendingPhoto.meterCode}. Se intentará nuevamente más tarde.`, 'warning');
        }
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
        showSnackbar(`Se encontraron ${errors} error${errors !== 1 ? 'es' : ''} durante la sincronización. Los datos se intentarán sincronizar nuevamente.`, 'warning');
      }

      // Verificar estado final de fotos pendientes
      const remainingPhotos = pendingPhotos.length;
      console.log('Fotos pendientes restantes:', remainingPhotos);
      if (remainingPhotos > 0) {
        // Mostrar mensaje más específico sobre las fotos pendientes
        const pendingMeters = [...new Set(pendingPhotos.map(photo => photo.meterCode))].join(', ');
        showSnackbar(`Quedan ${remainingPhotos} foto${remainingPhotos !== 1 ? 's' : ''} pendientes de sincronizar para los medidores: ${pendingMeters}. Intenta sincronizar nuevamente.`, 'warning');
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

  const syncPendingData = async () => {
    if (!isOnline || pendingReadings.length === 0 && pendingPhotos.length === 0) return;

    setIsSyncing(true);
    let syncedReadings = 0;
    let syncedPhotos = 0;
    let syncedComments = 0;
    let errors = 0;

    try {
      // Primero sincronizar fotos pendientes
      for (const pendingPhoto of pendingPhotos) {
        try {
          const formData = new FormData();
          formData.append('photo', pendingPhoto.file);
          formData.append('meterCode', pendingPhoto.meterCode);
          formData.append('timestamp', pendingPhoto.timestamp.toString());

          const response = await fetch(`${API_URL}/photos`, {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            throw new Error(`Error al sincronizar foto: ${response.statusText}`);
          }

          syncedPhotos++;
          showSnackbar(`Foto sincronizada: ${pendingPhoto.meterCode}`, 'success');
        } catch (error) {
          console.error('Error al sincronizar foto:', error);
          errors++;
          // No removemos la foto del array para intentar sincronizarla después
        }
      }

      // Luego sincronizar lecturas pendientes
      for (const pendingReading of pendingReadings) {
        try {
          // Validar que la lectura tenga todos los campos necesarios
          if (!pendingReading.meterCode || !pendingReading.value || !pendingReading.period) {
            console.error('Lectura pendiente inválida:', pendingReading);
            errors++;
            continue;
          }

          const response = await fetch(`${API_URL}/readings`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              meterCode: pendingReading.meterCode.trim(),
              value: parseInt(pendingReading.value),
              period: pendingReading.period,
              timestamp: pendingReading.timestamp,
              comment: pendingReading.comment || ''
            })
          });

          if (!response.ok) {
            throw new Error(`Error al sincronizar lectura: ${response.statusText}`);
          }

          syncedReadings++;
          if (pendingReading.comment) syncedComments++;
          showSnackbar(`Lectura sincronizada: ${pendingReading.meterCode}`, 'success');
        } catch (error) {
          console.error('Error al sincronizar lectura:', error);
          errors++;
          // No removemos la lectura del array para intentar sincronizarla después
        }
      }

      // Solo limpiar los datos que se sincronizaron exitosamente
      if (syncedPhotos > 0) {
        setPendingPhotos(prev => prev.filter(photo => 
          !pendingPhotos.slice(0, syncedPhotos).some(synced => 
            synced.meterCode === photo.meterCode && 
            synced.timestamp === photo.timestamp
          )
        ));
      }

      if (syncedReadings > 0) {
        setPendingReadings(prev => prev.filter(reading => 
          !pendingReadings.slice(0, syncedReadings).some(synced => 
            synced.meterCode === reading.meterCode && 
            synced.period === reading.period &&
            synced.timestamp === reading.timestamp
          )
        ));
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
        showSnackbar(`Se encontraron ${errors} error${errors !== 1 ? 'es' : ''} durante la sincronización. Los datos se intentarán sincronizar nuevamente.`, 'warning');
      }

    } catch (error) {
      console.error('Error durante la sincronización:', error);
      showSnackbar('Ups, hubo un problema durante la sincronización. Los datos se mantendrán guardados para intentarlo más tarde.', 'error');
    } finally {
      setIsSyncing(false);
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