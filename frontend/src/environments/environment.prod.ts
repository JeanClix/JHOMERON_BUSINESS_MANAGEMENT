/**
 * Entorno de PRODUCCIÓN (Cloudflare Pages). Todos los servicios quedan
 * detrás de un solo dominio de API (Caddy en la VM, ver deploy/Caddyfile),
 * cada uno bajo su propio prefijo de ruta.
 *
 * API_BASE_URL lo reemplaza scripts/set-env.mjs en el build de Cloudflare
 * Pages (variable de entorno del proyecto en el dashboard) -- no editar a
 * mano el dominio aquí.
 */
const API_BASE_URL = 'https://api.example.com';

export const environment = {
  production: true,
  adminServiceBaseUrl: `${API_BASE_URL}/admin`,
  reportingServiceBaseUrl: `${API_BASE_URL}/reporting`,
  aiServiceBaseUrl: `${API_BASE_URL}/ai`,
  mlServiceBaseUrl: `${API_BASE_URL}/ml`,
};
