/**
 * URL base del Reporting Service (FastAPI, backend/reporting).
 * En dev corre en localhost:8093 (uvicorn). Ajustar aquí cuando exista
 * un dominio de despliegue real, o migrar a environment.ts si el proyecto
 * adopta ese esquema más adelante. Mismo criterio que ai-service.config.ts.
 */
export const REPORTING_SERVICE_BASE_URL = 'http://localhost:8093';
