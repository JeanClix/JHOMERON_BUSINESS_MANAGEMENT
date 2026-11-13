/**
 * Entorno de DESARROLLO (ng serve). Cada servicio corre en su propio puerto
 * de localhost. En el build de producción Angular reemplaza este archivo por
 * environment.prod.ts (ver fileReplacements en angular.json).
 */
export const environment = {
  production: false,
  adminServiceBaseUrl: 'http://localhost:8092',
  reportingServiceBaseUrl: 'http://localhost:8093',
  aiServiceBaseUrl: 'http://localhost:8090',
  mlServiceBaseUrl: 'http://localhost:8091',
};
