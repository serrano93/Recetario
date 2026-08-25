import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { AppData, PlanEvent } from '../src/types.js';
import {
  buscarReceta,
  fraseAnadido,
  fraseComeFuera,
  fraseIngredientes,
  frasePaso,
  fraseQueComemos,
  horaEnCasa,
  hoyEnCasa,
  resolverFecha,
  resolverMomento,
  resolverPersona,
} from '../src/lib/alexa.js';
import { guardarRecetario, leerRecetario } from './_lib/supabase.js';
import { FirmaInvalida, marcaDeTiempoValida, verificarPeticion } from './_lib/alexaVerify.js';

/**
 * Endpoint de la skill de Alexa.
 *
 * El cuerpo NO se parsea automaticamente: la firma de Amazon se calcula sobre
 * los bytes tal cual llegan, asi que parsear y volver a serializar la
 * invalidaria.
 */
export const config = { api: { bodyParser: false } };

/**
 * Id de la skill. Sin el, el endpoint no atiende a nadie.
 *
 * Falla cerrado a proposito: que una peticion venga firmada por Amazon solo
 * prueba que viene de Alexa, no de NUESTRA Alexa. Sin comprobar el id,
 * cualquier desarrollador podria apuntar su skill a esta URL y escribir en el
 * recetario.
 */
const APP_ID = process.env.ALEXA_SKILL_ID;

/* --- Respuestas ---------------------------------------------------------- */

function hablar(texto: string, seguir = false, atributos: Record<string, unknown> = {}) {
  return {
    version: '1.0',
    sessionAttributes: atributos,
    response: {
      outputSpeech: { type: 'PlainText', text: texto },
      shouldEndSession: !seguir,
      ...(seguir ? { reprompt: { outputSpeech: { type: 'PlainText', text: '¿Sigo?' } } } : {}),
    },
  };
}

/* --- Utilidades del documento -------------------------------------------- */

function sellar<T extends object>(x: T): T & { updatedAt: string } {
  return { ...x, updatedAt: new Date().toISOString() };
}

