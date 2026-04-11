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
import { calculateBilling, calculateBillingWithTariffs, calculateConsumption } from '../../utils/billingUtils';
import * as XLSX from 'xlsx';
import { getCurrentPeriod, getPreviousPeriod, getPeriodFromDate } from '../../utils/periodUtils';

/** Desactivar en false para ocultar el import temporal de Excel de cobro completo. */
const ENABLE_TEMP_BILLING_IMPORT = true;

function normHeaderCell(s: unknown): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseExcelNumber(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const s = String(v).replace(/,/g, '.').trim();
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function parseExcelNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).replace(/,/g, '.').trim();
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function findColIndex(headers: unknown[], predicate: (n: string) => boolean): number {
  for (let i = 0; i < headers.length; i++) {
    const n = normHeaderCell(headers[i]);
    if (n && predicate(n)) return i;
  }
  return -1;
}

/** Filas desde texto separado por tabuladores (export tipo Excel → TXT). */
function parseTabSeparatedSheet(text: string): unknown[][] {
  const raw = text.replace(/^\uFEFF/, '');
  return raw
    .split(/\r?\n/)
    .filter((line) => line.replace(/\t/g, '').trim().length > 0)
    .map((line) =>
      line.split('\t').map((c) => String(c).replace(/^\uFEFF/, '').trim())
    );
}

interface Meter {
  code_meter: string;
  location: string;
  description: string | null;
  created_at?: string;
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
  /** Persistido: total_amount − garden_amount */
  difference_amount?: number | null;
  payment_status: string;
  observations?: string;
}

interface BillRow extends Bill {
  meter_name?: string;
  meter_description?: string; // Apellidos y Nombres (description del medidor)
  meter_location?: string;
  /** Total a pagar de la factura del mismo medidor en el período anterior (solo UI) */
  previous_period_total?: number | null;
  isEditing?: boolean;
}

/**
 * Diferencia del bill = total a pagar − valor jardín (columna DIFERENCIA, persistida en BD).
 * Al calcular con "Calcular todo": la DEUDA del período es la diferencia guardada del mes anterior
 * si existe factura de ese medidor en ese mes; si no, DEUDA = 0.
 */
function billDifferenceTotalMinusGarden(
  bill: Pick<Bill, 'total_amount' | 'garden_amount'>
): number {
  return (bill.total_amount || 0) - (bill.garden_amount || 0);
}

/**
 * Diferencia a mostrar/persistir: si valor jardín &gt; 0 → 0; si no, usa valor guardado o total − jardín.
 */
function computedDifferenceAmount(
  total_amount: number,
  garden_amount: number,
  storedDifference?: number | null
): number {
  const g = Number(garden_amount ?? 0);
  if (g > 0) {
    return 0;
  }
  if (
    storedDifference != null &&
    !Number.isNaN(Number(storedDifference))
  ) {
    return Number(storedDifference);
  }
  return (Number(total_amount) || 0) - g;
}

/** Para arrastre de deuda: usa columna guardada si existe, si no la fórmula. */
function billDifferenceForDebtCarry(bill: {
  difference_amount?: number | null;
  total_amount?: number | null;
  garden_amount?: number | null;
}): number {
  return computedDifferenceAmount(
    Number(bill.total_amount ?? 0),
    Number(bill.garden_amount ?? 0),
    bill.difference_amount
  );
}

/** Total a pagar = deuda + cobro + multas reuniones + multas mingas + mora (sin jardín). */
function computeBillTotalFromParts(bill: {
  previous_debt: number;
  tariff_total: number;
  fines_reuniones: number;
  fines_mingas: number;
  mora_amount: number;
}): number {
  return (
    (bill.previous_debt || 0) +
    (bill.tariff_total || 0) +
    (bill.fines_reuniones || 0) +
    (bill.fines_mingas || 0) +
    (bill.mora_amount || 0)
  );
}

function mergeEditBillParts(
  editData: Partial<BillRow>,
  bill: BillRow
): {
  previous_debt: number;
  tariff_total: number;
  fines_reuniones: number;
  fines_mingas: number;
  mora_amount: number;
  garden_amount: number;
} {
  return {
    previous_debt: editData.previous_debt ?? bill.previous_debt,
    tariff_total: editData.tariff_total ?? bill.tariff_total,
    fines_reuniones: editData.fines_reuniones ?? bill.fines_reuniones,
    fines_mingas: editData.fines_mingas ?? bill.fines_mingas,
    mora_amount: editData.mora_amount ?? bill.mora_amount,
    garden_amount: editData.garden_amount ?? bill.garden_amount,
  };
}

