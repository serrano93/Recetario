import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { AppData, PlanEntry, PlanEvent } from '../../src/types.js';
import { importarEventos, MARCA_PROPIA, REGLAS_POR_DEFECTO } from '../../src/lib/calendar.js';
import type { GoogleEvent } from '../../src/lib/calendar.js';
import { entryLabel } from '../../src/lib/plan.js';
import { addDays, today } from '../../src/lib/dates.js';
import {
  accessToken,
  actualizarEvento,
  PermisoCaducado,
  borrarEvento,
  calendarioPropio,
  configurado,
  crearEvento,
  CALENDARIO,
  listarCalendarios,
  listarEventos,
} from '../_lib/google.js';
import {
  borrarIntegracion,
  guardarIntegracion,
  guardarRecetario,
  leerRecetario,
  listarIntegraciones,
  usuarioDe,
} from '../_lib/supabase.js';

/** Cuantos dias por delante se sincronizan. */
const VENTANA = 14;

/** "14:00" + 1 hora -> "15:00". Sirve para el fin del evento publicado. */
function sumarHora(hhmm: string, horas: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = (h + horas) % 24;
  return `${String(total).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
}

/**
 * Sincroniza en las dos direcciones, por persona conectada.
 *
 * Leer: los eventos de sus calendarios que afectan a alguna comida entran como
 * planes con `origen: 'google'`.
 *
 * Escribir: las comidas del plan se publican en un calendario propio llamado
 * "Recetario". La reconciliacion se hace comparando lo que hay en ese
 * calendario con lo que hay en el plan, en vez de guardar el id de cada evento
 * en el documento: asi no hay estado que se pueda descuadrar y, si alguien
 * borra un evento a mano, la siguiente sincronizacion lo repone.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!configurado()) {
    return res.status(503).json({ error: 'Google no está configurado en el servidor.' });
  }

  // El cron de Vercel se identifica con su propia cabecera; las personas, con
  // su sesion. Cualquier otra cosa se queda fuera.
  const esCron = req.headers['x-vercel-cron'] !== undefined;
  if (!esCron && !(await usuarioDe(req.headers.authorization))) {
    return res.status(401).json({ error: 'Necesitas iniciar sesión.' });
  }

  try {
    const data = await leerRecetario();
    if (!data) return res.status(404).json({ error: 'No hay recetario que sincronizar.' });

    const ajustes = data.integraciones?.google;
    const leer = ajustes?.leer ?? true;
    const escribir = ajustes?.escribir ?? false;
    const reglas = ajustes?.reglas
      ? { ...REGLAS_POR_DEFECTO, ...ajustes.reglas }
      : REGLAS_POR_DEFECTO;
    const horaComida = ajustes?.horaComida ?? '14:00';
    const horaCena = ajustes?.horaCena ?? '21:00';

    const desde = today();
    const hasta = addDays(desde, VENTANA);

    const integraciones = await listarIntegraciones();
    if (integraciones.length === 0) {
      return res.status(200).json({ ok: true, aviso: 'Nadie ha conectado su calendario todavía.' });
    }

    let eventos: PlanEvent[] = data.events ?? [];
    const resumen: Record<string, unknown>[] = [];

    const caducados: string[] = [];

    for (const integracion of integraciones) {
      const persona = integracion.person_id;

      let token: string;
      try {
        token = await accessToken(integracion.refresh_token);
      } catch (e) {
        if (e instanceof PermisoCaducado) {
          // Se borra la integracion para que la app vuelva a ofrecer
          // "Conectar" en vez de fallar en silencio cada vez.
          await borrarIntegracion(persona);
          caducados.push(persona);
          continue;
        }
        throw e;
      }

      // El calendario propio se necesita para escribir, y para excluirlo al leer.
      let calendarioId = integracion.calendar_id;
      if (escribir) {
        calendarioId = await calendarioPropio(token, calendarioId);
        if (calendarioId !== integracion.calendar_id) {
          await guardarIntegracion(persona, integracion.refresh_token, calendarioId);
        }
      }

      const cuenta = { persona, importados: 0, creados: 0, actualizados: 0, borrados: 0 };

      /* --- Leer ---------------------------------------------------------- */
      if (leer) {
        const calendarios = await listarCalendarios(token);
        const ajenos = calendarios.filter((c) => c.id !== calendarioId && c.summary !== CALENDARIO);

        const crudos: GoogleEvent[] = [];
        for (const cal of ajenos) {
          crudos.push(...(await listarEventos(token, cal.id, desde, hasta)));
        }

        const nuevos = importarEventos(crudos, persona, reglas, ajustes?.ignorados ?? []);
        cuenta.importados = nuevos.length;

        // Los importados de esta persona se reemplazan enteros. Los que se
        // hayan editado a mano ya no son 'google', asi que no se tocan.
        eventos = [
          ...eventos.filter((e) => !(e.origen === 'google' && e.people[0] === persona)),
          ...nuevos.map((e) => ({ ...e, updatedAt: new Date().toISOString() })),
        ];
      }

      /* --- Escribir ------------------------------------------------------ */
      if (escribir && calendarioId) {
        const publicados = await listarEventos(token, calendarioId, desde, hasta);
        // Indexados por la comida a la que corresponden.
        const porComida = new Map<string, GoogleEvent>();
        for (const ev of publicados) {
          const marca = ev.extendedProperties?.private?.[MARCA_PROPIA];
          if (marca) porComida.set(marca, ev);
        }

        const enVentana = (data.plan ?? []).filter(
          (e: PlanEntry) => e.date >= desde && e.date <= hasta && e.people.includes(persona),
        );

        for (const comida of enVentana) {
          const hora = comida.slot === 'comida' ? horaComida : horaCena;
          const payload = {
            recetarioId: comida.id,
            titulo: `🍽 ${entryLabel(data as AppData, comida)}`,
            fecha: comida.date,
            horaInicio: hora,
            horaFin: sumarHora(hora, 1),
            descripcion: comida.leftoverOf ? 'Sobras de una tanda anterior.' : undefined,
          };
          const existente = porComida.get(comida.id);
          if (existente) {
            await actualizarEvento(token, calendarioId, existente.id, payload);
            cuenta.actualizados += 1;
            porComida.delete(comida.id);
          } else {
            await crearEvento(token, calendarioId, payload);
            cuenta.creados += 1;
          }
        }

        // Lo que queda en el mapa ya no esta en el plan: fuera del calendario.
        for (const sobrante of porComida.values()) {
          await borrarEvento(token, calendarioId, sobrante.id);
          cuenta.borrados += 1;
        }
      }

      resumen.push(cuenta);
    }

    const siguiente: AppData = {
      ...data,
      events: eventos,
      integraciones: {
        ...data.integraciones,
        google: {
          leer,
          escribir,
          horaComida,
          horaCena,
          reglas: ajustes?.reglas ?? {
            todoElDia: REGLAS_POR_DEFECTO.todoElDia,
            bloqueaComida: REGLAS_POR_DEFECTO.bloqueaComida,
            bloqueaCena: REGLAS_POR_DEFECTO.bloqueaCena,
          },
          ignorados: ajustes?.ignorados ?? [],
          ultimaSync: new Date().toISOString(),
        },
      },
    };
    await guardarRecetario(siguiente);

    return res.status(200).json({ ok: true, desde, hasta, resumen, caducados });
  } catch (e) {
    const detalle = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: detalle.slice(0, 400) });
  }
}
