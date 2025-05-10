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

- Node.js 18+
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
   - Crear un archivo `.env` en la raíz del proyecto con las siguientes variables:
   ```
   VITE_SUPABASE_URL=tu_url_de_supabase
   VITE_SUPABASE_ANON_KEY=tu_key_de_supabase
   ```
   - Para desarrollo local, copia el archivo `.env.example` a `.env` y actualiza los valores.

4. Iniciar el servidor de desarrollo:
```bash
npm run dev
```

## Despliegue en Vercel

El proyecto está configurado para ser desplegado en Vercel. Sigue estos pasos para configurar el despliegue:

1. Conecta tu repositorio de GitHub con Vercel.

2. En el panel de Vercel, configura las siguientes variables de entorno:
   - `VITE_SUPABASE_URL`: URL de tu proyecto Supabase
   - `VITE_SUPABASE_ANON_KEY`: Clave anónima de tu proyecto Supabase

3. Asegúrate de que las variables de entorno estén configuradas en:
   - Settings > Environment Variables
   - Project Settings > Environment Variables

4. Cada push a la rama principal desencadenará un nuevo despliegue.

### Solución de problemas comunes

Si encuentras una pantalla en blanco después del despliegue:

1. Verifica que las variables de entorno estén correctamente configuradas en Vercel.
2. Revisa los logs de construcción en Vercel para identificar errores.
3. Limpia la caché del navegador y recarga la página.
4. Verifica la consola del navegador (F12) para ver errores específicos.

## Licencia

MIT
