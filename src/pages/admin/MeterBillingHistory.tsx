import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Snackbar,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { PictureAsPdf as PdfIcon } from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '../../config/supabase';

interface Meter {
  code_meter: string;
  location: string;
  description: string | null;
}

interface BillRow {
  id: number;
  meter_id: string;
  period: string;
  previous_reading: number | null;
  current_reading: number | null;
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
  payment_date: string | null;
  observations: string | null;
}

const MESES: Record<string, number> = {
  ENERO: 1,
  FEBRERO: 2,
  MARZO: 3,
  ABRIL: 4,
  MAYO: 5,
  JUNIO: 6,
  JULIO: 7,
  AGOSTO: 8,
  SEPTIEMBRE: 9,
  OCTUBRE: 10,
  NOVIEMBRE: 11,
  DICIEMBRE: 12,
};

function sortBillsByPeriodDesc(rows: BillRow[]): BillRow[] {
  return [...rows].sort((a, b) => {
    const [mesA, añoA] = a.period.split(' ');
    const [mesB, añoB] = b.period.split(' ');
    const numMesA = MESES[mesA] ?? 0;
    const numMesB = MESES[mesB] ?? 0;
    const numAñoA = parseInt(añoA, 10);
    const numAñoB = parseInt(añoB, 10);
    if (numAñoA !== numAñoB) return numAñoB - numAñoA;
    return numMesB - numMesA;
  });
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return Number(n).toFixed(2);
}

function fmtPaymentDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), 'dd/MM/yyyy HH:mm', { locale: es });
  } catch {
    return iso;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const MeterBillingHistory: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [meters, setMeters] = useState<Meter[]>([]);
  const [selectedMeter, setSelectedMeter] = useState<Meter | null>(null);
  const [bills, setBills] = useState<BillRow[]>([]);
  const [loadingMeters, setLoadingMeters] = useState(true);
  const [loadingBills, setLoadingBills] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'error' });

  const sortedBills = useMemo(() => sortBillsByPeriodDesc(bills), [bills]);

  const fetchMeters = useCallback(async () => {
    setLoadingMeters(true);
    try {
      const { data, error } = await supabase
        .from('meters')
        .select('code_meter, location, description')
        .eq('status', 'active')
        .order('code_meter');

      if (error) throw error;
      setMeters(data || []);
    } catch (e: any) {
      console.error(e);
      setSnackbar({ open: true, message: e.message || 'Error al cargar medidores', severity: 'error' });
    } finally {
      setLoadingMeters(false);
    }
  }, []);

  const fetchBillsForMeter = useCallback(async (code: string) => {
    setLoadingBills(true);
    try {
      const { data, error } = await supabase.from('bills').select('*').eq('meter_id', code);

      if (error) throw error;
      setBills((data as BillRow[]) || []);
    } catch (e: any) {
      console.error(e);
      setBills([]);
      setSnackbar({ open: true, message: e.message || 'Error al cargar facturas', severity: 'error' });
    } finally {
      setLoadingBills(false);
    }
  }, []);

  useEffect(() => {
    fetchMeters();
  }, [fetchMeters]);

  useEffect(() => {
    const code = searchParams.get('meter')?.trim();
    if (!code || meters.length === 0) return;
    const found = meters.find((m) => m.code_meter === code);
    if (found) setSelectedMeter(found);
  }, [searchParams, meters]);

  useEffect(() => {
    if (selectedMeter) {
      fetchBillsForMeter(selectedMeter.code_meter);
    } else {
      setBills([]);
    }
  }, [selectedMeter, fetchBillsForMeter]);

  const meterLabel = (m: Meter) =>
    m.description?.trim()
      ? `${m.code_meter} — ${m.description}`
      : `${m.code_meter} — ${m.location || 'Sin ubicación'}`;

  const exportToPDF = () => {
    if (!selectedMeter || sortedBills.length === 0) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setSnackbar({
        open: true,
        message:
          'No se pudo abrir la ventana de impresión. Desactiva el bloqueador de ventanas emergentes e intenta de nuevo.',
        severity: 'error',
      });
      return;
    }

    const title = escapeHtml(meterLabel(selectedMeter));
    const rowsHtml = sortedBills
      .map((row) => {
        const multas = (row.fines_reuniones || 0) + (row.fines_mingas || 0);
        return `
                <tr>
                  <td>${escapeHtml(row.period)}</td>
                  <td style="text-align:right">${fmtMoney(row.previous_reading)}</td>
                  <td style="text-align:right">${fmtMoney(row.current_reading)}</td>
                  <td style="text-align:right">${fmtMoney(row.consumption)}</td>
                  <td style="text-align:right">${fmtMoney(row.tariff_total)}</td>
                  <td style="text-align:right">${fmtMoney(row.previous_debt)}</td>
                  <td style="text-align:right">${fmtMoney(multas)}</td>
                  <td style="text-align:right">${fmtMoney(row.mora_amount)}</td>
                  <td style="text-align:right">${fmtMoney(row.garden_amount)}</td>
                  <td style="text-align:right;font-weight:bold">${fmtMoney(row.total_amount)}</td>
                  <td>${escapeHtml(row.payment_status || 'PENDIENTE')}</td>
                  <td>${escapeHtml(fmtPaymentDate(row.payment_date))}</td>
                  <td>${escapeHtml(row.observations || '—')}</td>
                </tr>`;
      })
      .join('');

    const content = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Historial de facturación — ${title}</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 10px; }
            h1 { font-size: 14px; margin: 0 0 8px 0; color: #333; }
            .meta { color: #666; margin-bottom: 12px; font-size: 11px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ccc; padding: 4px 6px; }
            th { background: #f0f0f0; text-align: left; font-size: 9px; }
            th.num, td.num { text-align: right; }
            @media print {
              @page { size: landscape; margin: 12mm; }
            }
          </style>
        </head>
        <body>
          <h1>Historial de facturación — AquaTrack</h1>
          <div class="meta">${title} · ${sortedBills.length} registro(s) · Generado: ${new Date().toLocaleString('es-EC')}</div>
          <table>
            <thead>
              <tr>
                <th>Período</th>
                <th class="num">Lect. ant.</th>
                <th class="num">Lect. act.</th>
                <th class="num">Consumo</th>
                <th class="num">Tarifario</th>
                <th class="num">Deuda ant.</th>
                <th class="num">Multas</th>
                <th class="num">Mora</th>
                <th class="num">Jardín</th>
                <th class="num">Total</th>
                <th>Estado</th>
                <th>Fecha pago</th>
                <th>Observaciones</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() { window.close(); };
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Historial de facturación por medidor
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Consulta todas las facturas guardadas en el sistema para un medidor, ordenadas del período más
        reciente al más antiguo.
      </Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        {loadingMeters ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={22} />
            <Typography variant="body2">Cargando medidores…</Typography>
          </Box>
        ) : (
          <Autocomplete
            options={meters}
            getOptionLabel={meterLabel}
            value={selectedMeter}
            onChange={(_, v) => setSelectedMeter(v)}
            isOptionEqualToValue={(a, b) => a.code_meter === b.code_meter}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Medidor"
                placeholder="Buscar por código, nombre o ubicación"
              />
            )}
            filterOptions={(options, { inputValue }) => {
              const q = inputValue.toLowerCase().trim();
              if (!q) return options;
              return options.filter(
                (m) =>
                  m.code_meter.toLowerCase().includes(q) ||
                  (m.location || '').toLowerCase().includes(q) ||
                  (m.description || '').toLowerCase().includes(q)
              );
            }}
          />
        )}
      </Paper>

      {!selectedMeter && !loadingMeters && (
        <Alert severity="info">Selecciona un medidor para ver su historial de facturación.</Alert>
      )}

      {selectedMeter && (
        <Paper>
          <Box
            sx={{
              p: 2,
              borderBottom: 1,
              borderColor: 'divider',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <Box>
              <Typography variant="subtitle1" fontWeight={600}>
                {meterLabel(selectedMeter)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {sortedBills.length} registro(s) de facturación
              </Typography>
            </Box>
            {!loadingBills && sortedBills.length > 0 && (
              <Button variant="outlined" startIcon={<PdfIcon />} onClick={exportToPDF}>
                Exportar PDF
              </Button>
            )}
          </Box>

          {loadingBills ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : sortedBills.length === 0 ? (
            <Box sx={{ p: 3 }}>
              <Alert severity="warning">
                No hay facturas guardadas para este medidor. Las facturas aparecen tras calcular y guardar
                en Facturación.
              </Alert>
            </Box>
          ) : (
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Período</TableCell>
                    <TableCell align="right">Lect. ant.</TableCell>
                    <TableCell align="right">Lect. act.</TableCell>
                    <TableCell align="right">Consumo</TableCell>
                    <TableCell align="right">Tarifario</TableCell>
                    <TableCell align="right">Deuda ant.</TableCell>
                    <TableCell align="right">Multas</TableCell>
                    <TableCell align="right">Mora</TableCell>
                    <TableCell align="right">Jardín</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell>Fecha pago</TableCell>
                    <TableCell>Observaciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedBills.map((row) => {
                    const multas = (row.fines_reuniones || 0) + (row.fines_mingas || 0);
                    const isPaid = row.payment_status === 'ACREDITADO';
                    return (
                      <TableRow key={row.id} hover>
                        <TableCell>{row.period}</TableCell>
                        <TableCell align="right">{fmtMoney(row.previous_reading)}</TableCell>
                        <TableCell align="right">{fmtMoney(row.current_reading)}</TableCell>
                        <TableCell align="right">{fmtMoney(row.consumption)}</TableCell>
                        <TableCell align="right">{fmtMoney(row.tariff_total)}</TableCell>
                        <TableCell align="right">{fmtMoney(row.previous_debt)}</TableCell>
                        <TableCell align="right">{fmtMoney(multas)}</TableCell>
                        <TableCell align="right">{fmtMoney(row.mora_amount)}</TableCell>
                        <TableCell align="right">{fmtMoney(row.garden_amount)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          {fmtMoney(row.total_amount)}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={row.payment_status || 'PENDIENTE'}
                            color={isPaid ? 'success' : 'default'}
                            variant={isPaid ? 'filled' : 'outlined'}
                          />
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{fmtPaymentDate(row.payment_date)}</TableCell>
                        <TableCell sx={{ maxWidth: 220 }}>{row.observations || '—'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MeterBillingHistory;
