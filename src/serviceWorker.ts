/// <reference types="vite-plugin-pwa/client" />
import { registerSW } from 'virtual:pwa-register'
import type { ServiceWorkerRegistration } from 'virtual:pwa-register'

// Función para limpiar el caché
const clearCache = async () => {
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys()
      await Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName.startsWith('workbox-') || 
              cacheName.startsWith('api-cache-') || 
              cacheName.startsWith('images-cache-')) {
            return caches.delete(cacheName)
          }
          return Promise.resolve()
        })
      )
      console.log('Cache limpiado exitosamente')
    } catch (error) {
      console.error('Error al limpiar el cache:', error)
    }
  }
}

// Registrar el Service Worker con opciones mejoradas
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('Hay una nueva versión disponible. ¿Desea actualizar?')) {
      clearCache().then(() => {
        updateSW(true)
      })
    }
  },
  onOfflineReady() {
    console.log('La aplicación está lista para uso offline')
  },
  immediate: true,
  onRegistered(registration: ServiceWorkerRegistration | undefined) {
    if (registration) {
      // Limpiar caché al registrar
      clearCache()
      
      // Verificar actualizaciones cada hora
      setInterval(() => {
        registration.update()
      }, 60 * 60 * 1000)
    }
  }
})

// Limpiar caché al iniciar
clearCache()

export default updateSW 