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