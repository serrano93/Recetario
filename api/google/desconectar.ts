import type { VercelRequest, VercelResponse } from '@vercel/node';
import { borrarIntegracion, usuarioDe } from '../_lib/supabase';

/**
 * Desconecta el calendario de una persona: borra su refresh token.
 *
 * Los planes ya importados se quedan en la app; se limpian desde la propia
 * interfaz si molestan. Borrar aqui lo que el usuario ve seria una sorpresa
 * desagradable para una accion que suena a "deja de sincronizar".
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Usa POST.' });
  if (!(await usuarioDe(req.headers.authorization))) {
    return res.status(401).json({ error: 'Necesitas iniciar sesión.' });
  }

  const personId = String((req.body as { personId?: string })?.personId ?? '').trim();
  if (!personId) return res.status(400).json({ error: 'Falta personId.' });

  try {
    await borrarIntegracion(personId);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
