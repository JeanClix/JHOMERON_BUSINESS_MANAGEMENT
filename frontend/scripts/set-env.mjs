// Inyecta API_BASE_URL (variable de entorno del build, p. ej. en Cloudflare
// Pages) en src/environments/environment.prod.ts antes de `ng build`.
// Uso: API_BASE_URL=https://api.midominio.com npm run build:prod
import { readFileSync, writeFileSync } from 'node:fs';

const apiBaseUrl = (process.env.API_BASE_URL || '').trim().replace(/\/+$/, '');
if (!/^https:\/\/[^/]+/.test(apiBaseUrl)) {
  console.error('[set-env] Falta API_BASE_URL (ej. https://api.midominio.com).');
  process.exit(1);
}

const archivo = new URL('../src/environments/environment.prod.ts', import.meta.url);
const contenido = readFileSync(archivo, 'utf8').replace(
  /const API_BASE_URL = '[^']*';/,
  `const API_BASE_URL = '${apiBaseUrl}';`,
);
writeFileSync(archivo, contenido);
console.log(`[set-env] API_BASE_URL = ${apiBaseUrl}`);
