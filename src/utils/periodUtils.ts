import { format, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

export const getCurrentPeriod = (): string => {
  const today = new Date();
  const day = today.getDate();
  
  // If we're between the 20th and the end of the month, return next month
  if (day >= 20) {
    return format(addMonths(today, 1), 'MMMM yyyy', { locale: es }).toUpperCase();
  }
  
  // If we're between the 1st and 10th, return current month
  if (day <= 10) {
    return format(today, 'MMMM yyyy', { locale: es }).toUpperCase();
  }
  
  // For days 11-19, return previous month
  return format(subMonths(today, 1), 'MMMM yyyy', { locale: es }).toUpperCase();
};

export const getPeriodFromDate = (date: Date): string => {
  const day = date.getDate();
  
  if (day >= 20) {
    return format(addMonths(date, 1), 'MMMM yyyy', { locale: es }).toUpperCase();
  }
  
  if (day <= 10) {
    return format(date, 'MMMM yyyy', { locale: es }).toUpperCase();
  }
  
  return format(subMonths(date, 1), 'MMMM yyyy', { locale: es }).toUpperCase();
};

/**
 * Obtiene el período anterior basado en el período actual
 * @param currentPeriod - Período en formato "MES AÑO" (ej: "DICIEMBRE 2025")
 * @returns Período anterior en el mismo formato
 */
export const getPreviousPeriod = (currentPeriod: string): string | null => {
  const meses: Record<string, number> = {
    'ENERO': 1, 'FEBRERO': 2, 'MARZO': 3, 'ABRIL': 4, 'MAYO': 5, 'JUNIO': 6,
    'JULIO': 7, 'AGOSTO': 8, 'SEPTIEMBRE': 9, 'OCTUBRE': 10, 'NOVIEMBRE': 11, 'DICIEMBRE': 12
  };
  
  const mesesNombres: Record<number, string> = {
    1: 'ENERO', 2: 'FEBRERO', 3: 'MARZO', 4: 'ABRIL', 5: 'MAYO', 6: 'JUNIO',
    7: 'JULIO', 8: 'AGOSTO', 9: 'SEPTIEMBRE', 10: 'OCTUBRE', 11: 'NOVIEMBRE', 12: 'DICIEMBRE'
  };

  const [mesStr, añoStr] = currentPeriod.split(' ');
  const mes = meses[mesStr] || 0;
  const año = parseInt(añoStr) || 0;

  if (mes === 0 || año === 0) {
    return null;
  }

  // Calcular mes y año anterior
  let mesAnterior = mes - 1;
  let añoAnterior = año;

  if (mesAnterior < 1) {
    mesAnterior = 12;
    añoAnterior = año - 1;
  }

  return `${mesesNombres[mesAnterior]} ${añoAnterior}`;
}; 