import type { VercelRequest, VercelResponse } from '@vercel/node';
import { configurado, firmarEstado, urlDeConsentimiento } from '../_lib/google';
import { usuarioDe } from '../_lib/supabase';

/**
 * Arranca el OAuth de Google para una persona.
 *
 * Es POST y no una redireccion directa a proposito: asi el token de sesion va
 * en la cabecera Authorization y no por la barra del navegador, donde acabaria
 * en el historial y en los logs. Devuelve la URL y el cliente navega a ella.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Usa POST.' });
  if (!configurado()) {
    return res.status(503).json({ error: 'Google no está configurado en el servidor.' });
  }

  const quien = await usuarioDe(req.headers.authorization);
  if (!quien) return res.status(401).json({ error: 'Necesitas iniciar sesión.' });

  const personId = String((req.body as { personId?: string })?.personId ?? '').trim();
  if (!personId) return res.status(400).json({ error: 'Falta personId.' });

  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '');
  // El estado va firmado: sin firma, cualquiera podria volver del callback
  // diciendo ser otra persona y colar su cuenta en la integracion ajena.
  const state = firmarEstado({ personId, quien, t: Date.now() });

  return res.status(200).json({ url: urlDeConsentimiento(host, state) });
}
