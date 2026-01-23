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

export const getPreviousPeriod = (currentPeriod: string): string | null => {
  const meses: Record<string, number> = {
    'ENERO': 0, 'FEBRERO': 1, 'MARZO': 2, 'ABRIL': 3, 'MAYO': 4, 'JUNIO': 5,
    'JULIO': 6, 'AGOSTO': 7, 'SEPTIEMBRE': 8, 'OCTUBRE': 9, 'NOVIEMBRE': 10, 'DICIEMBRE': 11
  };
  const [mesStr, añoStr] = currentPeriod.split(' ');
  const mesNum = meses[mesStr];
  const añoNum = parseInt(añoStr);

  if (isNaN(mesNum) || isNaN(añoNum)) {
    console.error('Formato de período inválido:', currentPeriod);
    return null;
  }

  let previousMesNum = mesNum - 1;
  let previousAñoNum = añoNum;

  if (previousMesNum < 0) {
    previousMesNum = 11; // Diciembre
    previousAñoNum--;
  }

  const previousDate = new Date(previousAñoNum, previousMesNum, 1);
  return format(previousDate, 'MMMM yyyy', { locale: es }).toUpperCase();
}; 