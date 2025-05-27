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
import JSZip from 'jszip';

interface PendingPhoto {
  meterCode: string;
  file: {
    type: string;
    data: string; // base64
    name: string;
  } | File | Blob;
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
        // Convertir los datos del localStorage a objetos File válidos
        const processedPhotos = parsedPhotos.map((photo: any) => {
          if (photo.file && photo.file.data) {
            // Si el archivo está en formato base64, convertirlo a Blob
            const byteString = atob(photo.file.data.split(',')[1]);
            const mimeString = photo.file.type || 'image/jpeg';
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            
            for (let i = 0; i < byteString.length; i++) {
              ia[i] = byteString.charCodeAt(i);
            }
            
            const blob = new Blob([ab], { type: mimeString });
            return {
              ...photo,
              file: blob
            };
          }
          return photo;
        });
        setPendingPhotos(processedPhotos);
      } catch (error) {
        console.error('Error al cargar fotos pendientes:', error);
        showSnackbar('Error al cargar las fotos pendientes. Se reiniciará el almacenamiento local.', 'error');
        localStorage.removeItem('pendingPhotos');
        setPendingPhotos([]);
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
    try {
      // Convertir los archivos a base64 antes de guardar
      const photosToSave = pendingPhotos.map(photo => {
        if (photo.file instanceof Blob || photo.file instanceof File) {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              resolve({
                ...photo,
                file: {
                  type: photo.file instanceof Blob ? photo.file.type : 'image/jpeg',
                  data: reader.result as string,
                  name: photo.file instanceof File ? photo.file.name : `${photo.meterCode}_${Date.now()}.jpg`
                }
              });
            };
            reader.readAsDataURL(photo.file as Blob);
          });
        }
        return photo;
      });

      // Guardar los datos una vez que se hayan convertido todas las fotos
      Promise.all(photosToSave).then(processedPhotos => {
        localStorage.setItem('pendingPhotos', JSON.stringify(processedPhotos));
      });

      localStorage.setItem('pendingReadings', JSON.stringify(pendingReadings));
      localStorage.setItem('pendingComments', JSON.stringify(pendingComments));
    } catch (error) {
      console.error('Error al guardar datos pendientes:', error);
      showSnackbar('Error al guardar los datos pendientes. Intenta nuevamente.', 'error');
    }
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

        // Validar tipo de archivo de manera más específica
        const fileType = String(file.type).toLowerCase();
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        
        // Verificar si el tipo de archivo está en la lista de permitidos
        if (!allowedTypes.includes(fileType)) {
          const allowedExtensions = allowedTypes.map(t => t.split('/')[1].toUpperCase()).join(', ');
          showSnackbar(`Formato de archivo no válido: ${fileType}. Por favor, usa ${allowedExtensions}`, 'warning');
          return;
        }

        // Comprimir la imagen
        const compressedFile = await compressImage(file);
        setPhoto(compressedFile);

        // Si estamos offline, guardar la foto en pendingPhotos
        if (!isOnline) {
          // Convertir el archivo a base64 para almacenamiento
          const base64File = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(compressedFile);
          });

          const newPendingPhoto: PendingPhoto = {
            meterCode: meterCode.trim(),
            file: {
              type: fileType,
              data: base64File,
              name: `${meterCode.trim()}_${Date.now()}.${fileType.split('/')[1]}`
            },
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
    let failedReadings: { meterCode: string; timestamp: number; error: string }[] = [];
    let failedComments: { meterCode: string; timestamp: number; error: string }[] = [];

    try {
      // Verificar conexión a Supabase antes de comenzar
      try {
        const { data, error: healthCheckError } = await supabase.from('meters').select('count').limit(1);
        if (healthCheckError) {
          throw new Error('No se pudo conectar a la base de datos. Por favor, verifica tu conexión.');
        }
      } catch (error) {
        throw new Error('Error de conexión con la base de datos. Por favor, intenta nuevamente más tarde.');
      }

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
            if (!pendingPhoto.file) {
              lastError = 'Archivo de foto inválido o vacío';
              console.error('Foto inválida:', pendingPhoto);
              errors++;
              break;
            }

            let photoBlob: Blob;
            let fileType: string;

            // Convertir el archivo a Blob según su tipo
            if ('data' in pendingPhoto.file) {
              try {
                const base64String = pendingPhoto.file.data;
                const base64Data = base64String.split(',')[1] || base64String;
                const byteString = atob(base64Data);
                const ab = new ArrayBuffer(byteString.length);
                const ia = new Uint8Array(ab);
                
                for (let i = 0; i < byteString.length; i++) {
                  ia[i] = byteString.charCodeAt(i);
                }
                
                fileType = pendingPhoto.file.type || 'image/jpeg';
                photoBlob = new Blob([ab], { type: fileType });
              } catch (error) {
                lastError = 'Error al procesar la foto: formato inválido';
                console.error('Error al procesar foto base64:', error);
                retryCount++;
                continue;
              }
            } else if (pendingPhoto.file instanceof File || pendingPhoto.file instanceof Blob) {
              photoBlob = pendingPhoto.file;
              fileType = pendingPhoto.file.type || 'image/jpeg';
            } else {
              lastError = 'Formato de archivo no soportado';
              console.error('Formato de archivo no soportado:', pendingPhoto.file);
              retryCount++;
              continue;
            }

            // Verificar tamaño del archivo
            if (photoBlob.size > MAX_FILE_SIZE) {
              lastError = 'La foto excede el tamaño máximo permitido (5MB)';
              console.error('Foto demasiado grande:', photoBlob.size);
              retryCount++;
              continue;
            }

            const fileExt = fileType.split('/')[1] || 'jpg';
            const fileName = `${pendingPhoto.meterCode}_${pendingPhoto.timestamp}.${fileExt}`;
            
            console.log(`Intentando subir foto para medidor ${pendingPhoto.meterCode} (intento ${retryCount + 1}):`, fileName);
            
            // Intentar subir la foto con upsert forzado
            const { error: uploadError, data } = await supabase.storage
              .from('meter-photos')
              .upload(fileName, photoBlob, {
                cacheControl: '3600',
                upsert: true,
                duplex: 'half'
              });

            if (uploadError) {
              lastError = uploadError.message;
              console.error(`Error al subir foto para medidor ${pendingPhoto.meterCode} (intento ${retryCount + 1}):`, uploadError);
              
              // Manejar errores específicos
              if (uploadError.message.includes('bucket') || uploadError.message.includes('not found')) {
                throw new Error('El bucket de fotos no está disponible. Por favor, contacta al administrador.');
              }
              if (uploadError.message.includes('security policy')) {
                throw new Error('No tienes permisos para subir fotos. Por favor, contacta al administrador.');
              }
              if (uploadError.message.includes('duplicate')) {
                // Si es un error de duplicado, intentar con un nombre diferente
                const newFileName = `${pendingPhoto.meterCode}_${pendingPhoto.timestamp}_${Date.now()}.${fileExt}`;
                const { error: retryError } = await supabase.storage
                  .from('meter-photos')
                  .upload(newFileName, photoBlob, {
                    cacheControl: '3600',
                    upsert: true
                  });
                
                if (retryError) {
                  lastError = retryError.message;
                  retryCount++;
                  continue;
                }
              } else {
                retryCount++;
                if (retryCount < 3) {
                  console.log(`Reintentando subir foto para medidor ${pendingPhoto.meterCode} (intento ${retryCount + 1})...`);
                  await new Promise(resolve => setTimeout(resolve, 2000));
                  continue;
                }
                errors++;
                break;
              }
            }

            // Obtener URL pública de la foto
            const { data: { publicUrl } } = supabase.storage
              .from('meter-photos')
              .getPublicUrl(fileName);

            // Buscar o crear la lectura asociada
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
              continue;
            }

            if (existingReading) {
              // Actualizar lectura existente
              const { error: updateError } = await supabase
                .from('readings')
                .update({ photo_url: publicUrl })
                .match({ 
                  meter_id: pendingPhoto.meterCode,
                  created_at: new Date(pendingPhoto.timestamp).toISOString()
                });

              if (updateError) {
                lastError = updateError.message;
                console.error('Error al actualizar lectura:', updateError);
                retryCount++;
                continue;
              }
            } else {
              // Crear nueva lectura
              const { error: insertError } = await supabase
                .from('readings')
                .insert([{
                  meter_id: pendingPhoto.meterCode,
                  value: 0,
                  period: getCurrentPeriod(),
                  photo_url: publicUrl,
                  created_at: new Date(pendingPhoto.timestamp).toISOString()
                }]);

              if (insertError) {
                lastError = insertError.message;
                console.error('Error al crear lectura:', insertError);
                retryCount++;
                continue;
              }
            }

            success = true;
            syncedPhotos++;
            successfullySyncedPhotos.push({
              meterCode: pendingPhoto.meterCode,
              timestamp: pendingPhoto.timestamp
            });
            showSnackbar(`Foto sincronizada: ${pendingPhoto.meterCode}`, 'success');

          } catch (error: any) {
            lastError = error.message || 'Error desconocido';
            console.error(`Error al sincronizar foto para medidor ${pendingPhoto.meterCode}:`, error);
            retryCount++;
            if (retryCount < 3) {
              await new Promise(resolve => setTimeout(resolve, 2000));
              continue;
            }
            errors++;
          }
        }

        if (!success) {
          failedPhotos.push({
            meterCode: pendingPhoto.meterCode,
            timestamp: pendingPhoto.timestamp,
            error: lastError
          });
          showSnackbar(`No se pudo sincronizar la foto del medidor ${pendingPhoto.meterCode}: ${lastError}`, 'warning');
        }
      }

      // Actualizar estado de fotos pendientes
      if (successfullySyncedPhotos.length > 0) {
        setPendingPhotos(prev => {
          const updated = prev.filter(photo => 
            !successfullySyncedPhotos.some(synced => 
              synced.meterCode === photo.meterCode && 
              synced.timestamp === photo.timestamp
            )
          );
          localStorage.setItem('pendingPhotos', JSON.stringify(updated));
          return updated;
        });
      }

      // Sincronizar lecturas pendientes
      for (const reading of [...pendingReadings]) {
        let retryCount = 0;
        let success = false;
        let lastError = '';

        while (retryCount < 3 && !success) {
          try {
            // Validar datos de la lectura
            if (!reading.meterCode || typeof reading.value !== 'number' || !reading.period) {
              lastError = 'Datos de lectura inválidos';
              console.error('Lectura inválida:', reading);
              errors++;
              break;
            }

            // Verificar si el medidor existe
            const { data: existingMeter, error: meterCheckError } = await supabase
              .from('meters')
              .select('*')
              .eq('code_meter', reading.meterCode)
              .single();

            if (meterCheckError && meterCheckError.code !== 'PGRST116') {
              lastError = meterCheckError.message;
              retryCount++;
              continue;
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
                lastError = meterError.message;
                console.error('Error al crear medidor:', meterError);
                retryCount++;
                continue;
              }
            }

            // Verificar si la lectura ya existe
            const { data: existingReading, error: readingCheckError } = await supabase
              .from('readings')
              .select('*')
              .eq('meter_id', reading.meterCode)
              .eq('created_at', new Date(reading.timestamp).toISOString())
              .single();

            if (readingCheckError && readingCheckError.code !== 'PGRST116') {
              lastError = readingCheckError.message;
              retryCount++;
              continue;
            }

            if (existingReading) {
              // Actualizar lectura existente
              const { error: updateError } = await supabase
                .from('readings')
                .update({
                  value: reading.value,
                  period: reading.period,
                  photo_url: reading.photoUrl || existingReading.photo_url
                })
                .match({
                  meter_id: reading.meterCode,
                  created_at: new Date(reading.timestamp).toISOString()
                });

              if (updateError) {
                lastError = updateError.message;
                console.error('Error al actualizar lectura:', updateError);
                retryCount++;
                continue;
              }
            } else {
              // Insertar nueva lectura
              const { error: insertError } = await supabase
                .from('readings')
                .insert([{
                  meter_id: reading.meterCode,
                  value: reading.value,
                  period: reading.period,
                  photo_url: reading.photoUrl || '',
                  created_at: new Date(reading.timestamp).toISOString()
                }]);

              if (insertError) {
                lastError = insertError.message;
                console.error('Error al insertar lectura:', insertError);
                retryCount++;
                continue;
              }
            }

            success = true;
            syncedReadings++;
            showSnackbar(`Lectura sincronizada: ${reading.meterCode}`, 'success');

          } catch (error: any) {
            lastError = error.message || 'Error desconocido';
            console.error('Error al sincronizar lectura:', error);
            retryCount++;
            if (retryCount < 3) {
              await new Promise(resolve => setTimeout(resolve, 2000));
              continue;
            }
            errors++;
          }
        }

        if (!success) {
          failedReadings.push({
            meterCode: reading.meterCode,
            timestamp: reading.timestamp,
            error: lastError
          });
          showSnackbar(`No se pudo sincronizar la lectura del medidor ${reading.meterCode}: ${lastError}`, 'warning');
        } else {
          // Remover lectura sincronizada exitosamente
          setPendingReadings(prev => {
            const updated = prev.filter(r => 
              r.meterCode !== reading.meterCode || 
              r.timestamp !== reading.timestamp
            );
            localStorage.setItem('pendingReadings', JSON.stringify(updated));
            return updated;
          });
        }
      }

      // Sincronizar comentarios pendientes
      for (const comment of [...pendingComments]) {
        let retryCount = 0;
        let success = false;
        let lastError = '';

        while (retryCount < 3 && !success) {
          try {
            // Validar datos del comentario
            if (!comment.meterCode || !comment.notes) {
              lastError = 'Datos de comentario inválidos';
              console.error('Comentario inválido:', comment);
              errors++;
              break;
            }

            // Verificar si el medidor existe
            const { data: existingMeter, error: meterCheckError } = await supabase
              .from('meters')
              .select('*')
              .eq('code_meter', comment.meterCode)
              .single();

            if (meterCheckError && meterCheckError.code !== 'PGRST116') {
              lastError = meterCheckError.message;
              retryCount++;
              continue;
            }

            // Crear medidor si no existe
            if (!existingMeter) {
              const { error: meterError } = await supabase
                .from('meters')
                .insert([{
                  code_meter: comment.meterCode,
                  status: 'active'
                }]);

              if (meterError) {
                lastError = meterError.message;
                console.error('Error al crear medidor:', meterError);
                retryCount++;
                continue;
              }
            }

            // Insertar comentario
            const { error: commentError } = await supabase
              .from('comments')
              .insert([{
                meter_id_comment: comment.meterCode,
                notes: comment.notes,
                created_at: new Date(comment.timestamp).toISOString()
              }]);

            if (commentError) {
              lastError = commentError.message;
              console.error('Error al insertar comentario:', commentError);
              retryCount++;
              continue;
            }

            success = true;
            syncedComments++;
            showSnackbar(`Comentario sincronizado: ${comment.meterCode}`, 'success');

          } catch (error: any) {
            lastError = error.message || 'Error desconocido';
            console.error('Error al sincronizar comentario:', error);
            retryCount++;
            if (retryCount < 3) {
              await new Promise(resolve => setTimeout(resolve, 2000));
              continue;
            }
            errors++;
          }
        }

        if (!success) {
          failedComments.push({
            meterCode: comment.meterCode,
            timestamp: comment.timestamp,
            error: lastError
          });
          showSnackbar(`No se pudo sincronizar el comentario del medidor ${comment.meterCode}: ${lastError}`, 'warning');
        } else {
          // Remover comentario sincronizado exitosamente
          setPendingComments(prev => {
            const updated = prev.filter(c => 
              c.meterCode !== comment.meterCode || 
              c.timestamp !== comment.timestamp
            );
            localStorage.setItem('pendingComments', JSON.stringify(updated));
            return updated;
          });
        }
      }

      // Mostrar resumen detallado de la sincronización
      const totalSynced = syncedReadings + syncedPhotos + syncedComments;
      if (totalSynced > 0) {
        const message = [
          syncedReadings > 0 && `${syncedReadings} lectura${syncedReadings !== 1 ? 's' : ''}`,
          syncedPhotos > 0 && `${syncedPhotos} foto${syncedPhotos !== 1 ? 's' : ''}`,
          syncedComments > 0 && `${syncedComments} comentario${syncedComments !== 1 ? 's' : ''}`
        ].filter(Boolean).join(', ');

        showSnackbar(`¡Sincronización exitosa! Se sincronizaron ${message}`, 'success');
      }

      // Mostrar errores detallados si los hubo
      if (errors > 0) {
        const errorDetails = [
          failedPhotos.length > 0 && `Fotos: ${failedPhotos.length} error(es)`,
          failedReadings.length > 0 && `Lecturas: ${failedReadings.length} error(es)`,
          failedComments.length > 0 && `Comentarios: ${failedComments.length} error(es)`
        ].filter(Boolean).join(', ');

        showSnackbar(
          `Se encontraron ${errors} error${errors !== 1 ? 'es' : ''} durante la sincronización. ${errorDetails}`,
          'warning'
        );

        // Mostrar detalles específicos de errores
        const errorMessages = [
          ...failedPhotos.map(f => `Foto ${f.meterCode}: ${f.error}`),
          ...failedReadings.map(r => `Lectura ${r.meterCode}: ${r.error}`),
          ...failedComments.map(c => `Comentario ${c.meterCode}: ${c.error}`)
        ];

        console.error('Detalles de errores:', errorMessages);
      }

      // Verificar estado final
      const remainingItems = pendingPhotos.length + pendingReadings.length + pendingComments.length;
      if (remainingItems > 0) {
        const remainingDetails = [
          pendingPhotos.length > 0 && `${pendingPhotos.length} foto${pendingPhotos.length !== 1 ? 's' : ''}`,
          pendingReadings.length > 0 && `${pendingReadings.length} lectura${pendingReadings.length !== 1 ? 's' : ''}`,
          pendingComments.length > 0 && `${pendingComments.length} comentario${pendingComments.length !== 1 ? 's' : ''}`
        ].filter(Boolean).join(', ');

        showSnackbar(
          `Quedan ${remainingItems} registro${remainingItems !== 1 ? 's' : ''} pendientes: ${remainingDetails}. Intenta sincronizar nuevamente.`,
          'warning'
        );
      }

    } catch (error: any) {
      console.error('Error durante la sincronización:', error);
      showSnackbar(
        `Error durante la sincronización: ${error.message || 'Error desconocido'}. Los datos se mantendrán guardados para intentarlo más tarde.`,
        'error'
      );
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
            
            // Calcular tamaño según el tipo de archivo
            let fileSize = 0;
            if (photo.file instanceof Blob || photo.file instanceof File) {
              fileSize = photo.file.size;
            } else if ('data' in photo.file) {
              // Para archivos en base64, calcular tamaño aproximado
              const base64Data = photo.file.data.split(',')[1];
              fileSize = Math.ceil((base64Data.length * 3) / 4);
            }
            
            txtContent += `   Tamaño: ${(fileSize / 1024).toFixed(2)} KB\n\n`;
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
          let photoBlob: Blob;
          
          // Convertir el archivo a blob según su tipo
          if (photo.file instanceof Blob || photo.file instanceof File) {
            const arrayBuffer = await (photo.file as Blob).arrayBuffer();
            photoBlob = new Blob([arrayBuffer], { type: photo.file.type || 'image/jpeg' });
          } else if ('data' in photo.file) {
            // Convertir base64 a Blob
            const base64Data = photo.file.data.split(',')[1];
            const byteString = atob(base64Data);
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            
            for (let i = 0; i < byteString.length; i++) {
              ia[i] = byteString.charCodeAt(i);
            }
            
            photoBlob = new Blob([ab], { type: photo.file.type || 'image/jpeg' });
          } else {
            throw new Error('Formato de archivo no soportado');
          }

          // Crear un nombre de archivo seguro
          const fileName = `${photo.meterCode}_${new Date(photo.timestamp).toISOString().replace(/[:.]/g, '-')}.jpg`;
          
          // Crear y simular clic en enlace de descarga
          const photoLink = document.createElement('a');
          photoLink.href = URL.createObjectURL(photoBlob);
          photoLink.download = fileName;
          document.body.appendChild(photoLink);
          photoLink.click();
          document.body.removeChild(photoLink);
          
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
          
          // Calcular tamaño según el tipo de archivo
          let fileSize = 0;
          if (photo.file instanceof Blob || photo.file instanceof File) {
            fileSize = photo.file.size;
          } else if ('data' in photo.file) {
            // Para archivos en base64, calcular tamaño aproximado
            const base64String = photo.file.data;
            const base64Data = base64String.split(',')[1] || base64String;
            fileSize = Math.ceil((base64Data.length * 3) / 4);
          }
          
          txtContent += `   Tamaño: ${(fileSize / 1024).toFixed(2)} KB\n`;
          txtContent += `   Estado: ${isOnline ? 'Pendiente de sincronización' : 'Guardada localmente'}\n\n`;
        });

        txtContent += '\n=====================================\n\n';
      });

      // Descargar fotos
      let downloadedCount = 0;
      let failedCount = 0;
      let failedPhotos: { meterCode: string; error: string }[] = [];
      
      for (const photo of pendingPhotos) {
        try {
          let photoBlob: Blob;
          let fileType: string;
          let fileName: string;

          // Determinar el tipo de archivo y convertirlo a Blob
          if ('data' in photo.file) {
            // Es un archivo en base64
            try {
              const base64String = photo.file.data;
              const base64Data = base64String.split(',')[1] || base64String;
              const byteString = atob(base64Data);
              const ab = new ArrayBuffer(byteString.length);
              const ia = new Uint8Array(ab);
              
              for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
              }
              
              // Asegurar que el tipo de archivo sea válido
              fileType = photo.file.type || 'image/jpeg';
              const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
              if (!allowedTypes.includes(fileType)) {
                fileType = 'image/jpeg'; // Usar JPEG como tipo por defecto
              }

              photoBlob = new Blob([ab], { type: fileType });
              const extension = fileType.split('/')[1];
              fileName = photo.file.name || `${photo.meterCode}_${new Date(photo.timestamp).toISOString().replace(/[:.]/g, '-')}.${extension}`;
            } catch (error) {
              console.error('Error al convertir base64 a Blob:', error);
              failedPhotos.push({ 
                meterCode: photo.meterCode, 
                error: 'Error al procesar la foto: formato inválido' 
              });
              failedCount++;
              continue;
            }
          } else if (photo.file instanceof File) {
            // Es un File
            const arrayBuffer = await photo.file.arrayBuffer();
            fileType = photo.file.type || 'image/jpeg';
            photoBlob = new Blob([arrayBuffer], { type: fileType });
            fileName = photo.file.name;
          } else if (photo.file instanceof Blob) {
            // Es un Blob
            photoBlob = photo.file;
            fileType = photo.file.type || 'image/jpeg';
            const extension = fileType.split('/')[1] || 'jpg';
            fileName = `${photo.meterCode}_${new Date(photo.timestamp).toISOString().replace(/[:.]/g, '-')}.${extension}`;
          } else {
            console.error('Formato de archivo no soportado:', photo.file);
            failedPhotos.push({ 
              meterCode: photo.meterCode, 
              error: 'Formato de archivo no soportado' 
            });
            failedCount++;
            continue;
          }

          // Verificar que el tipo de archivo es permitido
          const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
          if (!allowedTypes.includes(fileType)) {
            console.error('Formato de archivo no permitido:', fileType);
            // Convertir a JPEG si el formato no es permitido
            fileType = 'image/jpeg';
            const tempCanvas = document.createElement('canvas');
            const ctx = tempCanvas.getContext('2d');
            const img = new Image();
            
            try {
              const imgUrl = URL.createObjectURL(photoBlob);
              await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = imgUrl;
              });
              
              tempCanvas.width = img.width;
              tempCanvas.height = img.height;
              ctx?.drawImage(img, 0, 0);
              
              const jpegBlob = await new Promise<Blob>((resolve, reject) => {
                tempCanvas.toBlob((blob) => {
                  if (blob) resolve(blob);
                  else reject(new Error('Error al convertir a JPEG'));
                }, 'image/jpeg', 0.9);
              });
              
              photoBlob = jpegBlob;
              fileName = fileName.replace(/\.[^/.]+$/, '.jpg');
              URL.revokeObjectURL(imgUrl);
            } catch (error) {
              console.error('Error al convertir imagen a JPEG:', error);
              failedPhotos.push({ 
                meterCode: photo.meterCode, 
                error: 'Error al convertir la imagen a formato JPEG' 
              });
              failedCount++;
              continue;
            }
          }

          // Crear URL del blob y descargar
          const photoUrl = URL.createObjectURL(photoBlob);
          const photoLink = document.createElement('a');
          photoLink.href = photoUrl;
          photoLink.download = fileName;
          document.body.appendChild(photoLink);
          
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
            document.body.removeChild(photoLink);
            URL.revokeObjectURL(photoUrl);
          }
          
          // Esperar un momento entre descargas
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

  const downloadAllPendingData = async () => {
    try {
      if (pendingPhotos.length === 0 && pendingReadings.length === 0 && pendingComments.length === 0) {
        showSnackbar('No hay datos pendientes para descargar', 'info');
        return;
      }

      showSnackbar('Preparando archivo ZIP con todos los datos pendientes...', 'info');
      const zip = new JSZip();

      // Crear archivo de resumen
      let summaryContent = 'RESUMEN DE DATOS PENDIENTES\n';
      summaryContent += '===========================\n\n';
      summaryContent += `Fecha de generación: ${new Date().toLocaleString()}\n\n`;
      summaryContent += `Total de fotos pendientes: ${pendingPhotos.length}\n`;
      summaryContent += `Total de lecturas pendientes: ${pendingReadings.length}\n`;
      summaryContent += `Total de comentarios pendientes: ${pendingComments.length}\n\n`;

      // Agregar fotos al ZIP
      if (pendingPhotos.length > 0) {
        const photosFolder = zip.folder('fotos');
        if (photosFolder) {
          let photosSummary = 'FOTOS PENDIENTES\n';
          photosSummary += '===============\n\n';

          for (const photo of pendingPhotos) {
            try {
              let photoBlob: Blob;
              let fileName: string;

              // Convertir la foto a Blob según su tipo
              if ('data' in photo.file) {
                const base64String = photo.file.data;
                const base64Data = base64String.split(',')[1] || base64String;
                const byteString = atob(base64Data);
                const ab = new ArrayBuffer(byteString.length);
                const ia = new Uint8Array(ab);
                
                for (let i = 0; i < byteString.length; i++) {
                  ia[i] = byteString.charCodeAt(i);
                }
                
                const fileType = photo.file.type || 'image/jpeg';
                photoBlob = new Blob([ab], { type: fileType });
                fileName = `${photo.meterCode}_${new Date(photo.timestamp).toISOString().replace(/[:.]/g, '-')}.${fileType.split('/')[1]}`;
              } else if (photo.file instanceof File || photo.file instanceof Blob) {
                photoBlob = photo.file;
                fileName = photo.file instanceof File ? photo.file.name : 
                  `${photo.meterCode}_${new Date(photo.timestamp).toISOString().replace(/[:.]/g, '-')}.jpg`;
              } else {
                continue;
              }

              // Agregar foto al ZIP
              photosFolder.file(fileName, photoBlob);

              // Agregar información al resumen
              photosSummary += `Medidor: ${photo.meterCode}\n`;
              photosSummary += `Fecha: ${new Date(photo.timestamp).toLocaleString()}\n`;
              photosSummary += `Archivo: ${fileName}\n`;
              photosSummary += `Tamaño: ${(photoBlob.size / 1024).toFixed(2)} KB\n\n`;
            } catch (error) {
              console.error(`Error al procesar foto para medidor ${photo.meterCode}:`, error);
              photosSummary += `Error al procesar foto del medidor ${photo.meterCode}: ${error instanceof Error ? error.message : 'Error desconocido'}\n\n`;
            }
          }

          // Agregar resumen de fotos al ZIP
          photosFolder.file('resumen_fotos.txt', photosSummary);
          summaryContent += 'Ver carpeta "fotos" para las imágenes y su resumen detallado.\n\n';
        }
      }

      // Agregar lecturas al ZIP
      if (pendingReadings.length > 0) {
        let readingsContent = 'LECTURAS PENDIENTES\n';
        readingsContent += '==================\n\n';

        // Agrupar lecturas por medidor
        const readingsByMeter = pendingReadings.reduce((acc, reading) => {
          if (!acc[reading.meterCode]) {
            acc[reading.meterCode] = [];
          }
          acc[reading.meterCode].push(reading);
          return acc;
        }, {} as Record<string, PendingReading[]>);

        // Generar contenido detallado por medidor
        Object.entries(readingsByMeter).forEach(([meterCode, readings]) => {
          readingsContent += `Medidor: ${meterCode}\n`;
          readingsContent += '-------------------------------------\n';
          readingsContent += `Total lecturas: ${readings.length}\n\n`;

          readings.forEach((reading, index) => {
            readingsContent += `${index + 1}. Fecha: ${new Date(reading.timestamp).toLocaleString()}\n`;
            readingsContent += `   Valor: ${reading.value}\n`;
            readingsContent += `   Período: ${reading.period}\n`;
            if (reading.photoUrl) {
              readingsContent += `   Foto: Sí (URL: ${reading.photoUrl})\n`;
            }
            readingsContent += '\n';
          });

          readingsContent += '=====================================\n\n';
        });

        // Agregar archivo de lecturas al ZIP
        zip.file('lecturas_pendientes.txt', readingsContent);
        summaryContent += 'Ver archivo "lecturas_pendientes.txt" para el detalle de lecturas.\n\n';
      }

      // Agregar comentarios al ZIP
      if (pendingComments.length > 0) {
        let commentsContent = 'COMENTARIOS PENDIENTES\n';
        commentsContent += '=====================\n\n';

        // Agrupar comentarios por medidor
        const commentsByMeter = pendingComments.reduce((acc, comment) => {
          if (!acc[comment.meterCode]) {
            acc[comment.meterCode] = [];
          }
          acc[comment.meterCode].push(comment);
          return acc;
        }, {} as Record<string, PendingComment[]>);

        // Generar contenido detallado por medidor
        Object.entries(commentsByMeter).forEach(([meterCode, comments]) => {
          commentsContent += `Medidor: ${meterCode}\n`;
          commentsContent += '-------------------------------------\n';
          commentsContent += `Total comentarios: ${comments.length}\n\n`;

          comments.forEach((comment, index) => {
            commentsContent += `${index + 1}. Fecha: ${new Date(comment.timestamp).toLocaleString()}\n`;
            commentsContent += `   Notas: ${comment.notes}\n\n`;
          });

          commentsContent += '=====================================\n\n';
        });

        // Agregar archivo de comentarios al ZIP
        zip.file('comentarios_pendientes.txt', commentsContent);
        summaryContent += 'Ver archivo "comentarios_pendientes.txt" para el detalle de comentarios.\n\n';
      }

      // Agregar archivo de resumen al ZIP
      zip.file('resumen_general.txt', summaryContent);

      // Generar y descargar el ZIP
      const content = await zip.generateAsync({ type: 'blob' });
      const zipUrl = URL.createObjectURL(content);
      const zipLink = document.createElement('a');
      zipLink.href = zipUrl;
      zipLink.download = `datos_pendientes_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(zipLink);
      zipLink.click();
      document.body.removeChild(zipLink);
      URL.revokeObjectURL(zipUrl);

      showSnackbar('Archivo ZIP con todos los datos pendientes descargado exitosamente', 'success');
    } catch (error) {
      console.error('Error al generar archivo ZIP:', error);
      showSnackbar(
        `Error al generar el archivo ZIP: ${error instanceof Error ? error.message : 'Error desconocido'}`,
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
                  onClick={downloadAllPendingData}
                  variant="contained"
                  size="small"
                  color="primary"
                >
                  Descargar todo en ZIP
                </Button>
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