function nuevoId(prefijo: string): string {
  return `${prefijo}_alexa_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/* --- Intents -------------------------------------------------------------- */

interface Peticion {
  request?: {
    type?: string;
    timestamp?: string;
    intent?: { name?: string; slots?: Record<string, { value?: string }> };
  };
  session?: { attributes?: Record<string, unknown>; application?: { applicationId?: string } };
  context?: { System?: { application?: { applicationId?: string } } };
}

function valorSlot(p: Peticion, nombre: string): string | undefined {
  const v = p.request?.intent?.slots?.[nombre]?.value;
  return v && v.trim() ? v.trim() : undefined;
}

async function manejar(p: Peticion): Promise<ReturnType<typeof hablar>> {
  const tipo = p.request?.type;
  const hoy = hoyEnCasa();
  const hora = horaEnCasa();

  if (tipo === 'LaunchRequest') {
    return hablar('Hola. Puedes preguntarme qué toca comer, pedirme que apunte algo en la compra, o decirme que alguien come fuera.', true);
  }
  if (tipo === 'SessionEndedRequest') return hablar('');

  const intent = p.request?.intent?.name ?? '';

  if (intent === 'AMAZON.StopIntent' || intent === 'AMAZON.CancelIntent') {
    return hablar('Hasta luego.');
  }
  if (intent === 'AMAZON.HelpIntent') {
    return hablar(
      'Puedes decirme: qué cenamos hoy. O: apunta tomates en la compra. O: cómo se hacen las lentejas. O: hoy como fuera.',
      true,
    );
  }

  const data = await leerRecetario();
  if (!data) return hablar('No he podido acceder al recetario.');

  switch (intent) {
    /* ---- ¿Qué comemos? ---- */
    case 'QueComemos': {
      const fecha = resolverFecha(valorSlot(p, 'fecha'), hoy);
      const slot = resolverMomento(valorSlot(p, 'momento'), hora);
      return hablar(fraseQueComemos(data, fecha, slot, hoy));
    }

    /* ---- Apuntar en la compra ---- */
    case 'AnadirCompra': {
      const producto = valorSlot(p, 'producto');
      if (!producto) return hablar('¿Qué quieres que apunte?', true);
      const siguiente: AppData = {
        ...data,
        compra: [...data.compra, sellar({ id: nuevoId('c'), name: producto })],
      };
      await guardarRecetario(siguiente);
      return hablar(fraseAnadido(producto));
    }

    /* ---- Qué lleva una receta ---- */
    case 'RecetaIngredientes': {
      const receta = buscarReceta(valorSlot(p, 'receta'), data.recipes);
      if (!receta) return hablar('No encuentro esa receta en el recetario.');
      return hablar(fraseIngredientes(receta));
    }

    /* ---- Cómo se hace, paso a paso ---- */
    case 'RecetaPasos': {
      const receta = buscarReceta(valorSlot(p, 'receta'), data.recipes);
      if (!receta) return hablar('No encuentro esa receta en el recetario.');
      const paso = frasePaso(receta, 0);
      // El paso en el que vamos se guarda en la sesion de Alexa.
      return hablar(paso.texto, paso.hayMas, paso.hayMas ? { recetaId: receta.id, paso: 1 } : {});
    }

    /* ---- Siguiente paso ---- */
    case 'AMAZON.NextIntent':
    case 'AMAZON.YesIntent': {
      const atrs = p.session?.attributes ?? {};
      const recetaId = typeof atrs.recetaId === 'string' ? atrs.recetaId : null;
      const indice = typeof atrs.paso === 'number' ? atrs.paso : 0;
      const receta = recetaId ? data.recipes.find((r) => r.id === recetaId) : null;
      if (!receta) return hablar('No sé de qué receta hablamos. Pregúntame otra vez.');
      const paso = frasePaso(receta, indice);
      return hablar(paso.texto, paso.hayMas, paso.hayMas ? { recetaId, paso: indice + 1 } : {});
    }

    /* ---- Alguien come fuera ---- */
    case 'ComoFuera': {
      const fecha = resolverFecha(valorSlot(p, 'fecha'), hoy);
      const slot = resolverMomento(valorSlot(p, 'momento'), hora);
      const personaId = resolverPersona(valorSlot(p, 'persona'), data.people);
      // Sin saber quien, no se puede decidir para cuantos hay que cocinar.
      if (!valorSlot(p, 'persona')) {
        return hablar('¿Quién come fuera?', true);
      }
      const evento: PlanEvent = sellar({
        id: nuevoId('ev'),
        title: personaId
          ? `${data.people.find((x) => x.id === personaId)?.name} come fuera`
          : 'Nadie come en casa',
        // Sin persona, el plan es de los dos: `people` vacio significa eso.
        people: personaId ? [personaId] : [],
        from: fecha,
        to: fecha,
        blocks: [slot],
      });
      await guardarRecetario({ ...data, events: [...data.events, evento] });
      return hablar(fraseComeFuera(data, personaId, fecha, slot, hoy));
    }

    default:
      return hablar('No te he entendido. Prueba a preguntarme qué toca comer.');
  }
}

/* --- Handler -------------------------------------------------------------- */

async function cuerpoCrudo(req: VercelRequest): Promise<Buffer> {
  const trozos: Buffer[] = [];
  for await (const t of req) trozos.push(typeof t === 'string' ? Buffer.from(t) : t);
  return Buffer.concat(trozos);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Usa POST.' });
  if (!APP_ID) {
    return res.status(503).json({ error: 'Falta ALEXA_SKILL_ID en el servidor.' });
  }

  try {
    const crudo = await cuerpoCrudo(req);
    await verificarPeticion(crudo, req.headers);

    const p = JSON.parse(crudo.toString('utf8')) as Peticion;

    if (!marcaDeTiempoValida(p.request?.timestamp)) {
      return res.status(400).json({ error: 'Petición caducada.' });
    }

    // Que la peticion venga firmada por Amazon no basta: tiene que ser de
    // NUESTRA skill, no de cualquier otra.
    const idRecibido =
      p.context?.System?.application?.applicationId ?? p.session?.application?.applicationId;
    if (idRecibido !== APP_ID) {
      return res.status(403).json({ error: 'Skill no autorizada.' });
    }

    return res.status(200).json(await manejar(p));
  } catch (e) {
    if (e instanceof FirmaInvalida) {
      return res.status(400).json({ error: e.message });
    }
    // A Alexa se le contesta con voz, que un error mudo deja al usuario
    // mirando el altavoz sin saber que ha pasado.
    return res.status(200).json(hablar('Algo ha fallado en el recetario. Inténtalo en un rato.'));
  }
}
