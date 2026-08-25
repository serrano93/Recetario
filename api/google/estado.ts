import type { VercelRequest, VercelResponse } from '@vercel/node';
import { configurado } from '../_lib/google.js';
import { listarIntegraciones, usuarioDe } from '../_lib/supabase.js';

/**
 * Quien tiene el calendario conectado.
 *
 * Devuelve solo ids de persona: ni tokens ni nada que se le parezca. Es lo que
 * pinta la seccion de ajustes.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!(await usuarioDe(req.headers.authorization))) {
    return res.status(401).json({ error: 'Necesitas iniciar sesión.' });
  }
  if (!configurado()) return res.status(200).json({ configurado: false, conectados: [] });

  try {
    const filas = await listarIntegraciones();
    return res.status(200).json({
      configurado: true,
      conectados: filas.map((f) => f.person_id),
    });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
