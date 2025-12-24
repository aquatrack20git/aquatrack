import React, { useEffect, useState } from 'react';
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
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Chip,
  Alert,
  Snackbar,
  CircularProgress,
  Tooltip,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Download as DownloadIcon,
  Calculate as CalculateIcon,
  Upload as UploadIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { supabase } from '../../config/supabase';
import { calculateBilling, calculateConsumption } from '../../utils/billingUtils';
import * as XLSX from 'xlsx';
import { getCurrentPeriod } from '../../utils/periodUtils';

interface Meter {
  code_meter: string;
  location: string;
  description: string | null;
}

interface Reading {
  id: number;
  meter_id: string;
  value: number;
  period: string;
  previous_reading?: number | null;
  consumption?: number | null;
}

interface Bill {
  id?: number;
  meter_id: string;
  period: string;
  previous_reading: number | null;
  current_reading: number;
  consumption: number;
  base_amount: number;
  range_16_20_amount: number;
  range_21_25_amount: number;
  range_26_plus_amount: number;
  tariff_total: number;
  previous_debt: number;
  fines_reuniones: number;
  fines_mingas: number;
  mora_amount: number;
  garden_amount: number;
  total_amount: number;
  payment_status: string;
  observations?: string;
}

interface BillRow extends Bill {
  meter_name?: string;
  meter_description?: string; // Apellidos y Nombres (description del medidor)
  meter_location?: string;
  isEditing?: boolean;
}

