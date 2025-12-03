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
import { calculateBilling, getPreviousReading, calculateConsumption } from '../../utils/billingUtils';
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
    severity: 'success' as 'success' | 'error' | 'info',
  });
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  useEffect(() => {
    fetchPeriods();
    fetchMeters();
  }, []);

  useEffect(() => {
    if (selectedPeriod) {
      fetchReadings();
      fetchBills();
    }
  }, [selectedPeriod]);

  const fetchPeriods = async () => {
    try {
      const { data, error } = await supabase
        .from('readings')
        .select('period')
        .order('period', { ascending: false });

      if (error) throw error;

      const uniquePeriods = [...new Set(data?.map(r => r.period) || [])].sort();
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
      const { data, error } = await supabase
        .from('readings')
        .select('id, meter_id, value, period')
        .eq('period', selectedPeriod);

      if (error) throw error;
      setReadings(data || []);
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

      // Enriquecer con datos del medidor
      const enrichedBills = (data || []).map(bill => {
        const meter = meters.find(m => m.code_meter === bill.meter_id);
        return {
          ...bill,
          meter_name: meter?.code_meter || bill.meter_id,
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
      const newBills: BillRow[] = [];

      for (const reading of readings) {
        // Obtener lectura anterior
        const previousReading = await getPreviousReading(reading.meter_id, selectedPeriod);

        // Calcular consumo
        let consumption = calculateConsumption(reading.value, previousReading);

        // Calcular tarifas
        const billingCalc = await calculateBilling(consumption);

        // Obtener deuda anterior
        const { data: debtData } = await supabase
          .from('debts')
          .select('amount')
          .eq('meter_id', reading.meter_id)
          .eq('period', selectedPeriod)
          .single();

        const previousDebt = debtData?.amount || 0;

        // Obtener multas y mora
        const { data: finesData } = await supabase
          .from('meter_fines')
          .select('fines_reuniones, fines_mingas, mora_percentage, mora_amount')
          .eq('meter_id', reading.meter_id)
          .eq('period', selectedPeriod)
          .single();

        const finesReuniones = finesData?.fines_reuniones || 0;
        const finesMingas = finesData?.fines_mingas || 0;
        const moraAmount = finesData?.mora_amount || (previousDebt * (finesData?.mora_percentage || 0) / 100);

        // Obtener valor de jardín
        const { data: gardenData } = await supabase
          .from('garden_values')
          .select('amount')
          .eq('meter_id', reading.meter_id)
          .eq('period', selectedPeriod)
          .single();

        const gardenAmount = gardenData?.amount || 0;

        // Calcular total
        const totalAmount = 
          previousDebt +
          billingCalc.tariff_total +
          finesReuniones +
          finesMingas +
          moraAmount +
          gardenAmount;

        const meter = meters.find(m => m.code_meter === reading.meter_id);

        newBills.push({
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
          garden_amount: gardenAmount,
          total_amount: totalAmount,
          payment_status: 'PENDIENTE',
          meter_name: meter?.code_meter || reading.meter_id,
          meter_location: meter?.location || '',
        });
      }

      setBills(newBills);
      showSnackbar(`Se calcularon ${newBills.length} facturas`, 'success');
    } catch (error: any) {
      console.error('Error calculating bills:', error);
      showSnackbar('Error al calcular facturas', 'error');
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

      // Recalcular total siempre
      billData.total_amount = 
        billData.previous_debt +
        billData.tariff_total +
        billData.fines_reuniones +
        billData.fines_mingas +
        billData.mora_amount +
        billData.garden_amount;

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
            const { error } = await supabase
              .from('bills')
              .update(billData)
              .eq('id', bill.id);

            if (error) throw error;
          } else {
            const { error } = await supabase
              .from('bills')
              .insert([billData])
              .select()
              .single();

            if (error) throw error;
          }

          saved++;
        } catch (error) {
          console.error(`Error saving bill for ${bill.meter_id}:`, error);
          errors++;
        }
      }

      showSnackbar(
        `Se guardaron ${saved} facturas${errors > 0 ? `. ${errors} errores` : ''}`,
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
        'NOMBRES Y APELLIDOS': meter?.location || bill.meter_location || '',
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

    const fileName = `COBROS ${selectedPeriod} CORRESPONDIENTE A ${selectedPeriod}.xlsx`;
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
      const codigoIndex = headers.findIndex(h => 
        String(h).toLowerCase().includes('código') || 
        String(h).toLowerCase().includes('codigo')
      );
      const valorIndex = headers.findIndex(h => 
        String(h).toLowerCase().includes('valor') || 
        String(h).toLowerCase().includes('amount')
      );

      if (codigoIndex === -1 || valorIndex === -1) {
        throw new Error('No se encontraron las columnas necesarias (Código, Valor)');
      }

      let imported = 0;
      let errors = 0;

      // Procesar filas de datos
      for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!Array.isArray(row) || !row[codigoIndex] || !row[valorIndex]) continue;

        const meterCode = String(row[codigoIndex]).trim();
        const amount = parseFloat(row[valorIndex]) || 0;

        if (!meterCode || amount <= 0) continue;

        try {
          const { error } = await supabase
            .from('garden_values')
            .upsert({
              meter_id: meterCode,
              period: selectedPeriod,
              amount: amount,
              imported_from_excel: true,
              import_date: new Date().toISOString(),
            }, {
              onConflict: 'meter_id,period'
            });

          if (error) throw error;
          imported++;
        } catch (error) {
          console.error(`Error importing garden value for ${meterCode}:`, error);
          errors++;
        }
      }

      showSnackbar(
        `Se importaron ${imported} valores de jardín${errors > 0 ? `. ${errors} errores` : ''}`,
        errors > 0 ? 'warning' : 'success'
      );
      
      setImportDialogOpen(false);
      calculateAllBills(); // Recalcular facturas
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
                {bills.map((bill) => (
                  <TableRow key={bill.meter_id} hover>
                    <TableCell>{bill.meter_id}</TableCell>
                    <TableCell>{bill.meter_location || bill.meter_name}</TableCell>
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
                                (editData.fines_reuniones ?? bill.fines_reuniones) +
                                (editData.fines_mingas ?? bill.fines_mingas) +
                                (editData.mora_amount ?? bill.mora_amount) +
                                (editData.garden_amount ?? bill.garden_amount),
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
                                (editData.fines_reuniones ?? bill.fines_reuniones) +
                                (editData.fines_mingas ?? bill.fines_mingas) +
                                (editData.mora_amount ?? bill.mora_amount) +
                                (editData.garden_amount ?? bill.garden_amount),
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
                              total_amount: 
                                (editData.previous_debt ?? bill.previous_debt) +
                                (editData.tariff_total ?? bill.tariff_total) +
                                newFines +
                                (editData.fines_mingas ?? bill.fines_mingas) +
                                (editData.mora_amount ?? bill.mora_amount) +
                                (editData.garden_amount ?? bill.garden_amount),
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
                                (editData.fines_reuniones ?? bill.fines_reuniones) +
                                newFines +
                                (editData.mora_amount ?? bill.mora_amount) +
                                (editData.garden_amount ?? bill.garden_amount),
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
                                (editData.fines_reuniones ?? bill.fines_reuniones) +
                                (editData.fines_mingas ?? bill.fines_mingas) +
                                newMora +
                                (editData.garden_amount ?? bill.garden_amount),
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
                              total_amount: 
                                (editData.previous_debt ?? bill.previous_debt) +
                                (editData.tariff_total ?? bill.tariff_total) +
                                (editData.fines_reuniones ?? bill.fines_reuniones) +
                                (editData.fines_mingas ?? bill.fines_mingas) +
                                (editData.mora_amount ?? bill.mora_amount) +
                                newGarden,
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
                ))}
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

