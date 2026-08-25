import type { VercelRequest, VercelResponse } from '@vercel/node';
import { canjearCodigo, verificarEstado } from '../_lib/google';
import { guardarIntegracion } from '../_lib/supabase';

/** Cuanto vale un enlace de consentimiento antes de caducar. */
const MINUTOS_VALIDO = 15;

/** Pagina de vuelta, para no dejar al navegador con un JSON en pantalla. */
function pagina(titulo: string, mensaje: string, ok: boolean): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titulo}</title><style>
body{font-family:system-ui,sans-serif;background:#faf7f2;color:#2c2722;display:grid;
place-items:center;min-height:100vh;margin:0;padding:24px}
.c{background:#fff;border:1px solid #e4ddd0;border-radius:14px;padding:28px;max-width:380px;text-align:center}
h1{font-size:1.15rem;margin:0 0 8px;color:${ok ? '#4b8b6f' : '#b3402f'}}
p{margin:0 0 18px;font-size:.92rem;line-height:1.5}
a{display:inline-block;background:#c25a3a;color:#fff;text-decoration:none;
padding:10px 18px;border-radius:999px;font-weight:600}
@media(prefers-color-scheme:dark){body{background:#191715;color:#ece7e0}
.c{background:#22201d;border-color:#383430}}
</style></head><body><div class="c">
<h1>${titulo}</h1><p>${mensaje}</p><a href="/">Volver al Recetario</a>
</div></body></html>`;
}

/**
 * Recibe el codigo de Google, lo canjea y guarda el refresh token.
 *
 * El refresh token se queda en la tabla `integraciones`, que no tiene ninguna
 * policy de RLS: solo lo ve el servidor. Nunca sale de aqui hacia el navegador.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  const { code, state, error } = req.query as Record<string, string | undefined>;

  if (error) {
    return res.status(400).send(pagina('No se ha conectado', `Google respondió: ${error}.`, false));
  }
  if (!code || !state) {
    return res.status(400).send(pagina('Falta información', 'La vuelta de Google venía incompleta.', false));
  }

  const datos = verificarEstado<{ personId: string; t: number }>(state);
  if (!datos) {
    return res.status(400).send(pagina('Enlace no válido', 'La firma no cuadra. Vuelve a intentarlo desde la app.', false));
  }
  if (Date.now() - datos.t > MINUTOS_VALIDO * 60_000) {
    return res.status(400).send(pagina('Enlace caducado', 'Han pasado más de 15 minutos. Inténtalo otra vez.', false));
  }

  try {
    const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '');
    const tokens = await canjearCodigo(code, host);
    const refresh = tokens.refresh_token;
    if (typeof refresh !== 'string') {
      // Pasa cuando la cuenta ya estaba autorizada y Google no lo reenvia.
      return res
        .status(400)
        .send(pagina('Falta el permiso permanente', 'Revoca el acceso en tu cuenta de Google y vuelve a conectar.', false));
    }
    await guardarIntegracion(datos.personId, refresh);
    return res.status(200).send(pagina('Calendario conectado', 'Ya puedes cerrar esta página.', true));
  } catch (e) {
    const detalle = e instanceof Error ? e.message : String(e);
    return res.status(500).send(pagina('Algo ha fallado', detalle.slice(0, 200), false));
  }
}