const Billing: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<string>(getCurrentPeriod());
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([]);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [bills, setBills] = useState<BillRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<BillRow>>({});
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'info' | 'warning',
  });
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  useEffect(() => {
    fetchPeriods();
    fetchMeters();
  }, []);

  useEffect(() => {
    if (selectedPeriod && meters.length > 0) {
      fetchReadings();
      fetchBills();
    }
  }, [selectedPeriod, meters]);

  const fetchPeriods = async () => {
    try {
      const { data, error } = await supabase
        .from('readings')
        .select('period');

      if (error) throw error;

      // Mapeo de nombres de meses a números (misma lógica que ReadingsManagement)
      const meses: Record<string, number> = {
        'ENERO': 1, 'FEBRERO': 2, 'MARZO': 3, 'ABRIL': 4, 'MAYO': 5, 'JUNIO': 6,
        'JULIO': 7, 'AGOSTO': 8, 'SEPTIEMBRE': 9, 'OCTUBRE': 10, 'NOVIEMBRE': 11, 'DICIEMBRE': 12
      };

      // Extraer periodos únicos y ordenar cronológicamente (más recientes primero)
      const uniquePeriods = [...new Set(data?.map(r => r.period) || [])].sort((a, b) => {
        const [mesA, añoA] = a.split(' ');
        const [mesB, añoB] = b.split(' ');
        const numMesA = meses[mesA];
        const numMesB = meses[mesB];
        const numAñoA = parseInt(añoA);
        const numAñoB = parseInt(añoB);
        
        // Primero comparar por año (más recientes primero)
        if (numAñoA !== numAñoB) return numAñoB - numAñoA;
        // Si es el mismo año, comparar por mes (más recientes primero)
        return numMesB - numMesA;
      });

      setAvailablePeriods(uniquePeriods);
    } catch (error: any) {
      console.error('Error fetching periods:', error);
      showSnackbar('Error al cargar períodos', 'error');
    }
  };

  const fetchMeters = async () => {
    try {
      const { data, error } = await supabase
        .from('meters')
        .select('code_meter, location, description')
        .eq('status', 'active')
        .order('code_meter');

      if (error) throw error;
      setMeters(data || []);
    } catch (error: any) {
      console.error('Error fetching meters:', error);
      showSnackbar('Error al cargar medidores', 'error');
    }
  };

  const fetchReadings = async () => {
    try {
      // Obtener todas las lecturas (no solo del período actual) para poder calcular lectura anterior
      const { data, error } = await supabase
        .from('readings')
        .select('id, meter_id, value, period')
        .order('id', { ascending: false });

      if (error) throw error;

      // Mapeo de nombres de meses a números (misma lógica que ReadingsManagement)
      const meses: Record<string, number> = {
        'ENERO': 1, 'FEBRERO': 2, 'MARZO': 3, 'ABRIL': 4, 'MAYO': 5, 'JUNIO': 6,
        'JULIO': 7, 'AGOSTO': 8, 'SEPTIEMBRE': 9, 'OCTUBRE': 10, 'NOVIEMBRE': 11, 'DICIEMBRE': 12
      };

      // Procesar los datos para calcular lectura anterior y consumo (misma lógica que ReadingsManagement)
      const processedData = data?.map((reading) => {
        // Obtener todas las lecturas del mismo medidor ordenadas por periodo
        const lecturasDelMedidor = data
          .filter(r => r.meter_id === reading.meter_id)
          .sort((a, b) => {
            const [mesA, añoA] = a.period.split(' ');
            const [mesB, añoB] = b.period.split(' ');
            const numMesA = meses[mesA];
            const numMesB = meses[mesB];
            const numAñoA = parseInt(añoA);
            const numAñoB = parseInt(añoB);
            
            // Primero comparar por año
            if (numAñoA !== numAñoB) {
              return numAñoB - numAñoA; // Años más recientes primero
            }
            // Si es el mismo año, comparar por mes
            return numMesB - numMesA; // Meses más recientes primero
          });

        // Encontrar la lectura anterior (la siguiente en la lista ordenada)
        const currentIndex = lecturasDelMedidor.findIndex(r => r.period === reading.period);
        const previousReading = currentIndex < lecturasDelMedidor.length - 1 ? lecturasDelMedidor[currentIndex + 1] : null;

        // Calcular el consumo (misma lógica que ReadingsManagement)
        let consumption = null;
        if (previousReading && typeof reading.value === 'number' && typeof previousReading.value === 'number') {
          consumption = reading.value - previousReading.value;
        }

        return {
          ...reading,
          previous_reading: previousReading?.value,
          consumption: consumption !== null ? consumption : 0
        };
      }) || [];

      // Filtrar solo las lecturas del período seleccionado
      const readingsForPeriod = processedData.filter(r => r.period === selectedPeriod);
      
      setReadings(readingsForPeriod);
    } catch (error: any) {
      console.error('Error fetching readings:', error);
      showSnackbar('Error al cargar lecturas', 'error');
    }
  };

  const fetchBills = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('bills')
        .select('*')
        .eq('period', selectedPeriod)
        .order('meter_id');

      if (error) throw error;

      // Obtener valores de jardín para este período y actualizar garden_amount en bills
      const { data: gardenValuesData } = await supabase
        .from('garden_values')
        .select('meter_id, amount')
        .eq('period', selectedPeriod);

      const gardenValuesMap = new Map(
        (gardenValuesData || []).map(gv => [gv.meter_id, gv.amount])
      );

      // Actualizar garden_amount en la BD si es diferente
      const billsToUpdate: Array<{ id: number; garden_amount: number }> = [];
      let billsData = data || [];
      
      for (const bill of billsData) {
        const gardenAmount = gardenValuesMap.get(bill.meter_id) || 0;
        if (bill.garden_amount !== gardenAmount) {
          billsToUpdate.push({ id: bill.id, garden_amount: gardenAmount });
        }
      }

      // Actualizar en batch si hay cambios
      if (billsToUpdate.length > 0) {
        for (const update of billsToUpdate) {
          await supabase
            .from('bills')
            .update({ garden_amount: update.garden_amount })
            .eq('id', update.id);
        }
        console.log(`Se actualizaron ${billsToUpdate.length} facturas con valores de jardín desde garden_values`);
        
        // Refrescar los datos después de actualizar
        const { data: updatedData, error: refreshError } = await supabase
          .from('bills')
          .select('*')
          .eq('period', selectedPeriod)
          .order('meter_id');
        
        if (!refreshError && updatedData) {
          billsData = updatedData;
        }
      }

      // Enriquecer con datos del medidor y actualizar garden_amount desde garden_values
      const enrichedBills = billsData.map(bill => {
        const meter = meters.find(m => m.code_meter === bill.meter_id);
        const gardenAmount = gardenValuesMap.get(bill.meter_id) ?? bill.garden_amount ?? 0;
        return {
          ...bill,
          garden_amount: gardenAmount, // Usar el valor más reciente de garden_values
          meter_name: meter?.code_meter || bill.meter_id,
          meter_description: meter?.description || '', // Apellidos y Nombres
          meter_location: meter?.location || '',
        };
      });

      setBills(enrichedBills);
    } catch (error: any) {
      console.error('Error fetching bills:', error);
      showSnackbar('Error al cargar facturas', 'error');
    } finally {
      setLoading(false);
    }
  };

  const calculateAllBills = async () => {
    try {
      setCalculating(true);
      
      if (!readings || readings.length === 0) {
        showSnackbar('No hay lecturas para el período seleccionado', 'warning');
        return;
      }

      // Obtener bills existentes para preservar id y payment_status
      const { data: existingBills } = await supabase
        .from('bills')
        .select('id, meter_id, payment_status, observations')
        .eq('period', selectedPeriod);

      const existingBillsMap = new Map(
        (existingBills || []).map(bill => [bill.meter_id, bill])
      );

      const newBills: BillRow[] = [];

      for (const reading of readings) {
        try {
          // Usar lectura anterior y consumo ya calculados (misma lógica que ReadingsManagement)
          const previousReading = reading.previous_reading ?? null;
          const consumption = reading.consumption ?? 0;

          // Calcular tarifas
          const billingCalc = await calculateBilling(consumption);

          // Obtener deuda anterior (usar maybeSingle para evitar errores si no existe)
          const { data: debtData, error: debtError } = await supabase
            .from('debts')
            .select('amount')
            .eq('meter_id', reading.meter_id)
            .eq('period', selectedPeriod)
            .maybeSingle();

          const previousDebt = debtData?.amount || 0;

          // Obtener multas y mora (usar maybeSingle para evitar errores si no existe)
          const { data: finesData, error: finesError } = await supabase
            .from('meter_fines')
            .select('fines_reuniones, fines_mingas, mora_percentage, mora_amount')
            .eq('meter_id', reading.meter_id)
            .eq('period', selectedPeriod)
            .maybeSingle();

          const finesReuniones = finesData?.fines_reuniones || 0;
          const finesMingas = finesData?.fines_mingas || 0;
          const moraAmount = finesData?.mora_amount || (previousDebt * (finesData?.mora_percentage || 0) / 100);

          // Obtener valor de jardín (usar maybeSingle para evitar errores si no existe)
          const { data: gardenData, error: gardenError } = await supabase
            .from('garden_values')
            .select('amount')
            .eq('meter_id', reading.meter_id)
            .eq('period', selectedPeriod)
            .maybeSingle();

          const gardenAmount = gardenData?.amount || 0;

          // Calcular total (según fórmula: DEUDA + COBRO + MULTAS_MINGAS + MORA)
          // NO incluye MULTAS_REUNIONES ni VALOR_JARDIN
          const totalAmount = 
            previousDebt +
            billingCalc.tariff_total +
            finesMingas +
            moraAmount;

          const meter = meters.find(m => m.code_meter === reading.meter_id);
          const existingBill = existingBillsMap.get(reading.meter_id);

          newBills.push({
            id: existingBill?.id, // Preservar id si existe
            meter_id: reading.meter_id,
            period: selectedPeriod,
            previous_reading: previousReading,
            current_reading: reading.value,
            consumption,
            base_amount: billingCalc.base_amount,
            range_16_20_amount: billingCalc.range_16_20_amount,
            range_21_25_amount: billingCalc.range_21_25_amount,
            range_26_plus_amount: billingCalc.range_26_plus_amount,
            tariff_total: billingCalc.tariff_total,
            previous_debt: previousDebt,
            fines_reuniones: finesReuniones,
            fines_mingas: finesMingas,
            mora_amount: moraAmount,
            garden_amount: gardenAmount, // Incluir el valor de jardín actualizado
            total_amount: totalAmount,
            payment_status: existingBill?.payment_status || 'PENDIENTE', // Preservar estado de pago
            observations: existingBill?.observations || undefined, // Preservar observaciones
            meter_name: meter?.code_meter || reading.meter_id,
            meter_description: meter?.description || '', // Apellidos y Nombres
            meter_location: meter?.location || '',
          });
        } catch (error: any) {
          console.error(`Error processing reading for ${reading.meter_id}:`, error);
          // Continuar con el siguiente medidor aunque haya un error
        }
      }

      setBills(newBills);
      showSnackbar(`Se calcularon ${newBills.length} facturas`, 'success');
    } catch (error: any) {
      console.error('Error calculating bills:', error);
      showSnackbar(error.message || 'Error al calcular facturas', 'error');
    } finally {
      setCalculating(false);
    }
  };

  const handleEdit = (meterId: string) => {
    const bill = bills.find(b => b.meter_id === meterId);
    if (bill) {
      setEditData({ ...bill });
      setEditingRow(meterId);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingRow) return;

    try {
      // Validar que el meter_id existe en la tabla meters
      const { data: meterData, error: meterError } = await supabase
        .from('meters')
        .select('code_meter, status')
        .eq('code_meter', editingRow)
        .maybeSingle();

      if (meterError) {
        console.error(`Error validating meter ${editingRow}:`, meterError);
        showSnackbar(`Error al validar el medidor ${editingRow}`, 'error');
        return;
      }

      if (!meterData) {
        showSnackbar(`El medidor ${editingRow} no existe en la tabla de medidores`, 'error');
        return;
      }

      if (meterData.status !== 'active') {
        console.warn(`Meter ${editingRow} no está activo (status: ${meterData.status})`);
      }

      const billData = {
        meter_id: editingRow,
        period: selectedPeriod,
        previous_reading: editData.previous_reading || null,
        current_reading: editData.current_reading || 0,
        consumption: editData.consumption || 0,
        base_amount: editData.base_amount || 0,
        range_16_20_amount: editData.range_16_20_amount || 0,
        range_21_25_amount: editData.range_21_25_amount || 0,
        range_26_plus_amount: editData.range_26_plus_amount || 0,
        tariff_total: editData.tariff_total || 0,
        previous_debt: editData.previous_debt || 0,
        fines_reuniones: editData.fines_reuniones || 0,
        fines_mingas: editData.fines_mingas || 0,
        mora_amount: editData.mora_amount || 0,
        garden_amount: editData.garden_amount || 0,
        total_amount: editData.total_amount || 0,
        payment_status: editData.payment_status || 'PENDIENTE',
        observations: editData.observations || null,
      };

      // Recalcular total siempre (DEUDA + COBRO + MULTAS_MINGAS + MORA)
      billData.total_amount = 
        billData.previous_debt +
        billData.tariff_total +
        billData.fines_mingas +
        billData.mora_amount;

      // Verificar si existe
      const existingBill = bills.find(b => b.meter_id === editingRow && b.id);
      
      if (existingBill?.id) {
        const { error } = await supabase
          .from('bills')
          .update(billData)
          .eq('id', existingBill.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('bills')
          .insert([billData]);

        if (error) throw error;
      }

      setEditingRow(null);
      setEditData({});
      fetchBills();
      showSnackbar('Factura guardada exitosamente', 'success');
    } catch (error: any) {
      console.error('Error saving bill:', error);
      showSnackbar('Error al guardar factura', 'error');
    }
  };

  const handleSaveAll = async () => {
    try {
      setLoading(true);
      let saved = 0;
      let errors = 0;

      for (const bill of bills) {
        try {
          // Validar que el meter_id existe en la tabla meters
          const { data: meterData, error: meterError } = await supabase
            .from('meters')
            .select('code_meter, status')
            .eq('code_meter', bill.meter_id)
            .maybeSingle();

          if (meterError) {
            console.error(`Error validating meter ${bill.meter_id}:`, meterError);
            errors++;
            continue;
          }

          if (!meterData) {
            console.error(`Meter ${bill.meter_id} no existe en la tabla meters`);
            errors++;
            continue;
          }

          if (meterData.status !== 'active') {
            console.warn(`Meter ${bill.meter_id} no está activo (status: ${meterData.status})`);
            // Continuar de todas formas, pero registrar la advertencia
          }

          const billData = {
            meter_id: bill.meter_id,
            period: bill.period,
            previous_reading: bill.previous_reading,
            current_reading: bill.current_reading,
            consumption: bill.consumption,
            base_amount: bill.base_amount,
            range_16_20_amount: bill.range_16_20_amount,
            range_21_25_amount: bill.range_21_25_amount,
            range_26_plus_amount: bill.range_26_plus_amount,
            tariff_total: bill.tariff_total,
            previous_debt: bill.previous_debt,
            fines_reuniones: bill.fines_reuniones,
            fines_mingas: bill.fines_mingas,
            mora_amount: bill.mora_amount,
            garden_amount: bill.garden_amount,
            total_amount: bill.total_amount,
            payment_status: bill.payment_status,
            observations: bill.observations || null,
          };

          if (bill.id) {
            // Intentar actualizar primero
            const { data: updateData, error: updateError } = await supabase
              .from('bills')
              .update(billData)
              .eq('id', bill.id)
              .select();

            if (updateError) {
              console.error(`Error updating bill ${bill.id} for ${bill.meter_id}:`, updateError);
              throw updateError;
            }

            // Si no se actualizó ninguna fila, el registro podría no existir
            if (!updateData || updateData.length === 0) {
              console.warn(`Bill ${bill.id} for ${bill.meter_id} not found, attempting insert/upsert`);
              // Intentar upsert usando meter_id y period como clave única
              const { data: upsertData, error: upsertError } = await supabase
                .from('bills')
                .upsert(billData, {
                  onConflict: 'meter_id,period'
                })
                .select();

              if (upsertError) {
                console.error(`Error upserting bill for ${bill.meter_id}:`, upsertError);
                throw upsertError;
              }

              if (upsertData && upsertData.length > 0) {
                console.log(`✓ Upserted bill for ${bill.meter_id} (${bill.period})`);
                saved++;
              } else {
                console.warn(`⚠ No se pudo confirmar el guardado de ${bill.meter_id}`);
                errors++;
              }
            } else {
              console.log(`✓ Updated bill ${bill.id} for ${bill.meter_id} (${bill.period})`);
              saved++;
            }
          } else {
            // No tiene ID, intentar insertar o upsert si ya existe
            const { data: insertData, error: insertError } = await supabase
              .from('bills')
              .upsert(billData, {
                onConflict: 'meter_id,period'
              })
              .select();

            if (insertError) {
              console.error(`Error inserting bill for ${bill.meter_id}:`, insertError);
              throw insertError;
            }

            if (insertData && insertData.length > 0) {
              console.log(`✓ Inserted/Upserted bill for ${bill.meter_id} (${bill.period})`);
              saved++;
            } else {
              console.warn(`⚠ No se pudo confirmar el guardado de ${bill.meter_id}`);
              errors++;
            }
          }
        } catch (error) {
          console.error(`Error saving bill for ${bill.meter_id}:`, error);
          errors++;
        }
      }

      const errorDetails = errors > 0 ? `. ${errors} error(es) - revisa la consola para más detalles` : '';
      showSnackbar(
        `Se guardaron ${saved} facturas${errorDetails}`,
        errors > 0 ? 'warning' : 'success'
      );
      fetchBills();
    } catch (error: any) {
      console.error('Error saving all bills:', error);
      showSnackbar('Error al guardar facturas', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    const exportData = bills.map(bill => {
      const meter = meters.find(m => m.code_meter === bill.meter_id);
      return {
        'COD': bill.meter_id,
        'NOMBRES Y APELLIDOS': meter?.description || bill.meter_description || '',
        'LECTURA ANTERIOR': bill.previous_reading || 0,
        'LECTURA ACTUAL': bill.current_reading,
        'TOTAL CONSUMO': bill.consumption,
        'BASE': bill.base_amount.toFixed(2),
        '16-20': bill.range_16_20_amount.toFixed(2),
        '20-25': bill.range_21_25_amount.toFixed(2),
        '26-100': bill.range_26_plus_amount.toFixed(2),
        'DEUDA': bill.previous_debt.toFixed(2),
        'COBRO OCTUBRE': bill.tariff_total.toFixed(2),
        'MULTAS REUNIONES': bill.fines_reuniones.toFixed(2),
        'MULTAS MINGAS': bill.fines_mingas.toFixed(2),
        'MORA': bill.mora_amount.toFixed(2),
        'TOTAL A PAGAR': bill.total_amount.toFixed(2),
        'CONCEPTO': bill.payment_status,
        'VALOR JARDIN': bill.garden_amount.toFixed(2),
        'DIFERENCIA': (bill.total_amount - bill.garden_amount).toFixed(2),
        'OBSERVACIONES OCTUBRE': bill.observations || '',
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `COBRO ${selectedPeriod}`);
    
    // Ajustar ancho de columnas
    const colWidths = [
      { wch: 10 }, // COD
      { wch: 30 }, // NOMBRES
      { wch: 15 }, // LECTURA ANTERIOR
      { wch: 15 }, // LECTURA ACTUAL
      { wch: 15 }, // TOTAL CONSUMO
      { wch: 10 }, // BASE
      { wch: 10 }, // 16-20
      { wch: 10 }, // 20-25
      { wch: 10 }, // 26-100
      { wch: 10 }, // DEUDA
      { wch: 15 }, // COBRO
      { wch: 15 }, // MULTAS REUNIONES
      { wch: 15 }, // MULTAS MINGAS
      { wch: 10 }, // MORA
      { wch: 15 }, // TOTAL A PAGAR
      { wch: 15 }, // CONCEPTO
      { wch: 15 }, // VALOR JARDIN
      { wch: 15 }, // DIFERENCIA
      { wch: 30 }, // OBSERVACIONES
    ];
    ws['!cols'] = colWidths;

    const fileName = `FACTURACION CORRESPONDIENTE A ${selectedPeriod}.xlsx`;
    XLSX.writeFile(wb, fileName);
    showSnackbar('Archivo Excel exportado exitosamente', 'success');
  };

  const handleImportGarden = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[];

      // Buscar la fila de encabezados (buscar "Código Recaudación" o similar)
      let headerRowIndex = -1;
      for (let i = 0; i < Math.min(10, jsonData.length); i++) {
        const row = jsonData[i];
        if (Array.isArray(row) && row.some((cell: any) => 
          String(cell).toLowerCase().includes('código') || 
          String(cell).toLowerCase().includes('codigo')
        )) {
          headerRowIndex = i;
          break;
        }
      }

      if (headerRowIndex === -1) {
        throw new Error('No se encontró la fila de encabezados');
      }

      const headers = jsonData[headerRowIndex] as string[];
      
      // Buscar columna de código con múltiples variaciones
      const codigoIndex = headers.findIndex(h => {
        const headerLower = String(h || '').toLowerCase().trim();
        return headerLower.includes('código') || 
               headerLower.includes('codigo') ||
               headerLower.includes('code') ||
               headerLower.includes('medidor') ||
               headerLower.includes('meter');
      });
      
      // Buscar columna de valor con múltiples variaciones
      const valorIndex = headers.findIndex(h => {
        const headerLower = String(h || '').toLowerCase().trim();
        return headerLower.includes('valor') || 
               headerLower.includes('amount') ||
               headerLower.includes('monto') ||
               headerLower.includes('importe') ||
               headerLower.includes('jardín') ||
               headerLower.includes('jardin');
      });

      if (codigoIndex === -1) {
        throw new Error('No se encontró la columna de código. Busque columnas con: Código, Codigo, Code, Medidor, Meter');
      }
      
      if (valorIndex === -1) {
        throw new Error('No se encontró la columna de valor. Busque columnas con: Valor, Amount, Monto, Importe, Jardín, Jardin');
      }

      // Buscar columna de período (opcional, si no existe se usa selectedPeriod)
      const periodoIndex = headers.findIndex(h => {
        const headerLower = String(h || '').toLowerCase().trim();
        return headerLower.includes('período') || 
               headerLower.includes('periodo') ||
               headerLower.includes('period');
      });

      console.log(`Columnas encontradas: Código en índice ${codigoIndex} (${headers[codigoIndex]}), Valor en índice ${valorIndex} (${headers[valorIndex]})${periodoIndex !== -1 ? `, Período en índice ${periodoIndex} (${headers[periodoIndex]})` : ', Período no encontrado (usando período seleccionado)'}`);
      console.log(`Período seleccionado para importación: ${selectedPeriod}`);

      if (!selectedPeriod) {
        throw new Error('No hay período seleccionado. Por favor, selecciona un período antes de importar.');
      }

      let imported = 0;
      let errors = 0;
      let skipped = 0;

      // Procesar filas de datos
      for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        
        // Verificar que la fila sea un array válido
        if (!Array.isArray(row)) {
          skipped++;
          continue;
        }

        // Obtener código y valor, manejando valores vacíos, nulos o undefined
        const codigoCell = row[codigoIndex];
        const valorCell = row[valorIndex];

        // Si ambos están vacíos, nulos o undefined, saltar la fila
        if ((codigoCell === undefined || codigoCell === null || codigoCell === '') &&
            (valorCell === undefined || valorCell === null || valorCell === '')) {
          skipped++;
          continue;
        }

        // Convertir código a string y limpiar
        const meterCode = codigoCell ? String(codigoCell).trim() : '';
        
        // Si no hay código, saltar
        if (!meterCode) {
          skipped++;
          continue;
        }

        // Convertir valor a número, permitiendo 0
        let amount: number;
        if (valorCell === undefined || valorCell === null || valorCell === '') {
          amount = 0;
        } else {
          const parsed = parseFloat(String(valorCell));
          amount = isNaN(parsed) ? 0 : parsed;
        }

        // Permitir valores de 0 o negativos (pueden ser válidos en algunos casos)
        // Si quieres rechazar negativos, puedes agregar: if (amount < 0) continue;

        // Obtener período de la fila si existe, sino usar el seleccionado
        let periodToUse = selectedPeriod;
        if (periodoIndex !== -1 && row[periodoIndex]) {
          const periodFromExcel = String(row[periodoIndex]).trim();
          if (periodFromExcel) {
            periodToUse = periodFromExcel;
          }
        }

        try {
          const upsertData = {
            meter_id: meterCode,
            period: periodToUse,
            amount: amount,
            imported_from_excel: true,
            import_date: new Date().toISOString(),
          };

          console.log(`Importando: ${meterCode}, Período: ${periodToUse}, Valor: ${amount}`);

          // Verificar si ya existe un registro para este medidor y período
          const { data: existingData, error: checkError } = await supabase
            .from('garden_values')
            .select('id')
            .eq('meter_id', meterCode)
            .eq('period', periodToUse)
            .maybeSingle();

          if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
            console.error(`Error checking existing record for ${meterCode} (${periodToUse}):`, checkError);
            throw checkError;
          }

          let result;
          if (existingData) {
            // Actualizar registro existente
            const { data, error } = await supabase
              .from('garden_values')
              .update({
                amount: amount,
                imported_from_excel: true,
                import_date: new Date().toISOString(),
              })
              .eq('meter_id', meterCode)
              .eq('period', periodToUse)
              .select();

            result = { data, error };
            if (data && data.length > 0) {
              console.log(`✓ Actualizado: ${meterCode} - ${periodToUse} = $${amount}`);
            }
          } else {
            // Insertar nuevo registro
            const { data, error } = await supabase
              .from('garden_values')
              .insert([upsertData])
              .select();

            result = { data, error };
            if (data && data.length > 0) {
              console.log(`✓ Insertado: ${meterCode} - ${periodToUse} = $${amount}`);
            }
          }

          if (result.error) {
            console.error(`Error importing garden value for ${meterCode} (${periodToUse}):`, result.error);
            throw result.error;
          }

          if (result.data && result.data.length > 0) {
            imported++;
          } else {
            console.warn(`⚠ No se pudo confirmar la importación de ${meterCode} - ${periodToUse}`);
            errors++;
          }
        } catch (error: any) {
          console.error(`Error importing garden value for ${meterCode} (${periodToUse}):`, error);
          errors++;
        }
      }

      console.log(`Importación completada: ${imported} importados, ${errors} errores, ${skipped} filas omitidas`);

      const message = `Se importaron ${imported} valores de jardín${errors > 0 ? `. ${errors} errores` : ''}${skipped > 0 ? `. ${skipped} filas omitidas` : ''}`;
      showSnackbar(
        message,
        errors > 0 ? 'warning' : 'success'
      );
      
      setImportDialogOpen(false);
      
      // Recalcular facturas con los nuevos valores de jardín
      await calculateAllBills();
      
      // Refrescar los bills - fetchBills ahora sincroniza automáticamente garden_amount desde garden_values
      await fetchBills();
    } catch (error: any) {
      console.error('Error importing garden values:', error);
      showSnackbar(error.message || 'Error al importar valores de jardín', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePaymentStatus = async (meterId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'ACREDITADO' ? 'PENDIENTE' : 'ACREDITADO';
      const bill = bills.find(b => b.meter_id === meterId);
      
      if (bill?.id) {
        const { error } = await supabase
          .from('bills')
          .update({ 
            payment_status: newStatus,
            payment_date: newStatus === 'ACREDITADO' ? new Date().toISOString() : null
          })
          .eq('id', bill.id);

        if (error) throw error;
      } else {
        // Si no existe, actualizar en memoria
        setBills(prev => prev.map(b => 
          b.meter_id === meterId 
            ? { ...b, payment_status: newStatus, payment_date: newStatus === 'ACREDITADO' ? new Date().toISOString() : null }
            : b
        ));
      }

      fetchBills();
      showSnackbar(`Estado de pago actualizado a ${newStatus}`, 'success');
    } catch (error: any) {
      console.error('Error updating payment status:', error);
      showSnackbar('Error al actualizar estado de pago', 'error');
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    setSnackbar({
      open: true,
      message,
      severity,
    });
  };

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4" component="h1">
          Facturación
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Período</InputLabel>
            <Select
              value={selectedPeriod}
              label="Período"
              onChange={(e) => setSelectedPeriod(e.target.value)}
            >
              {availablePeriods.map((period) => (
                <MenuItem key={period} value={period}>
                  {period}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={<CalculateIcon />}
            onClick={calculateAllBills}
            disabled={calculating || !selectedPeriod}
          >
            {calculating ? 'Calculando...' : 'Calcular Todo'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            onClick={() => setImportDialogOpen(true)}
          >
            Importar Jardín
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSaveAll}
            disabled={loading || bills.length === 0}
          >
            Guardar Todo
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<DownloadIcon />}
            onClick={handleExportExcel}
            disabled={bills.length === 0}
          >
            Exportar Excel
          </Button>
        </Box>
      </Box>

      {bills.length === 0 && !loading && (
        <Alert severity="info" sx={{ mb: 2 }}>
          No hay facturas calculadas para este período. Haz clic en "Calcular Todo" para generar las facturas.
        </Alert>
      )}

      {loading && (
        <Box display="flex" justifyContent="center" p={3}>
          <CircularProgress />
        </Box>
      )}

      {!loading && bills.length > 0 && (
        <Paper>
          <TableContainer sx={{ maxHeight: '70vh' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell>COD</TableCell>
                  <TableCell>NOMBRES Y APELLIDOS</TableCell>
                  <TableCell>LECTURA ANTERIOR</TableCell>
                  <TableCell>LECTURA ACTUAL</TableCell>
                  <TableCell>TOTAL CONSUMO</TableCell>
                  <TableCell>BASE</TableCell>
                  <TableCell>16-20</TableCell>
                  <TableCell>20-25</TableCell>
                  <TableCell>26-100</TableCell>
                  <TableCell>DEUDA</TableCell>
                  <TableCell>COBRO</TableCell>
                  <TableCell>MULTAS REUNIONES</TableCell>
                  <TableCell>MULTAS MINGAS</TableCell>
                  <TableCell>MORA</TableCell>
                  <TableCell>TOTAL A PAGAR</TableCell>
                  <TableCell>CONCEPTO</TableCell>
                  <TableCell>VALOR JARDIN</TableCell>
                  <TableCell>DIFERENCIA</TableCell>
                  <TableCell>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {bills.map((bill) => {
                  const meter = meters.find(m => m.code_meter === bill.meter_id);
                  const displayName = bill.meter_description || meter?.description || bill.meter_id;
                  return (
                  <TableRow key={bill.meter_id} hover>
                    <TableCell>{bill.meter_id}</TableCell>
                    <TableCell>{displayName}</TableCell>
                    <TableCell>
                      {editingRow === bill.meter_id ? (
                        <TextField
                          type="number"
                          size="small"
                          value={editData.previous_reading || ''}
                          onChange={(e) => setEditData({
                            ...editData,
                            previous_reading: parseFloat(e.target.value) || null,
                            consumption: calculateConsumption(
                              editData.current_reading || bill.current_reading,
                              parseFloat(e.target.value) || null
                            )
                          })}
                          sx={{ width: 100 }}
                        />
                      ) : (
                        bill.previous_reading || 0
                      )}
                    </TableCell>
                    <TableCell>
                      {editingRow === bill.meter_id ? (
                        <TextField
                          type="number"
                          size="small"
                          value={editData.current_reading || bill.current_reading}
                          onChange={(e) => {
                            const newReading = parseFloat(e.target.value) || 0;
                            setEditData({
                              ...editData,
                              current_reading: newReading,
                              consumption: calculateConsumption(
                                newReading,
                                editData.previous_reading ?? bill.previous_reading
                              )
                            });
                          }}
                          sx={{ width: 100 }}
                        />
                      ) : (
                        bill.current_reading
                      )}
                    </TableCell>
                    <TableCell>
                      {editingRow === bill.meter_id ? (
                        <TextField
                          type="number"
                          size="small"
                          value={editData.consumption ?? bill.consumption}
                          onChange={async (e) => {
                            const newConsumption = parseFloat(e.target.value) || 0;
                            const billingCalc = await calculateBilling(newConsumption);
                            setEditData({
                              ...editData,
                              consumption: newConsumption,
                              base_amount: billingCalc.base_amount,
                              range_16_20_amount: billingCalc.range_16_20_amount,
                              range_21_25_amount: billingCalc.range_21_25_amount,
                              range_26_plus_amount: billingCalc.range_26_plus_amount,
                              tariff_total: billingCalc.tariff_total,
                              total_amount: 
                                (editData.previous_debt ?? bill.previous_debt) +
                                billingCalc.tariff_total +
                                (editData.fines_mingas ?? bill.fines_mingas) +
                                (editData.mora_amount ?? bill.mora_amount),
                            });
                          }}
                          sx={{ width: 100 }}
                        />
                      ) : (
                        bill.consumption
                      )}
                    </TableCell>
                    <TableCell>${bill.base_amount.toFixed(2)}</TableCell>
                    <TableCell>${bill.range_16_20_amount.toFixed(2)}</TableCell>
                    <TableCell>${bill.range_21_25_amount.toFixed(2)}</TableCell>
                    <TableCell>${bill.range_26_plus_amount.toFixed(2)}</TableCell>
                    <TableCell>
                      {editingRow === bill.meter_id ? (
                        <TextField
                          type="number"
                          size="small"
                          value={editData.previous_debt ?? bill.previous_debt}
                          onChange={(e) => {
                            const newDebt = parseFloat(e.target.value) || 0;
                            setEditData({
                              ...editData,
                              previous_debt: newDebt,
                              total_amount: 
                                newDebt +
                                (editData.tariff_total ?? bill.tariff_total) +
                                (editData.fines_mingas ?? bill.fines_mingas) +
                                (editData.mora_amount ?? bill.mora_amount),
                            });
                          }}
                          sx={{ width: 100 }}
                        />
                      ) : (
                        `$${bill.previous_debt.toFixed(2)}`
                      )}
                    </TableCell>
                    <TableCell>${bill.tariff_total.toFixed(2)}</TableCell>
                    <TableCell>
                      {editingRow === bill.meter_id ? (
                        <TextField
                          type="number"
                          size="small"
                          value={editData.fines_reuniones ?? bill.fines_reuniones}
                          onChange={(e) => {
                            const newFines = parseFloat(e.target.value) || 0;
                            setEditData({
                              ...editData,
                              fines_reuniones: newFines,
                              // MULTAS_REUNIONES no se incluye en el total
                              total_amount: 
                                (editData.previous_debt ?? bill.previous_debt) +
                                (editData.tariff_total ?? bill.tariff_total) +
                                (editData.fines_mingas ?? bill.fines_mingas) +
                                (editData.mora_amount ?? bill.mora_amount),
                            });
                          }}
                          sx={{ width: 100 }}
                        />
                      ) : (
                        `$${bill.fines_reuniones.toFixed(2)}`
                      )}
                    </TableCell>
                    <TableCell>
                      {editingRow === bill.meter_id ? (
                        <TextField
                          type="number"
                          size="small"
                          value={editData.fines_mingas ?? bill.fines_mingas}
                          onChange={(e) => {
                            const newFines = parseFloat(e.target.value) || 0;
                            setEditData({
                              ...editData,
                              fines_mingas: newFines,
                              total_amount: 
                                (editData.previous_debt ?? bill.previous_debt) +
                                (editData.tariff_total ?? bill.tariff_total) +
                                newFines +
                                (editData.mora_amount ?? bill.mora_amount),
                            });
                          }}
                          sx={{ width: 100 }}
                        />
                      ) : (
                        `$${bill.fines_mingas.toFixed(2)}`
                      )}
                    </TableCell>
                    <TableCell>
                      {editingRow === bill.meter_id ? (
                        <TextField
                          type="number"
                          size="small"
                          value={editData.mora_amount ?? bill.mora_amount}
                          onChange={(e) => {
                            const newMora = parseFloat(e.target.value) || 0;
                            setEditData({
                              ...editData,
                              mora_amount: newMora,
                              total_amount: 
                                (editData.previous_debt ?? bill.previous_debt) +
                                (editData.tariff_total ?? bill.tariff_total) +
                                (editData.fines_mingas ?? bill.fines_mingas) +
                                newMora,
                            });
                          }}
                          sx={{ width: 100 }}
                        />
                      ) : (
                        `$${bill.mora_amount.toFixed(2)}`
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        ${(editingRow === bill.meter_id 
                          ? (editData.total_amount ?? bill.total_amount)
                          : bill.total_amount).toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={bill.payment_status}
                        size="small"
                        color={bill.payment_status === 'ACREDITADO' ? 'success' : 'default'}
                        onClick={() => handleTogglePaymentStatus(bill.meter_id, bill.payment_status)}
                        sx={{ cursor: 'pointer' }}
                      />
                    </TableCell>
                    <TableCell>
                      {editingRow === bill.meter_id ? (
                        <TextField
                          type="number"
                          size="small"
                          value={editData.garden_amount ?? bill.garden_amount}
                          onChange={(e) => {
                            const newGarden = parseFloat(e.target.value) || 0;
                            setEditData({
                              ...editData,
                              garden_amount: newGarden,
                              // El jardín NO se incluye en el total, solo se muestra como información adicional
                              // DIFERENCIA = TOTAL A PAGAR - VALOR JARDIN
                              total_amount: 
                                (editData.previous_debt ?? bill.previous_debt) +
                                (editData.tariff_total ?? bill.tariff_total) +
                                (editData.fines_mingas ?? bill.fines_mingas) +
                                (editData.mora_amount ?? bill.mora_amount),
                            });
                          }}
                          sx={{ width: 100 }}
                        />
                      ) : (
                        `$${bill.garden_amount.toFixed(2)}`
                      )}
                    </TableCell>
                    <TableCell>
                      ${((editingRow === bill.meter_id 
                        ? (editData.total_amount ?? bill.total_amount)
                        : bill.total_amount) - 
                        (editingRow === bill.meter_id 
                          ? (editData.garden_amount ?? bill.garden_amount)
                          : bill.garden_amount)).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {editingRow === bill.meter_id ? (
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={handleSaveEdit}
                          >
                            <SaveIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => {
                              setEditingRow(null);
                              setEditData({});
                            }}
                          >
                            <RefreshIcon />
                          </IconButton>
                        </Box>
                      ) : (
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleEdit(bill.meter_id)}
                        >
                          <EditIcon />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Dialog para importar valores de jardín */}
      <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Importar Valores de Jardín</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Selecciona un archivo Excel con el formato de "HOJA DE JARDIN". 
              El archivo debe contener columnas: Código y Valor.
            </Typography>
            <Button
              variant="outlined"
              component="label"
              fullWidth
              startIcon={<UploadIcon />}
            >
              Seleccionar Archivo Excel
              <input
                type="file"
                hidden
                accept=".xlsx,.xls"
                onChange={handleImportGarden}
              />
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Billing;

