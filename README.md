# AquaTrack - Sistema de Gestión de Lecturas de Agua

Sistema web para la gestión y seguimiento de lecturas de medidores de agua, desarrollado con React, TypeScript y Supabase.

## Características

- 📊 Gestión de lecturas de medidores de agua
- 📱 Interfaz responsiva y moderna
- 📈 Reportes de consumo por período
- 📤 Exportación de datos a Excel
- 🔐 Autenticación y control de acceso
- 📸 Soporte para fotos de lecturas
- 📝 Sistema de comentarios

## Tecnologías Utilizadas

- React 18
- TypeScript
- Material-UI
- Supabase (Backend y Base de datos)
- Vite
- XLSX (Exportación a Excel)

## Requisitos

- Node.js 16+
- npm o yarn
- Cuenta en Supabase

## Instalación

1. Clonar el repositorio:
```bash
git clone https://github.com/aquatrack20git/aquatrack.git
cd aquatrack
```

2. Instalar dependencias:
```bash
npm install
```

3. Configurar variables de entorno:
Crear un archivo `.env` en la raíz del proyecto con las siguientes variables:
```
VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_ANON_KEY=tu_key_de_supabase
```

4. Iniciar el servidor de desarrollo:
```bash
npm run dev
```

## Despliegue

El proyecto está configurado para ser desplegado en Vercel. Cada push a la rama principal desencadenará un nuevo despliegue.

## Licencia

MIT
