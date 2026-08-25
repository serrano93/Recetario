import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Comprobacion de que las funciones serverless estan vivas.
 *
 * Existe por un motivo concreto: `vercel.json` tenia un catch-all que mandaba
 * TODO a la SPA, incluido `/api`. Este endpoint es la forma rapida de verificar
 * que la excepcion funciona antes de construir nada encima.
 */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ ok: true, servicio: 'recetario', hora: new Date().toISOString() });
}