function totalAndDifferenceFromMergedParts(
  parts: ReturnType<typeof mergeEditBillParts>
): { total_amount: number; difference_amount: number } {
  const total_amount = computeBillTotalFromParts(parts);
  const g = parts.garden_amount || 0;
  const difference_amount =
    g > 0 ? 0 : total_amount - g;
  return { total_amount, difference_amount };
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
  const [importFinesDialogOpen, setImportFinesDialogOpen] = useState(false);
  const [importDebtDialogOpen, setImportDebtDialogOpen] = useState(false);
  const [importBillingSheetDialogOpen, setImportBillingSheetDialogOpen] = useState(false);
  const [meterSearch, setMeterSearch] = useState('');

  // Filtrar facturas por código, ubicación o descripción (misma lógica que Registro de lecturas)
  const filteredBills = React.useMemo(() => {
    if (!meterSearch.trim()) return bills;
    const searchTerm = meterSearch.toLowerCase().trim();
    return bills.filter(bill => {
      const code = (bill.meter_id || '').toLowerCase();
      const location = (bill.meter_location || '').toLowerCase();
      const description = (bill.meter_description || '').toLowerCase();
      return (
        code.includes(searchTerm) ||
        location.includes(searchTerm) ||
        description.includes(searchTerm)
      );
    });
  }, [bills, meterSearch]);

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
        .select('code_meter, location, description, created_at')
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
      const billsToUpdate: Array<{
        id: number;
        garden_amount: number;
        difference_amount: number;
      }> = [];
      let billsData = data || [];
      
      for (const bill of billsData) {
        const gardenAmount = gardenValuesMap.get(bill.meter_id) || 0;
        if (bill.garden_amount !== gardenAmount) {
          const totalAmt = Number(bill.total_amount) || 0;
          billsToUpdate.push({
            id: bill.id,
            garden_amount: gardenAmount,
            difference_amount: computedDifferenceAmount(
              totalAmt,
              gardenAmount,
              null
            ),
          });
        }
      }

      // Actualizar en batch si hay cambios
      if (billsToUpdate.length > 0) {
        for (const update of billsToUpdate) {
          await supabase
            .from('bills')
            .update({
              garden_amount: update.garden_amount,
              difference_amount: update.difference_amount,
            })
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

      // Obtener IDs de medidores activos para filtrar
      const activeMeterIds = new Set(meters.map(m => m.code_meter));
      
      // Filtrar bills para mostrar solo los de medidores activos
      const activeBills = billsData.filter(bill => activeMeterIds.has(bill.meter_id));

      const prevPeriodLabel = getPreviousPeriod(selectedPeriod);
      let previousPeriodTotalByMeter = new Map<string, number>();
      if (prevPeriodLabel) {
        const { data: prevBillsRows } = await supabase
          .from('bills')
          .select('meter_id, total_amount')
          .eq('period', prevPeriodLabel);
        previousPeriodTotalByMeter = new Map(
          (prevBillsRows || []).map((row) => [
            row.meter_id,
            Number(row.total_amount) || 0,
          ])
        );
      }

      // Enriquecer con datos del medidor y jardín desde garden_values.
      // Diferencia: mostrar la persistida en BD si existe; si no, total − jardín (igual que sin importar).
      const enrichedBills = activeBills.map(bill => {
        const meter = meters.find(m => m.code_meter === bill.meter_id);
        const gardenAmount = gardenValuesMap.get(bill.meter_id) ?? bill.garden_amount ?? 0;
        const totalAmt = Number(bill.total_amount) || 0;
        return {
          ...bill,
          garden_amount: gardenAmount,
          difference_amount: billDifferenceForDebtCarry({
            difference_amount: bill.difference_amount,
            total_amount: totalAmt,
            garden_amount: gardenAmount,
          }),
          previous_period_total: previousPeriodTotalByMeter.has(bill.meter_id)
            ? previousPeriodTotalByMeter.get(bill.meter_id) ?? null
            : null,
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
      
      if (meters.length === 0) {
        showSnackbar('No hay medidores disponibles', 'warning');
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

      // Obtener período anterior
      const previousPeriod = getPreviousPeriod(selectedPeriod);

      // Obtener tarifas UNA VEZ antes del loop (evitar N+1 queries)
      const { data: tariffsData, error: tariffsError } = await supabase
        .from('tariffs')
        .select('*')
        .eq('status', 'active')
        .order('order_index', { ascending: true });

      if (tariffsError) {
        console.error('Error fetching tariffs:', tariffsError);
        throw tariffsError;
      }

      const tariffs = tariffsData || [];

      // Obtener TODAS las lecturas de una vez (para todos los medidores)
      const { data: allReadingsData } = await supabase
        .from('readings')
        .select('id, meter_id, value, period')
        .order('id', { ascending: false });

      const allReadings = allReadingsData || [];

      // Mapeo de meses para ordenar períodos
      const meses: Record<string, number> = {
        'ENERO': 1, 'FEBRERO': 2, 'MARZO': 3, 'ABRIL': 4, 'MAYO': 5, 'JUNIO': 6,
        'JULIO': 7, 'AGOSTO': 8, 'SEPTIEMBRE': 9, 'OCTUBRE': 10, 'NOVIEMBRE': 11, 'DICIEMBRE': 12
      };

      // Función helper para comparar períodos
      // Retorna: -1 si period1 < period2, 0 si son iguales, 1 si period1 > period2
      const comparePeriods = (period1: string, period2: string): number => {
        const [mes1, año1] = period1.split(' ');
        const [mes2, año2] = period2.split(' ');
        const numMes1 = meses[mes1] || 0;
        const numMes2 = meses[mes2] || 0;
        const numAño1 = parseInt(año1) || 0;
        const numAño2 = parseInt(año2) || 0;
        
        if (numAño1 < numAño2) return -1;
        if (numAño1 > numAño2) return 1;
        if (numMes1 < numMes2) return -1;
        if (numMes1 > numMes2) return 1;
        return 0;
      };

      // Función helper para obtener la última lectura anterior a un período
      const getLastReadingBeforePeriod = (meterId: string, period: string): number | null => {
        const meterReadings = allReadings
          .filter(r => r.meter_id === meterId)
          .sort((a, b) => {
            const [mesA, añoA] = a.period.split(' ');
            const [mesB, añoB] = b.period.split(' ');
            const numMesA = meses[mesA] || 0;
            const numMesB = meses[mesB] || 0;
            const numAñoA = parseInt(añoA) || 0;
            const numAñoB = parseInt(añoB) || 0;
            
            if (numAñoA !== numAñoB) {
              return numAñoB - numAñoA;
            }
            return numMesB - numMesA;
          })
          .filter(r => {
            // Filtrar lecturas anteriores al período actual
            const [mesR, añoR] = r.period.split(' ');
            const [mesP, añoP] = period.split(' ');
            const numMesR = meses[mesR] || 0;
            const numMesP = meses[mesP] || 0;
            const numAñoR = parseInt(añoR) || 0;
            const numAñoP = parseInt(añoP) || 0;
            
            if (numAñoR < numAñoP) return true;
            if (numAñoR === numAñoP && numMesR < numMesP) return true;
            return false;
          });

        return meterReadings.length > 0 ? meterReadings[0].value : null;
      };

      // Obtener TODOS los datos necesarios en batch (una sola consulta por tabla)
      const meterIds = meters.map(m => m.code_meter);

      // Consulta batch: bills del período anterior (necesitamos total_amount y garden_amount para calcular diferencia)
      const { data: previousBillsData } = previousPeriod
        ? await supabase
            .from('bills')
            .select('meter_id, total_amount, garden_amount, difference_amount')
            .eq('period', previousPeriod)
            .in('meter_id', meterIds)
        : { data: [] };

      // Mapa: diferencia del mes anterior (columna persistida o fórmula)
      const previousBillsDifferenceMap = new Map(
        (previousBillsData || []).map(bill => [
          bill.meter_id,
          billDifferenceForDebtCarry(bill),
        ])
      );

      // Consulta batch: multas y costo reconexión del período actual
      const { data: finesDataAll } = await supabase
        .from('meter_fines')
        .select('meter_id, fines_reuniones, fines_mingas, mora_percentage, mora_amount')
        .eq('period', selectedPeriod)
        .in('meter_id', meterIds);

      const finesMap = new Map(
        (finesDataAll || []).map(fine => [fine.meter_id, fine])
      );

      // Consulta batch: valores de jardín del período actual
      const { data: gardenDataAll } = await supabase
        .from('garden_values')
        .select('meter_id, amount')
        .eq('period', selectedPeriod)
        .in('meter_id', meterIds);

      const gardenMap = new Map(
        (gardenDataAll || []).map(garden => [garden.meter_id, garden.amount || 0])
      );

      const newBills: BillRow[] = [];

      // Iterar sobre TODOS los medidores activos (no solo los que tienen lectura)
      for (const meter of meters) {
        try {
          // Obtener período de creación del medidor
          const meterCreationPeriod = meter.created_at 
            ? getPeriodFromDate(new Date(meter.created_at))
            : null;
          
          // Si el período seleccionado es anterior al de creación, saltar este medidor
          if (meterCreationPeriod && comparePeriods(selectedPeriod, meterCreationPeriod) < 0) {
            console.log(`Medidor ${meter.code_meter} creado en ${meterCreationPeriod}, omitiendo facturación para ${selectedPeriod}`);
            continue; // No facturar este medidor
          }
          
          // Verificar si el medidor se creó en el mismo período
          const isCreatedInSamePeriod = meterCreationPeriod && 
            comparePeriods(selectedPeriod, meterCreationPeriod) === 0;
          
          // Buscar si tiene lectura en el período seleccionado
          const readingForPeriod = allReadings.find(r => 
            r.meter_id === meter.code_meter && r.period === selectedPeriod
          );
          
          let currentReading: number;
          let previousReading: number | null = null;
          let consumption = 0;

          if (readingForPeriod) {
            currentReading = readingForPeriod.value;
            
            // Si el medidor se creó en el mismo período, lectura anterior = 0
            if (isCreatedInSamePeriod) {
              previousReading = 0;
              consumption = currentReading; // Consumo total desde cero
            } else {
              // Lógica normal: buscar lectura anterior
              const meterReadings = allReadings
                .filter(r => r.meter_id === meter.code_meter)
                .sort((a, b) => {
                  const [mesA, añoA] = a.period.split(' ');
                  const [mesB, añoB] = b.period.split(' ');
                  const numMesA = meses[mesA] || 0;
                  const numMesB = meses[mesB] || 0;
                  const numAñoA = parseInt(añoA) || 0;
                  const numAñoB = parseInt(añoB) || 0;
                  
                  if (numAñoA !== numAñoB) {
                    return numAñoB - numAñoA;
                  }
                  return numMesB - numMesA;
                });

              const currentIndex = meterReadings.findIndex(r => r.period === selectedPeriod);
              const previousReadingData = currentIndex < meterReadings.length - 1 
                ? meterReadings[currentIndex + 1] 
                : null;

              previousReading = previousReadingData?.value || null;
              consumption = previousReading !== null 
                ? Math.max(0, currentReading - previousReading) 
                : 0;
            }
          } else {
            // Si NO tiene lectura en el período actual
            if (isCreatedInSamePeriod) {
              // Medidor creado en este período pero sin lectura: usar 0
              currentReading = 0;
              previousReading = 0;
              consumption = 0;
            } else {
              // Lógica normal: usar última lectura anterior
              const lastReading = getLastReadingBeforePeriod(meter.code_meter, selectedPeriod);
              if (lastReading !== null) {
                currentReading = lastReading;
                previousReading = lastReading;
                consumption = 0; // No hay consumo porque la lectura no cambió
              } else {
                // Si no hay ninguna lectura anterior, usar 0
                currentReading = 0;
                previousReading = null;
                consumption = 0;
              }
            }
          }

          // Calcular tarifas (usar tarifas ya cargadas, sin consultar BD)
          const billingCalc = calculateBillingWithTariffs(consumption, tariffs);
          
          // DEUDA = diferencia (columna persistida) del mes anterior si hay factura de ese mes; si no, 0.
          const previousDebt = previousBillsDifferenceMap.has(meter.code_meter)
            ? previousBillsDifferenceMap.get(meter.code_meter) ?? 0
            : 0;

          // Obtener multas y costo reconexión desde el mapa (ya cargado en batch)
          const finesData = finesMap.get(meter.code_meter);
          const finesReuniones = finesData?.fines_reuniones || 0;
          const finesMingas = finesData?.fines_mingas || 0;
          const moraAmount = finesData?.mora_amount || (previousDebt * (finesData?.mora_percentage || 0) / 100);

          // Obtener valor de jardín desde el mapa (ya cargado en batch)
          const gardenAmount = gardenMap.get(meter.code_meter) || 0;

          // Calcular total (según fórmula: DEUDA + COBRO + MULTAS_REUNIONES + MULTAS_MINGAS + COSTO_RECONEXION)
          // NO incluye VALOR_JARDIN
          const totalAmount = 
            previousDebt +
            billingCalc.tariff_total +
            finesReuniones +
            finesMingas +
            moraAmount;

          const existingBill = existingBillsMap.get(meter.code_meter);

          newBills.push({
            id: existingBill?.id, // Preservar id si existe
            meter_id: meter.code_meter,
            period: selectedPeriod,
            previous_reading: previousReading,
            current_reading: currentReading,
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
            garden_amount: gardenAmount,
            total_amount: totalAmount,
            difference_amount: computedDifferenceAmount(
              totalAmount,
              gardenAmount,
              null
            ),
            payment_status: existingBill?.payment_status || 'PENDIENTE', // Preservar estado de pago
            observations: existingBill?.observations || undefined, // Preservar observaciones
            meter_name: meter.code_meter,
            meter_description: meter.description || '', // Apellidos y Nombres
            meter_location: meter.location || '',
          });
        } catch (error: any) {
          console.error(`Error processing meter ${meter.code_meter}:`, error);
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

      const rowBill = bills.find((b) => b.meter_id === editingRow);
      if (!rowBill) {
        showSnackbar('No se encontró la factura en edición', 'error');
        return;
      }

      const billData = {
        meter_id: editingRow,
        period: selectedPeriod,
        previous_reading: editData.previous_reading ?? null,
        current_reading: editData.current_reading ?? 0,
        consumption: editData.consumption ?? 0,
        base_amount: editData.base_amount ?? 0,
        range_16_20_amount: editData.range_16_20_amount ?? 0,
        range_21_25_amount: editData.range_21_25_amount ?? 0,
        range_26_plus_amount: editData.range_26_plus_amount ?? 0,
        tariff_total: editData.tariff_total ?? 0,
        previous_debt: editData.previous_debt ?? 0,
        fines_reuniones: editData.fines_reuniones ?? 0,
        fines_mingas: editData.fines_mingas ?? 0,
        mora_amount: editData.mora_amount ?? 0,
        garden_amount: editData.garden_amount ?? 0,
        payment_status: editData.payment_status || 'PENDIENTE',
        observations: editData.observations ?? null,
      };

      const parts = mergeEditBillParts(editData, rowBill);
      const { total_amount: totalFromParts, difference_amount: diffFromParts } =
        totalAndDifferenceFromMergedParts(parts);

      const total =
        editData.total_amount !== undefined && editData.total_amount !== null
          ? Number(editData.total_amount)
          : totalFromParts;
      const gardenForDiff = editData.garden_amount ?? rowBill.garden_amount ?? 0;
      const difference_amount =
        gardenForDiff > 0
          ? 0
          : editData.difference_amount !== undefined && editData.difference_amount !== null
            ? Number(editData.difference_amount)
            : diffFromParts;

      const billDataWithDiff = {
        ...billData,
        total_amount: total,
        difference_amount,
      };

      // Verificar si existe
      const existingBill = bills.find(b => b.meter_id === editingRow && b.id);
      
      if (existingBill?.id) {
        const { error } = await supabase
          .from('bills')
          .update(billDataWithDiff)
          .eq('id', existingBill.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('bills')
          .insert([billDataWithDiff]);

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
      
      // Validar todos los medidores de una vez (batch query)
      const meterIds = [...new Set(bills.map(b => b.meter_id))];
      const { data: allMetersData, error: metersError } = await supabase
        .from('meters')
        .select('code_meter, status')
        .in('code_meter', meterIds);

      if (metersError) {
        console.error('Error validating meters:', metersError);
        showSnackbar('Error al validar medidores', 'error');
        return;
      }

      const validMetersSet = new Set((allMetersData || []).map(m => m.code_meter));
      const inactiveMeters = (allMetersData || [])
        .filter(m => m.status !== 'active')
        .map(m => m.code_meter);

      if (inactiveMeters.length > 0) {
        console.warn(`Medidores inactivos encontrados: ${inactiveMeters.join(', ')}`);
      }

      // Filtrar facturas con medidores válidos
      const validBills = bills.filter(bill => {
        if (!validMetersSet.has(bill.meter_id)) {
          console.error(`Meter ${bill.meter_id} no existe en la tabla meters`);
          return false;
        }
        return true;
      });

      if (validBills.length === 0) {
        showSnackbar('No hay facturas válidas para guardar', 'warning');
        return;
      }

      // Preparar todos los datos para upsert en batch
      // IMPORTANTE: NO incluir 'id' en el objeto de datos para evitar errores de constraint
      // Usaremos onConflict para que Supabase maneje los updates automáticamente
      const billsData = validBills.map(bill => ({
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
        difference_amount: computedDifferenceAmount(
          bill.total_amount,
          bill.garden_amount ?? 0,
          bill.difference_amount
        ),
        payment_status: bill.payment_status,
        observations: bill.observations || null,
        // NO incluir 'id' aquí - Supabase lo manejará automáticamente con onConflict
      }));

      // Usar upsert en batch (una sola operación para todas las facturas)
      // onConflict usa 'meter_id,period' como clave única para actualizar registros existentes
      const { data: upsertedData, error: upsertError } = await supabase
        .from('bills')
        .upsert(billsData, {
          onConflict: 'meter_id,period'
        })
        .select();

      if (upsertError) {
        console.error('Error upserting bills:', upsertError);
        console.error('Error details:', {
          message: upsertError.message,
          details: upsertError.details,
          hint: upsertError.hint,
          code: upsertError.code
        });
        showSnackbar(
          `Error al guardar facturas: ${upsertError.message || 'Error desconocido'}`,
          'error'
        );
        return;
      }

      const saved = upsertedData?.length || 0;
      const errors = validBills.length - saved;
      const skipped = bills.length - validBills.length;

      let message = `Se guardaron ${saved} facturas`;
      if (errors > 0) {
        message += `. ${errors} error(es)`;
      }
      if (skipped > 0) {
        message += `. ${skipped} factura(s) omitida(s) por medidores inválidos`;
      }

      showSnackbar(message, errors > 0 ? 'warning' : 'success');
      fetchBills();
    } catch (error: any) {
      console.error('Error saving all bills:', error);
      showSnackbar('Error al guardar facturas', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    const exportData = filteredBills.map(bill => {
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
        'TOTAL A PAGAR DEL MES ANTERIOR':
          bill.previous_period_total != null
            ? bill.previous_period_total.toFixed(2)
            : '—',
        'COBRO OCTUBRE': bill.tariff_total.toFixed(2),
        'MULTAS REUNIONES': bill.fines_reuniones.toFixed(2),
        'MULTAS MINGAS': bill.fines_mingas.toFixed(2),
        'COSTO RECONEXIÓN': bill.mora_amount.toFixed(2),
        'TOTAL A PAGAR': bill.total_amount.toFixed(2),
        'CONCEPTO': bill.payment_status,
        'VALOR JARDIN': bill.garden_amount.toFixed(2),
        'DIFERENCIA': billDifferenceForDebtCarry(bill).toFixed(2),
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
      { wch: 22 }, // TOTAL A PAGAR DEL MES ANTERIOR
      { wch: 15 }, // COBRO
      { wch: 15 }, // MULTAS REUNIONES
      { wch: 15 }, // MULTAS MINGAS
      { wch: 15 }, // COSTO RECONEXIÓN
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

  const handleImportBillingFromExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!selectedPeriod) {
      showSnackbar('Selecciona un período antes de importar', 'warning');
      return;
    }

    try {
      setLoading(true);
      const data = await file.arrayBuffer();
      const nameLower = file.name.toLowerCase();
      const isTextSheet =
        nameLower.endsWith('.txt') ||
        nameLower.endsWith('.tsv') ||
        file.type === 'text/plain' ||
        file.type === 'text/tab-separated-values';

      let jsonData: unknown[][];
      if (isTextSheet) {
        const text = new TextDecoder('utf-8', { fatal: false }).decode(data);
        jsonData = parseTabSeparatedSheet(text);
      } else {
        const workbook = XLSX.read(data);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
      }

      let headerRowIndex = -1;
      for (let i = 0; i < Math.min(25, jsonData.length); i++) {
        const row = jsonData[i];
        if (!Array.isArray(row)) continue;
        const norms = row.map((c) => normHeaderCell(c));
        const hasCod = norms.some(
          (n) => n === 'cod' || /^cod\s/.test(n) || n.includes('codigo')
        );
        const hasLectura = norms.some((n) => n.includes('lectura'));
        const hasConsumo = norms.some((n) => n.includes('consumo'));
        if (hasCod && (hasLectura || hasConsumo)) {
          headerRowIndex = i;
          break;
        }
      }

      if (headerRowIndex === -1) {
        throw new Error(
          'No se encontró la fila de encabezados (se espera algo como la exportación: COD, lecturas, consumo).'
        );
      }

      const headers = jsonData[headerRowIndex] as unknown[];
      const idxCod = findColIndex(
        headers,
        (n) => n === 'cod' || /^cod\s/.test(n) || (n.includes('codigo') && !n.includes('recaud'))
      );
      if (idxCod === -1) {
        throw new Error('No se encontró la columna COD');
      }

      const idxLectAnt = findColIndex(headers, (n) => n.includes('lectura anterior'));
      const idxLectAct = findColIndex(headers, (n) => n.includes('lectura actual'));
      const idxConsumo = findColIndex(
        headers,
        (n) => n.includes('total consumo') || (n.includes('consumo') && !n.includes('lectura'))
      );
      const idxBase = findColIndex(headers, (n) => n === 'base');
      const idxR16 = findColIndex(
        headers,
        (n) =>
          (n.includes('16') && n.includes('20') && !n.includes('25')) ||
          n === '16-20'
      );
      const idxR21 = findColIndex(
        headers,
        (n) =>
          (n.includes('20') && n.includes('25')) ||
          (n.includes('21') && n.includes('25')) ||
          n === '20-25'
      );
      const idxR26 = findColIndex(
        headers,
        (n) =>
          (n.includes('26') && (n.includes('100') || n.includes('+'))) || n.includes('26-100')
      );
      const idxDeuda = findColIndex(headers, (n) => n === 'deuda');
      const idxCobro = findColIndex(
        headers,
        (n) => n.startsWith('cobro') || (n.includes('cobro') && !n.includes('total a pagar'))
      );
      const idxMulReu = findColIndex(
        headers,
        (n) => n.includes('multas') && n.includes('reunion')
      );
      const idxMulMin = findColIndex(
        headers,
        (n) => n.includes('multas') && n.includes('minga')
      );
      const idxMora = findColIndex(
        headers,
        (n) =>
          n === 'mora' ||
          n.includes('costo reconexion') ||
          n.includes('reconexion')
      );
      const idxTotal = findColIndex(headers, (n) => n.includes('total a pagar'));
      const idxConcepto = findColIndex(headers, (n) => n.includes('concepto'));
      const idxJardin = findColIndex(
        headers,
        (n) => n.includes('valor') && n.includes('jardin')
      );
      const idxDif = findColIndex(headers, (n) => n.includes('diferencia'));
      const idxObs = findColIndex(headers, (n) => n.includes('observacion'));

      const { data: meterRows, error: metersFetchError } = await supabase
        .from('meters')
        .select('code_meter')
        .eq('status', 'active');
      if (metersFetchError) throw metersFetchError;
      const validMeters = new Set((meterRows || []).map((m) => m.code_meter));
      type BillingExcelUpsertRow = {
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
        difference_amount: number;
        payment_status: string;
        payment_date: string | null;
        observations: string | null;
      };

      const byMeter = new Map<string, BillingExcelUpsertRow>();

      let skippedEmpty = 0;
      let skippedInvalidMeter = 0;

      for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!Array.isArray(row)) {
          skippedEmpty++;
          continue;
        }
        const codRaw = row[idxCod];
        const meter_id =
          codRaw !== undefined && codRaw !== null && codRaw !== ''
            ? String(codRaw).trim()
            : '';
        if (!meter_id) {
          skippedEmpty++;
          continue;
        }
        if (!validMeters.has(meter_id)) {
          skippedInvalidMeter++;
          continue;
        }

        const cell = (idx: number) => (idx >= 0 ? row[idx] : undefined);
        const previous_reading =
          idxLectAnt >= 0 ? parseExcelNumberOrNull(cell(idxLectAnt)) : null;
        const current_reading = idxLectAct >= 0 ? parseExcelNumber(cell(idxLectAct)) : 0;
        const consumption = idxConsumo >= 0 ? parseExcelNumber(cell(idxConsumo)) : 0;
        const base_amount = idxBase >= 0 ? parseExcelNumber(cell(idxBase)) : 0;
        const range_16_20_amount = idxR16 >= 0 ? parseExcelNumber(cell(idxR16)) : 0;
        const range_21_25_amount = idxR21 >= 0 ? parseExcelNumber(cell(idxR21)) : 0;
        const range_26_plus_amount = idxR26 >= 0 ? parseExcelNumber(cell(idxR26)) : 0;
        const previous_debt = idxDeuda >= 0 ? parseExcelNumber(cell(idxDeuda)) : 0;
        const tariff_total = idxCobro >= 0 ? parseExcelNumber(cell(idxCobro)) : 0;
        const fines_reuniones = idxMulReu >= 0 ? parseExcelNumber(cell(idxMulReu)) : 0;
        const fines_mingas = idxMulMin >= 0 ? parseExcelNumber(cell(idxMulMin)) : 0;
        const mora_amount = idxMora >= 0 ? parseExcelNumber(cell(idxMora)) : 0;
        const total_amount = idxTotal >= 0 ? parseExcelNumber(cell(idxTotal)) : 0;
        const garden_amount = idxJardin >= 0 ? parseExcelNumber(cell(idxJardin)) : 0;
        const diffParsed =
          idxDif >= 0 ? parseExcelNumberOrNull(cell(idxDif)) : null;
        const difference_amount = computedDifferenceAmount(
          total_amount,
          garden_amount,
          diffParsed !== null ? diffParsed : null
        );

        const rawConcepto =
          idxConcepto >= 0 ? String(cell(idxConcepto) ?? '').trim() : '';
        let payment_status = 'PENDIENTE';
        if (/acredit/i.test(rawConcepto)) payment_status = 'ACREDITADO';
        else if (/pend/i.test(rawConcepto)) payment_status = 'PENDIENTE';
        else if (rawConcepto) payment_status = rawConcepto.slice(0, 20);

        const payment_date =
          payment_status === 'ACREDITADO' ? new Date().toISOString() : null;

        const observations =
          idxObs >= 0
            ? String(cell(idxObs) ?? '').trim() || null
            : null;

        byMeter.set(meter_id, {
          meter_id,
          period: selectedPeriod,
          previous_reading:
            previous_reading !== null ? previous_reading : null,
          current_reading,
          consumption,
          base_amount,
          range_16_20_amount,
          range_21_25_amount,
          range_26_plus_amount,
          tariff_total,
          previous_debt,
          fines_reuniones,
          fines_mingas,
          mora_amount,
          garden_amount,
          total_amount,
          difference_amount,
          payment_status,
          payment_date,
          observations,
        });
      }

      const billsToUpsert = Array.from(byMeter.values());

      if (billsToUpsert.length === 0) {
        throw new Error(
          'No hay filas válidas con COD de medidor existente. Revisa el archivo y el período.'
        );
      }

      const BATCH = 250;
      for (let b = 0; b < billsToUpsert.length; b += BATCH) {
        const chunk = billsToUpsert.slice(b, b + BATCH);
        const { error: upsertError } = await supabase
          .from('bills')
          .upsert(chunk, { onConflict: 'meter_id,period' });

        if (upsertError) {
          console.error('Error upsert bills import Excel:', upsertError);
          throw upsertError;
        }
      }

      const importDate = new Date().toISOString();
      const gardenRows = billsToUpsert.map((row) => ({
        meter_id: row.meter_id,
        period: selectedPeriod,
        amount: row.garden_amount,
        imported_from_excel: true,
        import_date: importDate,
      }));
      for (let b = 0; b < gardenRows.length; b += BATCH) {
        const chunk = gardenRows.slice(b, b + BATCH);
        const { error: gvError } = await supabase
          .from('garden_values')
          .upsert(chunk, { onConflict: 'meter_id,period' });
        if (gvError) {
          console.error('Error upsert garden_values tras import cobro:', gvError);
          throw gvError;
        }
      }

      setImportBillingSheetDialogOpen(false);
      fetchBills();
      const parts = [
        `Importadas ${billsToUpsert.length} factura(s) para ${selectedPeriod}`,
        skippedInvalidMeter > 0
          ? `${skippedInvalidMeter} fila(s) con medidor desconocido`
          : null,
        skippedEmpty > 0 ? `${skippedEmpty} fila(s) vacías omitidas` : null,
      ].filter(Boolean);
      showSnackbar(parts.join('. '), 'success');
    } catch (error: unknown) {
      console.error('Error importando Excel de facturación:', error);
      const msg = error instanceof Error ? error.message : 'Error al importar Excel';
      showSnackbar(msg, 'error');
    } finally {
      setLoading(false);
    }
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
      let skipped = 0;

      // Procesar todas las filas en memoria primero (sin consultas a BD)
      // Crear un mapa con los valores del Excel: meter_id -> amount
      const excelValuesMap = new Map<string, number>();

      const importDate = new Date().toISOString();

      // Procesar filas de datos del Excel
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

        // Guardar en el mapa (si el código ya existe, se sobrescribe con el último valor)
        excelValuesMap.set(meterCode, amount);
      }

      // Validar que todos los medidores del Excel existan en la base de datos
      if (excelValuesMap.size > 0) {
        const excelMeterCodes = Array.from(excelValuesMap.keys());
        const allActiveMeters = meters.map(m => m.code_meter);
        const invalidMeters = excelMeterCodes.filter(code => !allActiveMeters.includes(code));
        
        if (invalidMeters.length > 0) {
          const invalidMetersList = invalidMeters.join(', ');
          throw new Error(
            `Se encontraron ${invalidMeters.length} medidor(es) en el Excel que no existen en la base de datos: ${invalidMetersList}. Por favor, verifica los códigos e intenta nuevamente.`
          );
        }
      }

      // Ahora crear la lista completa de valores para upsert:
      // - Medidores que están en el Excel: usar el valor del Excel
      // - Medidores que NO están en el Excel: establecer valor en 0
      const gardenValuesToUpsert: Array<{
        meter_id: string;
        period: string;
        amount: number;
        imported_from_excel: boolean;
        import_date: string;
      }> = [];

      // Obtener todos los medidores activos para asegurar que todos tengan registro
      const allActiveMeters = meters.map(m => m.code_meter);

      // Procesar todos los medidores activos
      for (const meterId of allActiveMeters) {
        // Si el medidor está en el Excel, usar su valor; si no, usar 0
        const amount = excelValuesMap.has(meterId) ? excelValuesMap.get(meterId)! : 0;
        
        gardenValuesToUpsert.push({
          meter_id: meterId,
          period: selectedPeriod,
          amount: amount,
          imported_from_excel: true,
          import_date: importDate,
        });
      }

      // Hacer upsert batch de todos los valores de jardín de una vez
      if (gardenValuesToUpsert.length > 0) {
        console.log(`Importando ${gardenValuesToUpsert.length} valores de jardín en batch...`);
        
        const { data: upsertedData, error: upsertError } = await supabase
          .from('garden_values')
          .upsert(gardenValuesToUpsert, { 
            onConflict: 'meter_id,period',
            ignoreDuplicates: false 
          })
          .select('meter_id, period, amount');

        if (upsertError) {
          console.error('Error al hacer upsert batch de garden_values:', upsertError);
          throw upsertError;
        }

        imported = upsertedData?.length || 0;
        console.log(`✓ Se importaron ${imported} valores de jardín en batch (incluyendo medidores con valor 0 que no estaban en el Excel)`);
      }

      const importedFromExcel = excelValuesMap.size;
      const setToZero = gardenValuesToUpsert.length - importedFromExcel;
      console.log(`Importación completada: ${importedFromExcel} valores del Excel, ${setToZero} medidores establecidos en 0 (no estaban en el Excel), ${skipped} filas omitidas`);

      const message = `Se importaron ${importedFromExcel} valores del Excel${setToZero > 0 ? ` y se establecieron ${setToZero} medidores en 0 (no estaban en el archivo)` : ''}${skipped > 0 ? `. ${skipped} filas omitidas` : ''}`;
      showSnackbar(
        message,
        'success'
      );
      
      setImportDialogOpen(false);
      
      // PRIMERO: Actualizar TODOS los bills del período a PENDIENTE (para todos los medidores)
      console.log('Actualizando todos los bills del período a PENDIENTE antes de importar jardín...');
      
      const { data: allBillsForPeriod, error: fetchBillsError } = await supabase
        .from('bills')
        .select('id, meter_id')
        .eq('period', selectedPeriod);

      if (fetchBillsError) {
        console.error('Error al obtener bills:', fetchBillsError);
        throw fetchBillsError;
      }

      if (allBillsForPeriod && allBillsForPeriod.length > 0) {
        const allBillIds = allBillsForPeriod.map(b => b.id);
        console.log(`Encontrados ${allBillIds.length} facturas para actualizar a PENDIENTE`);
        
        const { error: updatePendingError } = await supabase
          .from('bills')
          .update({ 
            payment_status: 'PENDIENTE',
            payment_date: null
          })
          .in('id', allBillIds);

        if (updatePendingError) {
          console.error('Error al actualizar bills a PENDIENTE:', updatePendingError);
          throw updatePendingError;
        }
        
        console.log(`✓ Se actualizaron ${allBillIds.length} facturas (todos los medidores) a PENDIENTE`);
      } else {
        console.log('No hay facturas existentes para este período. Se crearán nuevas facturas con estado PENDIENTE.');
      }
      
      // SEGUNDO: Actualizar solo los bills existentes con los nuevos valores de jardín (más eficiente que recalcular todo)
      // Obtener los valores de jardín importados para este período
      const { data: gardenValuesData } = await supabase
        .from('garden_values')
        .select('meter_id, amount')
        .eq('period', selectedPeriod);

      if (gardenValuesData && gardenValuesData.length > 0) {
        // Obtener bills existentes del período
        const { data: existingBills } = await supabase
          .from('bills')
          .select(
            'id, meter_id, payment_status, garden_amount, tariff_total, fines_reuniones, fines_mingas, mora_amount'
          )
          .eq('period', selectedPeriod);

        if (existingBills && existingBills.length > 0) {
          const gardenValuesMap = new Map(
            gardenValuesData.map(gv => [gv.meter_id, gv.amount || 0])
          );

          const prevPeriodForDebt = getPreviousPeriod(selectedPeriod);
          const prevTotalsMap = new Map<string, number>();
          if (prevPeriodForDebt) {
            const { data: prevBillsForDebt } = await supabase
              .from('bills')
              .select('meter_id, total_amount')
              .eq('period', prevPeriodForDebt);
            for (const row of prevBillsForDebt || []) {
              prevTotalsMap.set(row.meter_id, Number(row.total_amount) || 0);
            }
          }

          const billsToUpdate: Array<{
            id: number;
            garden_amount: number;
            previous_debt: number;
            total_amount: number;
            payment_status: string;
            payment_date?: string;
          }> = [];
          
          // Identificar bills que necesitan actualización
          for (const bill of existingBills) {
            const newGardenAmount = gardenValuesMap.get(bill.meter_id) || 0;
            const prevTotal = prevTotalsMap.get(bill.meter_id) ?? 0;
            const newPreviousDebt = Math.max(0, prevTotal - newGardenAmount);
            
            // Actualizar todos los bills (ya que todos fueron puestos en PENDIENTE)
            // DEUDA = total a pagar del mes anterior − valor jardín (no negativa)
            // total_amount = previous_debt + tariff_total + fines + mora (jardín no suma al total)
            const newTotalAmount = 
              newPreviousDebt +
              (bill.tariff_total || 0) +
              (bill.fines_reuniones || 0) +
              (bill.fines_mingas || 0) +
              (bill.mora_amount || 0);
            
            const updateData: {
              id: number;
              garden_amount: number;
              previous_debt: number;
              total_amount: number;
              payment_status: string;
              payment_date?: string;
            } = {
              id: bill.id,
              garden_amount: newGardenAmount,
              previous_debt: newPreviousDebt,
              total_amount: newTotalAmount,
              payment_status: newGardenAmount > 0 ? 'ACREDITADO' : 'PENDIENTE',
            };
            
            // Si tiene valor de jardín mayor a 0, agregar payment_date
            if (newGardenAmount > 0) {
              updateData.payment_date = new Date().toISOString();
            }
            
            billsToUpdate.push(updateData);
          }

          // Actualizar en batch todos los bills (en paralelo para mayor velocidad)
          if (billsToUpdate.length > 0) {
            console.log(`Actualizando ${billsToUpdate.length} facturas con nuevos valores de jardín...`);
            
            // Actualizar todos los bills en paralelo usando Promise.all
            const updatePromises = billsToUpdate.map(update =>
              supabase
                .from('bills')
                .update({
                  garden_amount: update.garden_amount,
                  previous_debt: update.previous_debt,
                  total_amount: update.total_amount,
                  difference_amount: computedDifferenceAmount(
                    update.total_amount,
                    update.garden_amount,
                    null
                  ),
                  payment_status: update.payment_status,
                  ...(update.payment_date && { payment_date: update.payment_date }),
                })
                .eq('id', update.id)
            );
            
            const updateResults = await Promise.all(updatePromises);
            
            // Verificar errores
            const errors = updateResults.filter(result => result.error);
            if (errors.length > 0) {
              console.error(`Error al actualizar ${errors.length} facturas:`, errors);
            }
            
            const acreditadosCount = billsToUpdate.filter(b => b.garden_amount > 0).length;
            console.log(`✓ Se actualizaron ${billsToUpdate.length} facturas. ${acreditadosCount} marcadas como ACREDITADO.`);
          }
        }
      }
      
      // Refrescar los bills - fetchBills ahora sincroniza automáticamente garden_amount desde garden_values
      await fetchBills();
    } catch (error: any) {
      console.error('Error importing garden values:', error);
      showSnackbar(error.message || 'Error al importar valores de jardín', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleImportFines = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[];

      // Buscar la fila de encabezados (buscar "Código" o similar)
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
      
      // Buscar columna de valor con múltiples variaciones (multas, reuniones, etc.)
      const valorIndex = headers.findIndex(h => {
        const headerLower = String(h || '').toLowerCase().trim();
        return headerLower.includes('valor') || 
               headerLower.includes('amount') ||
               headerLower.includes('monto') ||
               headerLower.includes('importe') ||
               headerLower.includes('multa') ||
               headerLower.includes('reunión') ||
               headerLower.includes('reunion');
      });

      if (codigoIndex === -1) {
        throw new Error('No se encontró la columna de código. Busque columnas con: Código, Codigo, Code, Medidor, Meter');
      }
      
      if (valorIndex === -1) {
        throw new Error('No se encontró la columna de valor. Busque columnas con: Valor, Amount, Monto, Importe, Multa, Reunión');
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
      let skipped = 0;

      // Procesar todas las filas en memoria primero (sin consultas a BD)
      // Crear un mapa con los valores del Excel: meter_id -> amount
      const excelValuesMap = new Map<string, number>();

      const importDate = new Date().toISOString();

      // Procesar filas de datos del Excel
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

        // Guardar en el mapa (si el código ya existe, se sobrescribe con el último valor)
        excelValuesMap.set(meterCode, amount);
      }

      // Validar que todos los medidores del Excel existan en la base de datos
      if (excelValuesMap.size > 0) {
        const excelMeterCodes = Array.from(excelValuesMap.keys());
        const allActiveMeters = meters.map(m => m.code_meter);
        const invalidMeters = excelMeterCodes.filter(code => !allActiveMeters.includes(code));
        
        if (invalidMeters.length > 0) {
          const invalidMetersList = invalidMeters.join(', ');
          throw new Error(
            `Se encontraron ${invalidMeters.length} medidor(es) en el Excel que no existen en la base de datos: ${invalidMetersList}. Por favor, verifica los códigos e intenta nuevamente.`
          );
        }
      }

      // Obtener todos los medidores activos para asegurar que todos tengan registro
      const allActiveMeters = meters.map(m => m.code_meter);

      // Obtener multas existentes del período para preservar otros campos
      const { data: existingFines } = await supabase
        .from('meter_fines')
        .select('meter_id, fines_mingas, mora_percentage, mora_amount')
        .eq('period', selectedPeriod)
        .in('meter_id', allActiveMeters);

      const existingFinesMap = new Map(
        (existingFines || []).map(fine => [fine.meter_id, fine])
      );

      // Crear la lista completa de multas para upsert
      const finesToUpsert: Array<{
        meter_id: string;
        period: string;
        fines_reuniones: number;
        fines_mingas?: number;
        mora_percentage?: number;
        mora_amount?: number;
      }> = [];

      // Procesar todos los medidores activos
      for (const meterId of allActiveMeters) {
        // Si el medidor está en el Excel, usar su valor; si no, usar 0
        const finesReuniones = excelValuesMap.has(meterId) ? excelValuesMap.get(meterId)! : 0;
        
        // Preservar otros campos si existen
        const existingFine = existingFinesMap.get(meterId);
        
        finesToUpsert.push({
          meter_id: meterId,
          period: selectedPeriod,
          fines_reuniones: finesReuniones,
          fines_mingas: existingFine?.fines_mingas || 0,
          mora_percentage: existingFine?.mora_percentage || 0,
          mora_amount: existingFine?.mora_amount || 0,
        });
      }

      // Hacer upsert batch de todas las multas de una vez
      if (finesToUpsert.length > 0) {
        console.log(`Importando ${finesToUpsert.length} multas de reuniones en batch...`);
        
        const { data: upsertedData, error: upsertError } = await supabase
          .from('meter_fines')
          .upsert(finesToUpsert, { 
            onConflict: 'meter_id,period',
            ignoreDuplicates: false 
          })
          .select('meter_id, period, fines_reuniones');

        if (upsertError) {
          console.error('Error al hacer upsert batch de meter_fines:', upsertError);
          throw upsertError;
        }

        imported = upsertedData?.length || 0;
        console.log(`✓ Se importaron ${imported} multas de reuniones en batch (incluyendo medidores con valor 0 que no estaban en el Excel)`);
      }

      const importedFromExcel = excelValuesMap.size;
      const setToZero = finesToUpsert.length - importedFromExcel;
      console.log(`Importación completada: ${importedFromExcel} valores del Excel, ${setToZero} medidores establecidos en 0 (no estaban en el Excel), ${skipped} filas omitidas`);

      const message = `Se importaron ${importedFromExcel} multas de reuniones del Excel${setToZero > 0 ? ` y se establecieron ${setToZero} medidores en 0 (no estaban en el archivo)` : ''}${skipped > 0 ? `. ${skipped} filas omitidas` : ''}`;
      showSnackbar(
        message,
        'success'
      );
      
      setImportFinesDialogOpen(false);
      
      // Actualizar solo los bills existentes con los nuevos valores de multas (más eficiente que recalcular todo)
      // Obtener las multas importadas para este período
      const { data: finesData } = await supabase
        .from('meter_fines')
        .select('meter_id, fines_reuniones, fines_mingas, mora_amount')
        .eq('period', selectedPeriod);

      if (finesData && finesData.length > 0) {
        // Obtener bills existentes del período
        const { data: existingBills } = await supabase
          .from('bills')
          .select(
            'id, meter_id, fines_reuniones, previous_debt, tariff_total, fines_mingas, mora_amount, garden_amount'
          )
          .eq('period', selectedPeriod);

        if (existingBills && existingBills.length > 0) {
          const finesMap = new Map(
            finesData.map(fine => [fine.meter_id, fine])
          );

          const billsToUpdate: Array<{
            id: number;
            fines_reuniones: number;
            fines_mingas: number;
            mora_amount: number;
            total_amount: number;
            difference_amount: number;
          }> = [];
          
          // Identificar bills que necesitan actualización
          for (const bill of existingBills) {
            const fineData = finesMap.get(bill.meter_id);
            const newFinesReuniones = fineData?.fines_reuniones || 0;
            const newFinesMingas = fineData?.fines_mingas || 0;
            const newMoraAmount = fineData?.mora_amount || 0;
            
            const oldFinesReuniones = bill.fines_reuniones || 0;
            const oldFinesMingas = bill.fines_mingas || 0;
            const oldMoraAmount = bill.mora_amount || 0;
            
            // Solo actualizar si algún valor cambió
            if (newFinesReuniones !== oldFinesReuniones || 
                newFinesMingas !== oldFinesMingas || 
                newMoraAmount !== oldMoraAmount) {
              // Recalcular total_amount: previous_debt + tariff_total + fines_reuniones + fines_mingas + costo_reconexion
              const newTotalAmount = 
                (bill.previous_debt || 0) +
                (bill.tariff_total || 0) +
                newFinesReuniones +
                newFinesMingas +
                newMoraAmount;
              
              billsToUpdate.push({
                id: bill.id,
                fines_reuniones: newFinesReuniones,
                fines_mingas: newFinesMingas,
                mora_amount: newMoraAmount,
                total_amount: newTotalAmount,
                difference_amount: computedDifferenceAmount(
                  newTotalAmount,
                  bill.garden_amount || 0,
                  null
                ),
              });
            }
          }

          // Actualizar en batch todos los bills afectados (en paralelo para mayor velocidad)
          if (billsToUpdate.length > 0) {
            console.log(`Actualizando ${billsToUpdate.length} facturas con nuevos valores de multas...`);
            
            // Actualizar todos los bills en paralelo usando Promise.all
            const updatePromises = billsToUpdate.map(update =>
              supabase
                .from('bills')
                .update({
                  fines_reuniones: update.fines_reuniones,
                  fines_mingas: update.fines_mingas,
                  mora_amount: update.mora_amount,
                  total_amount: update.total_amount,
                  difference_amount: update.difference_amount,
                })
                .eq('id', update.id)
            );
            
            const updateResults = await Promise.all(updatePromises);
            
            // Verificar errores
            const errors = updateResults.filter(result => result.error);
            if (errors.length > 0) {
              console.error(`Error al actualizar ${errors.length} facturas:`, errors);
            }
            
            console.log(`✓ Se actualizaron ${billsToUpdate.length} facturas con nuevos valores de multas.`);
          }
        }
      }
      
      // Refrescar los bills
      await fetchBills();
    } catch (error: any) {
      console.error('Error importing fines:', error);
      showSnackbar(error.message || 'Error al importar multas de reuniones', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleImportDebt = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);

      if (!selectedPeriod) {
        throw new Error('No hay período seleccionado. Por favor, selecciona un período antes de importar.');
      }

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[];

      let headerRowIndex = -1;
      for (let i = 0; i < Math.min(10, jsonData.length); i++) {
        const row = jsonData[i];
        if (
          Array.isArray(row) &&
          row.some((cell: any) =>
            String(cell).toLowerCase().includes('código') || String(cell).toLowerCase().includes('codigo')
          )
        ) {
          headerRowIndex = i;
          break;
        }
      }

      if (headerRowIndex === -1) {
        throw new Error('No se encontró la fila de encabezados');
      }

      const headers = jsonData[headerRowIndex] as string[];

      const codigoIndex = headers.findIndex(h => {
        const headerLower = String(h || '').toLowerCase().trim();
        return (
          headerLower.includes('código') ||
          headerLower.includes('codigo') ||
          headerLower.includes('code') ||
          headerLower.includes('medidor') ||
          headerLower.includes('meter')
        );
      });

      const valorIndex = headers.findIndex(h => {
        const headerLower = String(h || '').toLowerCase().trim();
        return (
          headerLower.includes('deuda') ||
          headerLower.includes('saldo') ||
          headerLower.includes('adeudado') ||
          headerLower.includes('valor') ||
          headerLower.includes('amount') ||
          headerLower.includes('monto') ||
          headerLower.includes('importe') ||
          headerLower.includes('multa') ||
          headerLower.includes('reunión') ||
          headerLower.includes('reunion')
        );
      });

      if (codigoIndex === -1) {
        throw new Error(
          'No se encontró la columna de código. Busque columnas con: Código, Codigo, Code, Medidor, Meter'
        );
      }

      if (valorIndex === -1) {
        throw new Error(
          'No se encontró la columna de valor. Busque columnas con: Deuda, Saldo, Adeudado, Valor, Amount, Monto, Importe'
        );
      }

      let skipped = 0;
      const excelValuesMap = new Map<string, number>();

      for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!Array.isArray(row)) {
          skipped++;
          continue;
        }

        const codigoCell = row[codigoIndex];
        const valorCell = row[valorIndex];

        if (
          (codigoCell === undefined || codigoCell === null || codigoCell === '') &&
          (valorCell === undefined || valorCell === null || valorCell === '')
        ) {
          skipped++;
          continue;
        }

        const meterCode = codigoCell ? String(codigoCell).trim() : '';
        if (!meterCode) {
          skipped++;
          continue;
        }

        let amount: number;
        if (valorCell === undefined || valorCell === null || valorCell === '') {
          amount = 0;
        } else {
          const parsed = parseFloat(String(valorCell));
          amount = isNaN(parsed) ? 0 : parsed;
        }

        excelValuesMap.set(meterCode, amount);
      }

      if (excelValuesMap.size === 0) {
        throw new Error('No se encontraron filas con código y monto de deuda en el archivo.');
      }

      const excelMeterCodes = Array.from(excelValuesMap.keys());
      const allActiveMeters = meters.map(m => m.code_meter);
      const invalidMeters = excelMeterCodes.filter(code => !allActiveMeters.includes(code));

      if (invalidMeters.length > 0) {
        const invalidMetersList = invalidMeters.join(', ');
        throw new Error(
          `Se encontraron ${invalidMeters.length} medidor(es) en el Excel que no existen en la base de datos: ${invalidMetersList}. Por favor, verifica los códigos e intenta nuevamente.`
        );
      }

      // Solo medidores del Excel: punto de partida de deuda para el período seleccionado (no poner en 0 al resto)
      const debtsToUpsert = excelMeterCodes.map(meterId => ({
        meter_id: meterId,
        period: selectedPeriod,
        amount: excelValuesMap.get(meterId)!,
        description: 'Importado desde Excel',
      }));

      const { error: upsertError } = await supabase.from('debts').upsert(debtsToUpsert, {
        onConflict: 'meter_id,period',
        ignoreDuplicates: false,
      });

      if (upsertError) {
        console.error('Error al hacer upsert batch de debts:', upsertError);
        throw upsertError;
      }

      const importedFromExcel = excelValuesMap.size;

      const { data: existingBills } = await supabase
        .from('bills')
        .select(
          'id, meter_id, tariff_total, fines_reuniones, fines_mingas, mora_amount, garden_amount'
        )
        .eq('period', selectedPeriod);

      let billsSynced = 0;
      if (existingBills && existingBills.length > 0) {
        const billsToUpdate = existingBills
          .filter(bill => excelValuesMap.has(bill.meter_id))
          .map(bill => {
            const newPreviousDebt = excelValuesMap.get(bill.meter_id)!;
            const newTotalAmount =
              newPreviousDebt +
              (bill.tariff_total || 0) +
              (bill.fines_reuniones || 0) +
              (bill.fines_mingas || 0) +
              (bill.mora_amount || 0);
            const garden = bill.garden_amount || 0;
            return {
              id: bill.id,
              previous_debt: newPreviousDebt,
              total_amount: newTotalAmount,
              difference_amount: computedDifferenceAmount(
                newTotalAmount,
                garden,
                null
              ),
            };
          });

        if (billsToUpdate.length > 0) {
          const updatePromises = billsToUpdate.map(update =>
            supabase
              .from('bills')
              .update({
                previous_debt: update.previous_debt,
                total_amount: update.total_amount,
                difference_amount: update.difference_amount,
              })
              .eq('id', update.id)
          );

          const updateResults = await Promise.all(updatePromises);
          const errors = updateResults.filter(result => result.error);
          if (errors.length > 0) {
            console.error(`Error al actualizar ${errors.length} facturas tras importar deuda:`, errors);
          }
          billsSynced = billsToUpdate.length;
        }
      }

      setImportDebtDialogOpen(false);

      const skippedMsg = skipped > 0 ? ` ${skipped} filas omitidas.` : '';
      if (!existingBills || existingBills.length === 0) {
        showSnackbar(
          `Punto de partida de deuda guardado para ${importedFromExcel} medidor(es) (${selectedPeriod}). Calcula o guarda facturas para ver la columna DEUDA.${skippedMsg}`,
          'info'
        );
      } else if (billsSynced > 0) {
        showSnackbar(
          `Punto de partida de deuda (${selectedPeriod}): ${importedFromExcel} medidor(es) en registro de deudas. ${billsSynced} factura(s) actualizada(s).${skippedMsg}`,
          'success'
        );
      } else {
        showSnackbar(
          `Punto de partida de deuda guardado para ${importedFromExcel} medidor(es) (${selectedPeriod}). No había facturas en este período para esos medidores.${skippedMsg}`,
          'success'
        );
      }

      await fetchBills();
    } catch (error: any) {
      console.error('Error importing debt:', error);
      showSnackbar(error.message || 'Error al importar deudas', 'error');
    } finally {
      setLoading(false);
      event.target.value = '';
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
            variant="outlined"
            startIcon={<UploadIcon />}
            onClick={() => setImportFinesDialogOpen(true)}
          >
            Importar Multas Reuniones
          </Button>
          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            onClick={() => setImportDebtDialogOpen(true)}
            disabled={!selectedPeriod}
          >
            Importar deuda
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
            disabled={filteredBills.length === 0}
          >
            Exportar Excel
          </Button>
          {ENABLE_TEMP_BILLING_IMPORT && (
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<UploadIcon />}
              onClick={() => setImportBillingSheetDialogOpen(true)}
              disabled={!selectedPeriod || loading}
            >
              Importar cobro (Excel/TXT)
            </Button>
          )}
        </Box>
      </Box>

      {bills.length === 0 && !loading && (
        <Alert severity="info" sx={{ mb: 2 }}>
          No hay facturas calculadas para este período. Haz clic en "Calcular Todo" para generar las facturas.
        </Alert>
      )}

      {/* Buscador de medidor (misma lógica que Registro de lecturas) */}
      {bills.length > 0 && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
            <TextField
              label="Buscar Medidor"
              value={meterSearch}
              onChange={(e) => setMeterSearch(e.target.value)}
              placeholder="Buscar por código, ubicación o nombres"
              sx={{ minWidth: 280 }}
              size="small"
            />
            <Button
              variant="outlined"
              onClick={() => setMeterSearch('')}
              disabled={!meterSearch.trim()}
            >
              Limpiar filtros
            </Button>
            <Typography variant="body2" color="text.secondary">
              Total de registros: {filteredBills.length}
            </Typography>
          </Box>
        </Paper>
      )}

      {loading && (
        <Box display="flex" justifyContent="center" p={3}>
          <CircularProgress />
        </Box>
      )}

      {!loading && bills.length > 0 && filteredBills.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Ninguna factura coincide con el criterio de búsqueda. Prueba otro texto o limpia el filtro.
        </Alert>
      )}

      {!loading && bills.length > 0 && filteredBills.length > 0 && (
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
                  <TableCell sx={{ maxWidth: 140, whiteSpace: 'normal', lineHeight: 1.2 }}>
                    TOTAL A PAGAR DEL MES ANTERIOR
                  </TableCell>
                  <TableCell>COBRO</TableCell>
                  <TableCell>MULTAS REUNIONES</TableCell>
                  <TableCell>MULTAS MINGAS</TableCell>
                  <TableCell>COSTO RECONEXIÓN</TableCell>
                  <TableCell>TOTAL A PAGAR</TableCell>
                  <TableCell>CONCEPTO</TableCell>
                  <TableCell>VALOR JARDIN</TableCell>
                  <TableCell>DIFERENCIA</TableCell>
                  <TableCell>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredBills.map((bill) => {
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
                            const parts = mergeEditBillParts(
                              {
                                ...editData,
                                consumption: newConsumption,
                                base_amount: billingCalc.base_amount,
                                range_16_20_amount: billingCalc.range_16_20_amount,
                                range_21_25_amount: billingCalc.range_21_25_amount,
                                range_26_plus_amount: billingCalc.range_26_plus_amount,
                                tariff_total: billingCalc.tariff_total,
                              },
                              bill
                            );
                            const { total_amount, difference_amount } =
                              totalAndDifferenceFromMergedParts(parts);
                            setEditData({
                              ...editData,
                              consumption: newConsumption,
                              base_amount: billingCalc.base_amount,
                              range_16_20_amount: billingCalc.range_16_20_amount,
                              range_21_25_amount: billingCalc.range_21_25_amount,
                              range_26_plus_amount: billingCalc.range_26_plus_amount,
                              tariff_total: billingCalc.tariff_total,
                              total_amount,
                              difference_amount,
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
                            const parts = mergeEditBillParts(
                              { ...editData, previous_debt: newDebt },
                              bill
                            );
                            const { total_amount, difference_amount } =
                              totalAndDifferenceFromMergedParts(parts);
                            setEditData({
                              ...editData,
                              previous_debt: newDebt,
                              total_amount,
                              difference_amount,
                            });
                          }}
                          sx={{ width: 100 }}
                        />
                      ) : (
                        `$${bill.previous_debt.toFixed(2)}`
                      )}
                    </TableCell>
                    <TableCell>
                      {bill.previous_period_total != null
                        ? `$${bill.previous_period_total.toFixed(2)}`
                        : '—'}
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
                            const parts = mergeEditBillParts(
                              { ...editData, fines_reuniones: newFines },
                              bill
                            );
                            const { total_amount, difference_amount } =
                              totalAndDifferenceFromMergedParts(parts);
                            setEditData({
                              ...editData,
                              fines_reuniones: newFines,
                              total_amount,
                              difference_amount,
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
                            const parts = mergeEditBillParts(
                              { ...editData, fines_mingas: newFines },
                              bill
                            );
                            const { total_amount, difference_amount } =
                              totalAndDifferenceFromMergedParts(parts);
                            setEditData({
                              ...editData,
                              fines_mingas: newFines,
                              total_amount,
                              difference_amount,
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
                            const parts = mergeEditBillParts(
                              { ...editData, mora_amount: newMora },
                              bill
                            );
                            const { total_amount, difference_amount } =
                              totalAndDifferenceFromMergedParts(parts);
                            setEditData({
                              ...editData,
                              mora_amount: newMora,
                              total_amount,
                              difference_amount,
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
                            const parts = mergeEditBillParts(
                              { ...editData, garden_amount: newGarden },
                              bill
                            );
                            const { total_amount, difference_amount } =
                              totalAndDifferenceFromMergedParts(parts);
                            setEditData({
                              ...editData,
                              garden_amount: newGarden,
                              total_amount,
                              difference_amount,
                            });
                          }}
                          sx={{ width: 100 }}
                        />
                      ) : (
                        `$${bill.garden_amount.toFixed(2)}`
                      )}
                    </TableCell>
                    <TableCell>
                      {editingRow === bill.meter_id ? (
                        <TextField
                          type="number"
                          size="small"
                          value={
                            editData.difference_amount ??
                            billDifferenceTotalMinusGarden({
                              total_amount: editData.total_amount ?? bill.total_amount,
                              garden_amount: editData.garden_amount ?? bill.garden_amount,
                            })
                          }
                          onChange={(e) => {
                            const newDiff = parseFloat(e.target.value) || 0;
                            const garden = editData.garden_amount ?? bill.garden_amount;
                            setEditData({
                              ...editData,
                              difference_amount: newDiff,
                              total_amount: newDiff + (garden || 0),
                            });
                          }}
                          sx={{ width: 100 }}
                        />
                      ) : (
                        `$${billDifferenceForDebtCarry(bill).toFixed(2)}`
                      )}
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

      {ENABLE_TEMP_BILLING_IMPORT && (
        <Dialog
          open={importBillingSheetDialogOpen}
          onClose={() => setImportBillingSheetDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Importar cobro (Excel o TXT)</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Sube un .xlsx/.xls como &quot;Exportar Excel&quot;, o un .txt/.tsv con columnas separadas por
                tabulador (CODIGO o COD, lecturas, TOTAL CONSUMO, tramos, DEUDA, COBRO, multas, MORA o COSTO
                RECONEXIÓN, TOTAL A PAGAR, CONCEPTO, VALOR JARDIN, DIFERENCIA, etc.). El período guardado es el
                seleccionado arriba: <strong>{selectedPeriod}</strong> (no se usa la columna PERIODO del archivo).
              </Typography>
              <Button variant="outlined" component="label" fullWidth startIcon={<UploadIcon />}>
                Seleccionar archivo
                <input
                  type="file"
                  hidden
                  accept=".xlsx,.xls,.txt,.tsv,text/plain,text/tab-separated-values"
                  onChange={handleImportBillingFromExcel}
                />
              </Button>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setImportBillingSheetDialogOpen(false)}>Cerrar</Button>
          </DialogActions>
        </Dialog>
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

      {/* Dialog para importar multas de reuniones */}
      <Dialog open={importFinesDialogOpen} onClose={() => setImportFinesDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Importar Multas de Reuniones</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Selecciona un archivo Excel con las multas de reuniones. 
              El archivo debe contener columnas: Código y Valor (o Multa/Reunión).
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
                onChange={handleImportFines}
              />
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportFinesDialogOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={importDebtDialogOpen} onClose={() => setImportDebtDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Importar deuda</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Actualiza el registro de deudas y las facturas ya generadas del período{' '}
              <strong>{selectedPeriod}</strong> para los medidores del archivo (punto de partida manual).
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Con <strong>Calcular todo</strong>, la <strong>DEUDA</strong> es la <strong>diferencia guardada
              del mes anterior</strong> si hubo factura; si no, 0. Esta importación ajusta la columna DEUDA en
              las facturas ya generadas del período mostrado (no sustituye el arrastre automático al recalcular).
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              El archivo debe contener columnas: Código y valor de deuda (Deuda, Saldo, Valor, Monto, etc.).
            </Typography>
            <Button variant="outlined" component="label" fullWidth startIcon={<UploadIcon />}>
              Seleccionar archivo Excel
              <input
                type="file"
                hidden
                accept=".xlsx,.xls"
                onChange={handleImportDebt}
              />
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDebtDialogOpen(false)}>Cerrar</Button>
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

