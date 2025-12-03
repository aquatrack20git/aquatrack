# Detalle del Funcionamiento del Sistema AquaTrack

## 📋 Índice
1. [Arquitectura General](#arquitectura-general)
2. [Sistema de Tarifas](#sistema-de-tarifas)
3. [Parámetros de Cálculo](#parámetros-de-cálculo)
4. [Flujo de Cálculo de Facturación](#flujo-de-cálculo-de-facturación)
5. [Ejemplos Prácticos](#ejemplos-prácticos)
6. [Estructura de Base de Datos](#estructura-de-base-de-datos)

---

## 🏗️ Arquitectura General

### Componentes Principales

1. **Frontend (React + TypeScript)**
   - Páginas de administración
   - Gestión de tarifas
   - Parametrización de cálculos
   - Registro de lecturas

2. **Backend (Supabase)**
   - Base de datos PostgreSQL
   - Autenticación
   - Almacenamiento de archivos
   - Row Level Security (RLS)

3. **Tablas Principales**
   - `meters`: Medidores de agua
   - `readings`: Lecturas de medidores
   - `tariffs`: Tarifas por rangos de consumo
   - `calculation_params`: Parámetros configurables

---

## 💰 Sistema de Tarifas

### Estructura de Tarifas (Basada en Excel)

El sistema implementa un **sistema de tarifas escalonadas** similar al Excel analizado:

#### 1. **BASE (Cargo Fijo)**
- **Rango**: 0 - 15 m³
- **Cargo**: $2.00 fijo
- **Descripción**: Cargo base que se aplica a todos los consumos hasta 15 m³
- **Fórmula Excel**: `IF(E2<=15,2,2)`

#### 2. **Rango 16-20 m³**
- **Rango**: 16 - 20 m³
- **Precio por unidad**: $0.20/m³
- **Máximo de unidades**: 5 m³ (límite del rango)
- **Cálculo**: `(consumo - 15) × $0.20`, máximo 5 m³
- **Fórmula Excel**: `IF(E2>=16,(IF(E2>=20,5,(E2-15))*0.2),0)`
- **Ejemplo**: Si consumo = 18 m³ → (18-15) × 0.20 = $0.60

#### 3. **Rango 21-25 m³**
- **Rango**: 21 - 25 m³
- **Precio por unidad**: $0.50/m³
- **Máximo de unidades**: 5 m³ (límite del rango)
- **Cálculo**: `(consumo - 20) × $0.50`, máximo 5 m³
- **Fórmula Excel**: `IF(E2>=21,(IF(E2>=25,5,(E2-20))*0.5),0)`
- **Ejemplo**: Si consumo = 23 m³ → (23-20) × 0.50 = $1.50

#### 4. **Rango 26+ m³**
- **Rango**: 26 m³ en adelante (sin límite)
- **Precio por unidad**: $1.00/m³
- **Máximo de unidades**: Sin límite
- **Cálculo**: `(consumo - 25) × $1.00`
- **Fórmula Excel**: `IF(E2>=26,(IF(E2>=5000,5,(E2-25))*1),0)`
- **Ejemplo**: Si consumo = 30 m³ → (30-25) × 1.00 = $5.00

### Orden de Aplicación

Las tarifas se aplican en orden según el campo `order_index`:

1. **BASE** (order_index: 1) - Siempre se aplica si consumo ≤ 15 m³
2. **Rango 16-20** (order_index: 2) - Se aplica si consumo ≥ 16 m³
3. **Rango 21-25** (order_index: 3) - Se aplica si consumo ≥ 21 m³
4. **Rango 26+** (order_index: 4) - Se aplica si consumo ≥ 26 m³

---

## ⚙️ Parámetros de Cálculo

### Categorías de Parámetros

#### 1. **Tariff (Tarifas)**
- `base_tariff`: Cargo base fijo ($2.00)
- Configuración de tarifas base

#### 2. **Multas**
- `multas_reuniones`: Multa por no asistir a reuniones
- `multas_mingas`: Multa por no asistir a mingas (trabajos comunitarios)
- **Tipo**: number
- **Uso**: Se suma al total a pagar

#### 3. **Mora**
- `mora_percentage`: Porcentaje de mora aplicado a deudas
- **Tipo**: number
- **Uso**: Se calcula sobre la deuda anterior

#### 4. **Jardín**
- `jardin_enabled`: Habilitar/deshabilitar cargo por jardín
- `jardin_amount`: Valor del cargo por jardín
- **Tipo**: boolean y number
- **Uso**: Cargo adicional opcional

#### 5. **Billing (Facturación)**
- Parámetros generales de facturación
- IVA, descuentos, etc.

### Tipos de Parámetros

- **number**: Valores numéricos (ej: 0, 10, 12.5)
- **text**: Texto libre
- **formula**: Fórmulas de cálculo
- **boolean**: true/false o 1/0

---

## 🔄 Flujo de Cálculo de Facturación

### Paso 1: Obtener Lecturas
```
Lectura Anterior: 272 m³
Lectura Actual: 289 m³
Consumo = 289 - 272 = 17 m³
```

### Paso 2: Calcular Tarifas por Rango

#### Ejemplo: Consumo = 17 m³

1. **BASE** (0-15 m³)
   - Se aplica: ✅ (17 > 15, pero BASE siempre se cobra)
   - Valor: $2.00

2. **Rango 16-20** (16-20 m³)
   - Se aplica: ✅ (17 ≥ 16)
   - Unidades: min(17-15, 5) = min(2, 5) = 2 m³
   - Valor: 2 × $0.20 = $0.40

3. **Rango 21-25** (21-25 m³)
   - Se aplica: ❌ (17 < 21)
   - Valor: $0.00

4. **Rango 26+** (26+ m³)
   - Se aplica: ❌ (17 < 26)
   - Valor: $0.00

**Subtotal Tarifas**: $2.00 + $0.40 = $2.40

### Paso 3: Aplicar Parámetros Adicionales

```
DEUDA ANTERIOR: $4.00
MULTAS REUNIONES: $0.00
MULTAS MINGAS: $0.00
MORA: $0.00 (si no hay mora configurada)
VALOR JARDIN: $0.00 (si no aplica)
```

### Paso 4: Calcular Total a Pagar

**Fórmula del Excel**: `J2+K2+L2+M2+N2`

```
TOTAL A PAGAR = DEUDA + COBRO + MULTAS_REUNIONES + MULTAS_MINGAS + MORA
TOTAL A PAGAR = $4.00 + $2.40 + $0.00 + $0.00 + $0.00
TOTAL A PAGAR = $6.40
```

---

## 📊 Ejemplos Prácticos

### Ejemplo 1: Consumo Bajo (10 m³)

**Datos:**
- Lectura Anterior: 100 m³
- Lectura Actual: 110 m³
- Consumo: 10 m³
- Deuda: $0.00

**Cálculo:**
1. BASE: $2.00 (se aplica siempre)
2. Rango 16-20: $0.00 (10 < 16)
3. Rango 21-25: $0.00 (10 < 21)
4. Rango 26+: $0.00 (10 < 26)

**Subtotal**: $2.00
**Total a Pagar**: $2.00

---

### Ejemplo 2: Consumo Medio (20 m³)

**Datos:**
- Lectura Anterior: 200 m³
- Lectura Actual: 220 m³
- Consumo: 20 m³
- Deuda: $0.00

**Cálculo:**
1. BASE: $2.00
2. Rango 16-20: min(20-15, 5) × $0.20 = 5 × $0.20 = $1.00
3. Rango 21-25: $0.00 (20 < 21)
4. Rango 26+: $0.00 (20 < 26)

**Subtotal**: $2.00 + $1.00 = $3.00
**Total a Pagar**: $3.00

---

### Ejemplo 3: Consumo Alto (35 m³)

**Datos:**
- Lectura Anterior: 500 m³
- Lectura Actual: 535 m³
- Consumo: 35 m³
- Deuda: $10.00
- Multas Reuniones: $5.00

**Cálculo:**
1. BASE: $2.00
2. Rango 16-20: min(35-15, 5) × $0.20 = 5 × $0.20 = $1.00
3. Rango 21-25: min(35-20, 5) × $0.50 = 5 × $0.50 = $2.50
4. Rango 26+: (35-25) × $1.00 = 10 × $1.00 = $10.00

**Subtotal Tarifas**: $2.00 + $1.00 + $2.50 + $10.00 = $15.50
**Total a Pagar**: $10.00 (deuda) + $15.50 (cobro) + $5.00 (multas) = $30.50

---

### Ejemplo 4: Con Mora y Jardín

**Datos:**
- Consumo: 25 m³
- Deuda: $20.00
- Mora: 5% sobre deuda
- Jardín: $4.00

**Cálculo:**
1. BASE: $2.00
2. Rango 16-20: 5 × $0.20 = $1.00
3. Rango 21-25: 5 × $0.50 = $2.50
4. Rango 26+: $0.00

**Subtotal Tarifas**: $5.50
**Mora**: $20.00 × 5% = $1.00
**Total a Pagar**: $20.00 + $5.50 + $1.00 + $4.00 = $30.50

---

## 🗄️ Estructura de Base de Datos

### Tabla: `tariffs`

```sql
CREATE TABLE tariffs (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,              -- Nombre de la tarifa
    description TEXT,                        -- Descripción
    min_consumption NUMERIC(10, 2) NOT NULL, -- Consumo mínimo (m³)
    max_consumption NUMERIC(10, 2),          -- Consumo máximo (m³), NULL = sin límite
    price_per_unit NUMERIC(10, 4) NOT NULL, -- Precio por m³
    max_units NUMERIC(10, 2),                -- Máximo de unidades a cobrar
    fixed_charge NUMERIC(10, 2) DEFAULT 0,   -- Cargo fijo
    status VARCHAR(20) DEFAULT 'active',      -- active/inactive
    order_index INTEGER DEFAULT 0,           -- Orden de aplicación
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
);
```

**Ejemplo de Registros:**
```sql
-- BASE
INSERT INTO tariffs VALUES (
    1, 'BASE', 'Cargo base hasta 15 m³', 
    0, 15, 0, NULL, 2.00, 'active', 1
);

-- Rango 16-20
INSERT INTO tariffs VALUES (
    2, 'Rango 16-20', 'Consumo entre 16 y 20 m³',
    16, 20, 0.20, 5, 0, 'active', 2
);
```

### Tabla: `calculation_params`

```sql
CREATE TABLE calculation_params (
    id BIGSERIAL PRIMARY KEY,
    param_key VARCHAR(100) UNIQUE NOT NULL,   -- Clave única (ej: multas_reuniones)
    param_name VARCHAR(255) NOT NULL,        -- Nombre descriptivo
    param_value TEXT NOT NULL,               -- Valor del parámetro
    param_type VARCHAR(50) DEFAULT 'number', -- number/text/formula/boolean
    description TEXT,                         -- Descripción
    category VARCHAR(100),                    -- Categoría
    is_active BOOLEAN DEFAULT true,          -- Activo/Inactivo
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
);
```

**Ejemplo de Registros:**
```sql
-- Multas por Reuniones
INSERT INTO calculation_params VALUES (
    1, 'multas_reuniones', 'Multas por Reuniones',
    '0', 'number', 'Multa por no asistir a reuniones', 
    'multas', true
);

-- Porcentaje de Mora
INSERT INTO calculation_params VALUES (
    2, 'mora_percentage', 'Porcentaje de Mora',
    '5', 'number', 'Porcentaje de mora sobre deudas',
    'mora', true
);
```

---

## 🔐 Seguridad y Permisos

### Row Level Security (RLS)

- **Lectura**: Todos los usuarios pueden leer tarifas y parámetros
- **Escritura**: Solo usuarios autenticados pueden crear/editar/eliminar
- **Políticas**: Configuradas en la migración SQL

---

## 📱 Interfaz de Usuario

### Página: Gestión de Tarifario (`/admin/tariffs`)

**Funcionalidades:**
- Ver todas las tarifas en una tabla
- Crear nueva tarifa
- Editar tarifa existente
- Eliminar tarifa
- Ver ejemplo de cálculo por tarifa
- Filtrar por estado (activa/inactiva)

**Campos del Formulario:**
- Nombre de la tarifa
- Descripción
- Consumo mínimo (m³)
- Consumo máximo (m³) - opcional
- Precio por unidad
- Máximo de unidades - opcional
- Cargo fijo
- Orden de aplicación
- Estado (activa/inactiva)

### Página: Parametrización de Cálculo (`/admin/calculation-params`)

**Funcionalidades:**
- Ver todos los parámetros
- Filtrar por categoría (multas, mora, jardin, etc.)
- Crear nuevo parámetro
- Editar parámetro existente
- Eliminar parámetro
- Activar/desactivar parámetro
- Ver preview del valor

**Categorías Disponibles:**
- General
- Tariff
- Multas
- Mora
- Jardin
- Billing
- Other

---

## 🔄 Flujo Completo del Sistema

```
1. Usuario registra lectura
   ↓
2. Sistema calcula consumo (lectura actual - lectura anterior)
   ↓
3. Sistema busca tarifas activas ordenadas por order_index
   ↓
4. Para cada tarifa:
   - Verifica si el consumo está en el rango
   - Calcula el monto según precio por unidad o cargo fijo
   - Aplica límite de unidades si existe
   ↓
5. Suma todos los montos de tarifas aplicables
   ↓
6. Obtiene parámetros de cálculo (multas, mora, jardín)
   ↓
7. Calcula total:
   Total = Deuda + Subtotal_Tarifas + Multas + Mora + Jardín
   ↓
8. Genera factura/recibo
```

---

## 📝 Notas Importantes

1. **Orden de Aplicación**: Las tarifas se aplican según `order_index`, no por rango de consumo
2. **Límite de Unidades**: El campo `max_units` limita cuántos m³ se cobran en ese rango
3. **Cargo Fijo vs Precio por Unidad**: Una tarifa puede tener cargo fijo O precio por unidad, o ambos
4. **Rangos Solapados**: El sistema permite rangos solapados, pero el orden determina qué se aplica primero
5. **Parámetros Inactivos**: Los parámetros con `is_active = false` no se aplican en los cálculos

---

## 🚀 Próximos Pasos Sugeridos

1. **Implementar función de cálculo automático** que use las tarifas y parámetros
2. **Crear página de facturación** que muestre el desglose completo
3. **Generar reportes** con cálculos por período
4. **Exportar a Excel** con el mismo formato del archivo original
5. **Historial de cambios** en tarifas y parámetros

---

## 📞 Soporte

Para más información sobre el funcionamiento, consulta:
- Código fuente en `src/pages/admin/TariffManagement.tsx`
- Código fuente en `src/pages/admin/CalculationParams.tsx`
- Migración SQL en `supabase/migrations/20240321_add_tariffs_and_calculation_params.sql`


