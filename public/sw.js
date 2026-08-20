/*
 * Service worker del Recetario.
 *
 * Existe por un escenario muy concreto: estas en el super, en un sotano sin
 * cobertura, y la lista de la compra ya esta en el movil... pero la app no
 * llegaba a abrirse porque el HTML y el JS se pedian al servidor.
 *
 * Estrategia deliberadamente conservadora:
 *  - Estaticos con hash (/assets, /fonts): cache-first. Son inmutables, asi que
 *    guardarlos para siempre es seguro y ademas los hace instantaneos.
 *  - Navegacion (el HTML): network-first con caida a la copia guardada. Con red
 *    siempre te llevas la version nueva, y sin red se abre la ultima que fue
 *    bien. Asi se evita el clasico "la PWA se quedo pillada en una version
 *    vieja para siempre".
 *  - Todo lo demas (Supabase incluido): red directa, sin tocar. La
 *    sincronizacion ya tiene su propia logica de local-primero y cachear sus
 *    respuestas solo serviria para mostrar datos rancios.
 */

const VERSION = 'v1';
const SHELL = `recetario-shell-${VERSION}`;
const ASSETS = `recetario-assets-${VERSION}`;

/**
 * Guarda el HTML y, ademas, los ficheros que ese HTML declara.
 *
 * Hace falta hacerlo explicitamente: en la primera visita el navegador pide el
 * JS y el CSS ANTES de que este worker exista, asi que no pasan por su cache.
 * Sin esto, al recargar sin red tendriamos el HTML pero no la app.
 */
async function precachear() {
  const cache = await caches.open(SHELL);
  const res = await fetch('/', { cache: 'reload' });
  await cache.put('/', res.clone());

  const html = await res.text();
  const urls = new Set(['/favicon.svg', '/manifest.webmanifest']);
  for (const m of html.matchAll(/(?:src|href)="(\/(?:assets|fonts)\/[^"]+)"/g)) urls.add(m[1]);

  const assets = await caches.open(ASSETS);
  // Con allSettled un fichero que falle no tumba la instalacion entera.
  await Promise.allSettled([...urls].map((u) => assets.add(u)));
}

self.addEventListener('install', (event) => {
  event.waitUntil(precachear().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((claves) =>
        Promise.all(
          claves
            .filter((c) => c.startsWith('recetario-') && !c.endsWith(VERSION))
            .map((c) => caches.delete(c)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Ficheros que se sirven tal cual: los de /assets y /fonts llevan hash. */
function esEstatico(url) {
  return (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname === '/favicon.svg' ||
    url.pathname === '/manifest.webmanifest'
  );
}

/**
 * `ignoreVary` es imprescindible aqui.
 *
 * El servidor responde con `Vary: Origin`, y la peticion que hace este worker
 * al precachear no manda el mismo `Origin` que luego manda la pagina al pedir
 * el script. Sin esto, la entrada esta en la cache pero no casa nunca y la app
 * se queda en blanco sin cobertura.
 */
function buscarEnCache(request) {
  return caches.match(request, { ignoreVary: true });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase y demas, a su aire.

  if (esEstatico(url)) {
    event.respondWith(
      buscarEnCache(request).then(
        (guardado) =>
          guardado ??
          fetch(request).then((res) => {
            if (res.ok) {
              const copia = res.clone();
              void caches.open(ASSETS).then((c) => c.put(request, copia));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copia = res.clone();
          void caches.open(SHELL).then((c) => c.put('/', copia));
          return res;
        })
        .catch(async () => (await buscarEnCache('/')) ?? Response.error()),
    );
  }
});
