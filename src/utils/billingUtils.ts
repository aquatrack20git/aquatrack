import { supabase } from '../config/supabase';

export interface Tariff {
  id: number;
  name: string;
  min_consumption: number;
  max_consumption: number | null;
  price_per_unit: number;
  max_units: number | null;
  fixed_charge: number;
  order_index: number;
}

export interface BillingCalculation {
  consumption: number;
  base_amount: number;
  range_16_20_amount: number;
  range_21_25_amount: number;
  range_26_plus_amount: number;
  tariff_total: number;
  tariff_breakdown?: Array<{
    name: string;
    min: number;
    max: number | null;
    units: number;
    unit_price: number;
    amount: number;
  }>;
}

/**
 * Calcula el monto de facturación basado en el consumo y las tarifas
 */
export const calculateBilling = async (
  consumption: number
): Promise<BillingCalculation> => {
  // Obtener tarifas activas ordenadas por order_index
  const { data: tariffs, error } = await supabase
    .from('tariffs')
    .select('*')
    .eq('status', 'active')
    .order('order_index', { ascending: true });

  if (error) {
    console.error('Error fetching tariffs:', error);
    throw error;
  }

  let base_amount = 0;
  let range_16_20_amount = 0;
  let range_21_25_amount = 0;
  let range_26_plus_amount = 0;
  const breakdown: Array<{
    name: string;
    min: number;
    max: number | null;
    units: number;
    unit_price: number;
    amount: number;
  }> = [];

  // Aplicar cada tarifa según su orden (acumulativo)
  for (const tariff of tariffs || []) {
    // Calcular monto según el tipo de tarifa
    if (tariff.fixed_charge > 0) {
      // Tarifa con cargo fijo (BASE) - se aplica siempre que el consumo supere el mínimo
      // Para BASE (0-15), se aplica siempre que consumo >= 0, incluso si supera 15
      if (consumption >= tariff.min_consumption) {
        base_amount = tariff.fixed_charge;
        breakdown.push({
          name: tariff.name,
          min: tariff.min_consumption,
          max: tariff.max_consumption,
          units: 1,
          unit_price: tariff.fixed_charge,
          amount: tariff.fixed_charge,
        });
      }
    } else if (tariff.price_per_unit > 0) {
      // Tarifa por unidad - calcular m³ adicionales en este rango
      // Según la tabla: se calculan los m³ que exceden el rango anterior
      let units = 0;
      const minConsumption = tariff.min_consumption;
      const maxConsumption = tariff.max_consumption;

      // Solo calcular si el consumo supera el mínimo del rango
      if (consumption >= minConsumption) {
        if (maxConsumption === null || maxConsumption === undefined) {
          // Rango sin límite superior (ej: 26+)
          // Calcular m³ adicionales desde el límite anterior (25) hasta el consumo actual
          // Para consumo 30: unidades = 30 - 25 = 5 m³
          const previousLimit = minConsumption - 1; // 25 para rango 26+
          units = Math.max(0, consumption - previousLimit);
        } else {
          // Rango con límite superior
          // Calcular m³ adicionales en este rango específico
          // Ejemplo: rango 16-20, consumo 30
          // - Límite anterior: 15
          // - Límite actual: min(30, 20) = 20
          // - Unidades: 20 - 15 = 5 m³
          const previousLimit = minConsumption - 1; // 15 para rango 16-20
          const actualMax = Math.min(consumption, maxConsumption);
          if (actualMax > previousLimit) {
            units = actualMax - previousLimit;
          }
        }
        
        // Si hay límite de unidades (max_units), aplicar
        if (tariff.max_units !== null && tariff.max_units !== undefined) {
          units = Math.min(units, tariff.max_units);
        }

        const amount = units * tariff.price_per_unit;
        
        // Asignar al rango correspondiente de manera dinámica basado en los valores de min/max
        // Esto permite que los rangos sean completamente parametrizables
        if (minConsumption >= 16 && (maxConsumption === null || maxConsumption <= 20)) {
          // Rango 16-20 (parametrizable)
          range_16_20_amount += amount;
        } else if (minConsumption >= 21 && (maxConsumption === null || maxConsumption <= 25)) {
          // Rango 21-25 (parametrizable)
          range_21_25_amount += amount;
        } else if (minConsumption >= 26) {
          // Rango 26+ (parametrizable)
          range_26_plus_amount += amount;
        } else if (minConsumption === 0 && (maxConsumption === null || maxConsumption <= 15)) {
          // Rango base (0-15) - esto no se cobra por unidad, solo cargo fijo
          // Pero si hay precio por unidad en este rango, se puede aplicar
          // Por ahora, solo aplicamos cargo fijo para el rango base
        }

        if (units > 0) {
          breakdown.push({
            name: tariff.name,
            min: minConsumption,
            max: maxConsumption,
            units: units,
            unit_price: tariff.price_per_unit,
            amount: amount,
          });
        }
      }
    }
  }

  const tariff_total = base_amount + range_16_20_amount + range_21_25_amount + range_26_plus_amount;

  return {
    consumption,
    base_amount,
    range_16_20_amount,
    range_21_25_amount,
    range_26_plus_amount,
    tariff_total,
    tariff_breakdown: breakdown,
  };
};

/**
 * Obtiene la lectura anterior de un medidor para un período dado
 */
export const getPreviousReading = async (
  meterId: string,
  currentPeriod: string
): Promise<number | null> => {
  try {
    // Obtener todas las lecturas del medidor ordenadas por período
    const { data: readings, error } = await supabase
      .from('readings')
      .select('value, period')
      .eq('meter_id', meterId)
      .order('period', { ascending: false });

    if (error) throw error;

    if (!readings || readings.length === 0) return null;

    // Encontrar la lectura del período actual
    const currentIndex = readings.findIndex(r => r.period === currentPeriod);
    
    // Si hay una lectura anterior, retornarla
    if (currentIndex >= 0 && currentIndex < readings.length - 1) {
      return readings[currentIndex + 1].value;
    }

    // Si no hay lectura del período actual, retornar la más reciente
    return readings[0]?.value || null;
  } catch (error) {
    console.error('Error getting previous reading:', error);
    return null;
  }
};

/**
 * Calcula el consumo basado en lecturas
 */
export const calculateConsumption = (
  currentReading: number,
  previousReading: number | null
): number => {
  if (previousReading === null || previousReading === undefined) {
    return 0;
  }
  return Math.max(0, currentReading - previousReading);
};

