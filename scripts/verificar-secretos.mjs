import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Comprueba que ningun secreto de servidor acaba en el bundle publico.
 *
 * Vite mete en el bundle TODA variable que empiece por VITE_, y solo esas. La
 * frontera es facil de cruzar sin querer: basta renombrar una variable o
 * importar desde `src/` un modulo de `api/`. Esto lo pilla antes de desplegar.
 *
 *   node scripts/verificar-secretos.mjs
 */

const DIST = new URL('../dist/', import.meta.url).pathname;

/** Nombres que jamas deben aparecer en el bundle. */
const PROHIBIDOS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'GOOGLE_CLIENT_SECRET',
  'APP_SECRET',
  'service_role',
];

/**
 * Valores reales, si estan en el entorno. En local no suelen estar; en CI si,
 * y ahi es donde mas importa.
 */
const VALORES = [process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.GOOGLE_CLIENT_SECRET, process.env.APP_SECRET]
  .filter((v) => typeof v === 'string' && v.length > 20);

async function ficheros(dir) {
  const salida = [];
  for (const entrada of await readdir(dir, { withFileTypes: true })) {
    const ruta = join(dir, entrada.name);
    if (entrada.isDirectory()) salida.push(...(await ficheros(ruta)));
    else if (/\.(js|css|html|webmanifest)$/.test(entrada.name)) salida.push(ruta);
  }
  return salida;
}

const problemas = [];
for (const ruta of await ficheros(DIST)) {
  const texto = await readFile(ruta, 'utf8');
  const corto = ruta.replace(DIST, '');
  for (const nombre of PROHIBIDOS) {
    if (texto.includes(nombre)) problemas.push(`${corto}: contiene "${nombre}"`);
  }
  for (const valor of VALORES) {
    if (texto.includes(valor)) problemas.push(`${corto}: contiene el VALOR de un secreto`);
  }
}

if (problemas.length) {
  console.error('FUGA DE SECRETOS:');
  for (const p of problemas) console.error('  -', p);
  process.exit(1);
}

console.log(`Sin fugas. Revisados los ficheros de dist/ contra ${PROHIBIDOS.length} nombres` +
  (VALORES.length ? ` y ${VALORES.length} valores reales.` : ' (los valores no estaban en el entorno).'));
